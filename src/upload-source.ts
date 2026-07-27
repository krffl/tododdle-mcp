import { createWriteStream } from 'node:fs';
import { lstat, mkdtemp, realpath, rm } from 'node:fs/promises';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { basename, extname, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { Readable, Transform } from 'node:stream';
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
  cleanup(): Promise<void>;
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
  maxBytes: number
): Promise<PreparedUpload> {
  if (!input.filePath) throw new Error('filePath is required');
  if (roots.length === 0) {
    throw new Error('Local uploads are disabled until TODODDLE_UPLOAD_ROOTS is configured');
  }
  const resolvedFile = await realpath(resolve(input.filePath));
  const resolvedRoots = await Promise.all(roots.map((root) => realpath(resolve(root))));
  if (!resolvedRoots.some((root) => isInsideRoot(resolvedFile, root))) {
    throw new Error('Local file is outside TODODDLE_UPLOAD_ROOTS');
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
    cleanup: async () => undefined,
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

async function validatePublicUrl(url: URL): Promise<void> {
  if (url.protocol !== 'https:') throw new Error('Only HTTPS upload sources are allowed');
  if (url.username || url.password)
    throw new Error('Upload source URLs cannot contain credentials');
  const addresses = isIP(url.hostname)
    ? [{ address: url.hostname }]
    : await lookup(url.hostname, { all: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('Upload source URL resolves to a private or reserved address');
  }
}

async function fetchWithSafeRedirects(initialUrl: string): Promise<Response> {
  let url = new URL(initialUrl);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    await validatePublicUrl(url);
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(URL_TIMEOUT_MS),
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
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
  if (!response.ok || !response.body) throw new Error(`Upload source returned ${response.status}`);
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > maxBytes) throw new Error('Remote file exceeds the maximum upload size');

  const directory = await mkdtemp(resolve(tmpdir(), 'tododdle-upload-'));
  const sourceName = basename(new URL(response.url || input.sourceUrl).pathname) || 'download';
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
      Readable.fromWeb(response.body as import('node:stream/web').ReadableStream),
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
        response.headers.get('content-type')?.split(';')[0] ||
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
  maxBytes: number
): Promise<PreparedUpload> {
  if (Boolean(input.filePath) === Boolean(input.sourceUrl)) {
    throw new Error('Provide exactly one of filePath or sourceUrl');
  }
  return input.filePath
    ? prepareLocalSource(input, roots, maxBytes)
    : prepareUrlSource(input, maxBytes);
}
