import { createWriteStream } from 'node:fs';
import { chmod, lstat, mkdir, mkdtemp, realpath, rm, rmdir } from 'node:fs/promises';
import { lookup as dnsLookup } from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';
import type { IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { basename, dirname, extname, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const URL_TIMEOUT_MS = 60_000;
const MAX_REDIRECTS = 5;

export interface UploadSourceInput {
  filePath?: string;
  sourceUrl?: string;
  fileName?: string;
  contentType?: string;
}

export interface PreparedUpload {
  filePath: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  cleanup(uploadConfirmed?: boolean): Promise<void>;
}

export async function ensureManagedUploadRoot(root: string): Promise<string> {
  await mkdir(root, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') await chmod(root, 0o700);
  return realpath(root);
}

const mimeTypes: Record<string, string> = {
  '.csv': 'text/csv',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.mov': 'video/quicktime',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.txt': 'text/plain',
  '.webp': 'image/webp',
  '.zip': 'application/zip',
};

function inferContentType(fileName: string): string {
  return mimeTypes[extname(fileName).toLowerCase()] || 'application/octet-stream';
}

function isInsideRoot(filePath: string, root: string): boolean {
  const pathFromRoot = relative(root, filePath);
  return pathFromRoot === '' || (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== '..');
}

function sanitizeFileName(value: string): string {
  const name = basename(value)
    .replace(/[\u0000-\u001f]/g, '')
    .trim();
  if (!name || name === '.' || name === '..') throw new Error('Upload filename is invalid');
  return name.slice(0, 255);
}

async function prepareLocalSource(
  input: UploadSourceInput,
  roots: string[],
  managedRoot: string | undefined,
  maxBytes: number
): Promise<PreparedUpload> {
  if (!input.filePath) throw new Error('filePath is required');
  const resolvedFile = await realpath(resolve(input.filePath));
  const resolvedRoots = await Promise.all(roots.map((root) => realpath(resolve(root))));
  const resolvedManagedRoot = managedRoot ? await ensureManagedUploadRoot(managedRoot) : null;
  const isManagedFile = Boolean(
    resolvedManagedRoot && isInsideRoot(resolvedFile, resolvedManagedRoot)
  );
  if (!isManagedFile && !resolvedRoots.some((root) => isInsideRoot(resolvedFile, root))) {
    throw new Error('Local file is outside ToDoddle managed staging and approved upload roots');
  }
  const stats = await lstat(resolvedFile);
  if (!stats.isFile()) throw new Error('Local upload source must be a regular file');
  if (stats.size <= 0 || stats.size > maxBytes) throw new Error('Local file size is not allowed');
  const fileName = sanitizeFileName(input.fileName || basename(resolvedFile));
  return {
    filePath: resolvedFile,
    fileName,
    fileSize: stats.size,
    contentType: input.contentType || inferContentType(fileName),
    cleanup: async (uploadConfirmed = false) => {
      if (!uploadConfirmed || !isManagedFile || !resolvedManagedRoot) return;
      await rm(resolvedFile, { force: true });
      const stagingDirectory = dirname(resolvedFile);
      if (stagingDirectory !== resolvedManagedRoot) {
        await rmdir(stagingDirectory).catch(() => undefined);
      }
    },
  };
}

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized.startsWith('::ffff:')) return isPrivateAddress(normalized.slice(7));
  if (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd')
  )
    return true;
  if (isIP(address) !== 4) return false;
  const [a, b] = address.split('.').map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

type HostResolver = (hostname: string) => Promise<Array<{ address: string; family: number }>>;

const defaultResolver: HostResolver = (hostname) => dnsLookup(hostname, { all: true });

function assertPublicAddresses(addresses: Array<{ address: string }>): void {
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('Upload source URL resolves to a private or reserved address');
  }
}

/**
 * Builds a `net` lookup function that validates every resolved address at connect time.
 * The socket connects only to addresses this function returns, so a DNS answer that changes
 * between validation and connection (DNS rebinding) cannot reach a private address.
 */
export function createValidatingLookup(resolver: HostResolver = defaultResolver) {
  return (
    hostname: string,
    options: { all?: boolean },
    callback: (
      error: NodeJS.ErrnoException | null,
      address?: string | LookupAddress[],
      family?: number
    ) => void
  ): void => {
    resolver(hostname).then(
      (addresses) => {
        try {
          assertPublicAddresses(addresses);
        } catch (error) {
          callback(error as NodeJS.ErrnoException);
          return;
        }
        if (options?.all) callback(null, addresses);
        else callback(null, addresses[0].address, addresses[0].family);
      },
      (error: NodeJS.ErrnoException) => callback(error)
    );
  };
}

function validateUrlShape(url: URL): void {
  if (url.protocol !== 'https:') throw new Error('Only HTTPS upload sources are allowed');
  if (url.username || url.password)
    throw new Error('Upload source URLs cannot contain credentials');
  const literal = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(literal)) assertPublicAddresses([{ address: literal }]);
}

interface FetchedSource {
  status: number;
  headers: IncomingMessage['headers'];
  stream: IncomingMessage;
  url: string;
}

function requestPinned(url: URL, resolver: HostResolver): Promise<IncomingMessage> {
  return new Promise((resolvePromise, reject) => {
    const request = httpsRequest(
      url,
      {
        method: 'GET',
        lookup: createValidatingLookup(resolver) as never,
        timeout: URL_TIMEOUT_MS,
        signal: AbortSignal.timeout(URL_TIMEOUT_MS),
        headers: { 'user-agent': 'tododdle-mcp' },
      },
      resolvePromise
    );
    request.on('timeout', () => request.destroy(new Error('Upload source request timed out')));
    request.on('error', reject);
    request.end();
  });
}

export async function fetchWithSafeRedirects(
  initialUrl: string,
  resolver: HostResolver = defaultResolver
): Promise<FetchedSource> {
  let url = new URL(initialUrl);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    validateUrlShape(url);
    const response = await requestPinned(url, resolver);
    const status = response.statusCode ?? 0;
    if (![301, 302, 303, 307, 308].includes(status)) {
      return { status, headers: response.headers, stream: response, url: url.href };
    }
    response.resume();
    const location = response.headers.location;
    if (!location) throw new Error('Upload source redirect is missing a location');
    url = new URL(location, url);
  }
  throw new Error('Upload source exceeded the redirect limit');
}

async function prepareUrlSource(
  input: UploadSourceInput,
  maxBytes: number
): Promise<PreparedUpload> {
  if (!input.sourceUrl) throw new Error('sourceUrl is required');
  const response = await fetchWithSafeRedirects(input.sourceUrl);
  if (response.status < 200 || response.status > 299) {
    response.stream.resume();
    throw new Error(`Upload source returned ${response.status}`);
  }
  const declaredLength = Number(response.headers['content-length'] || 0);
  if (declaredLength > maxBytes) {
    response.stream.destroy();
    throw new Error('Remote file exceeds the maximum upload size');
  }

  const directory = await mkdtemp(resolve(tmpdir(), 'tododdle-upload-'));
  const sourceName = basename(new URL(response.url).pathname) || 'download';
  const fileName = sanitizeFileName(input.fileName || sourceName);
  const stagedPath = resolve(directory, fileName);
  let bytes = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length;
      if (bytes > maxBytes) callback(new Error('Remote file exceeds the maximum upload size'));
      else callback(null, chunk);
    },
  });

  try {
    await pipeline(
      response.stream,
      limiter,
      createWriteStream(stagedPath, { flags: 'wx', mode: 0o600 })
    );
    if (bytes <= 0) throw new Error('Remote file is empty');
    return {
      filePath: stagedPath,
      fileName,
      fileSize: bytes,
      contentType:
        input.contentType ||
        response.headers['content-type']?.split(';')[0] ||
        inferContentType(fileName),
      cleanup: async () => rm(directory, { recursive: true, force: true }),
    };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

export async function prepareUploadSource(
  input: UploadSourceInput,
  roots: string[],
  maxBytes: number,
  managedRoot?: string
): Promise<PreparedUpload> {
  if (Boolean(input.filePath) === Boolean(input.sourceUrl)) {
    throw new Error('Provide exactly one of filePath or sourceUrl');
  }
  return input.filePath
    ? prepareLocalSource(input, roots, managedRoot, maxBytes)
    : prepareUrlSource(input, maxBytes);
}
