import { createWriteStream } from 'node:fs';
import { lstat, mkdtemp, realpath, rm, rmdir } from 'node:fs/promises';
import { lookup as dnsLookup } from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';
import type { IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { BlockList, isIP } from 'node:net';
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
  '.svg': 'image/svg+xml',
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

/**
 * Local uploads come only from the system temporary directory (the managed
 * root). The old TODODDLE_UPLOAD_ROOTS allow-list is gone.
 */
async function prepareLocalSource(
  input: UploadSourceInput,
  managedRoot: string | undefined,
  maxBytes: number
): Promise<PreparedUpload> {
  if (!input.filePath) throw new Error('filePath is required');
  if (!managedRoot)
    throw new Error('Local file uploads are not available here; pass an HTTPS sourceUrl instead');
  const requestedPath = resolve(input.filePath);
  const allowedLocations = `the system temporary directory (${managedRoot})`;
  // Reject a symlink as the final path component before following it.
  const requestedStats = await lstat(requestedPath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
    throw new Error(
      `Local file not found: ${requestedPath}. Save or copy the file into ${allowedLocations}, then pass that path.`
    );
  });
  if (!requestedStats.isFile()) throw new Error('Local upload source must be a regular file');
  const resolvedFile = await realpath(requestedPath);
  const resolvedManagedRoot = await realpath(resolve(managedRoot)).catch(() => null);
  if (!resolvedManagedRoot || !isInsideRoot(resolvedFile, resolvedManagedRoot)) {
    throw new Error(`Local file must be inside ${allowedLocations}. Copy it there, then retry.`);
  }
  const stats = await lstat(resolvedFile);
  if (!stats.isFile()) throw new Error('Local upload source must be a regular file');
  if (process.platform !== 'win32' && typeof process.getuid === 'function') {
    if (stats.uid !== process.getuid()) {
      throw new Error('Local upload source must be owned by the current user');
    }
  }
  if (stats.size <= 0 || stats.size > maxBytes) throw new Error('Local file size is not allowed');
  const fileName = sanitizeFileName(input.fileName || basename(resolvedFile));
  return {
    filePath: resolvedFile,
    fileName,
    fileSize: stats.size,
    contentType: input.contentType || inferContentType(fileName),
    cleanup: async (uploadConfirmed = false) => {
      if (!uploadConfirmed) return;
      await rm(resolvedFile, { force: true });
      const stagingDirectory = dirname(resolvedFile);
      if (stagingDirectory !== resolvedManagedRoot) {
        await rmdir(stagingDirectory).catch(() => undefined);
      }
    },
  };
}

const blockedAddresses = new BlockList();
// IPv4 special-purpose ranges (RFC 6890 and the IANA registry) that must never
// be fetched: "this network", private, shared/CGNAT, loopback, link-local,
// IETF protocol assignments, documentation, benchmarking, multicast, and
// reserved (which includes 255.255.255.255).
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blockedAddresses.addSubnet(network, prefix, 'ipv4');
}
// IPv6 ranges that are not public unicast. Forms that embed an IPv4 address
// (mapped, compatible, NAT64, 6to4) are checked as that IPv4 address instead.
for (const [network, prefix] of [
  // Unspecified, loopback, and the deprecated IPv4-compatible block.
  ['::', 96],
  ['::1', 128],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001::', 32],
  ['2001:db8::', 32],
  ['fc00::', 7],
  ['fe80::', 10],
  ['fec0::', 10],
  ['ff00::', 8],
] as const) {
  blockedAddresses.addSubnet(network, prefix, 'ipv6');
}

/** Expands an IPv6 literal into eight 16-bit groups, or null when it is not valid. */
function ipv6Groups(address: string): number[] | null {
  let text = address.split('%')[0];
  const dotted = /(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (dotted) {
    if (isIP(dotted[1]) !== 4) return null;
    const [a, b, c, d] = dotted[1].split('.').map(Number);
    text =
      text.slice(0, -dotted[1].length) +
      `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = text.split('::');
  if (halves.length > 2) return null;
  const parse = (part: string) => (part ? part.split(':') : []);
  const head = parse(halves[0]);
  const tail = halves.length === 2 ? parse(halves[1]) : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null;
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...tail];
  if (groups.some((group) => !/^[0-9a-f]{1,4}$/i.test(group))) return null;
  return groups.map((group) => parseInt(group, 16));
}

function ipv4FromGroups(high: number, low: number): string {
  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.');
}

/**
 * Returns the IPv4 address that an IPv6 address carries, for the forms a
 * network can route to that IPv4 host: IPv4-mapped (::ffff:a.b.c.d, also in
 * hex such as ::ffff:7f00:1), IPv4-compatible (::a.b.c.d), NAT64
 * (64:ff9b::/96), and 6to4 (2002::/16).
 */
function embeddedIpv4(groups: number[]): string | null {
  const zeros = (from: number, to: number) => groups.slice(from, to).every((group) => group === 0);
  if (zeros(0, 5) && groups[5] === 0xffff) return ipv4FromGroups(groups[6], groups[7]);
  if (zeros(0, 6)) return ipv4FromGroups(groups[6], groups[7]);
  if (groups[0] === 0x64 && groups[1] === 0xff9b && zeros(2, 6)) {
    return ipv4FromGroups(groups[6], groups[7]);
  }
  if (groups[0] === 0x2002) return ipv4FromGroups(groups[1], groups[2]);
  return null;
}

/**
 * True when an address is not a public unicast address. Anything that is not
 * a valid IP literal counts as private, so the check fails closed.
 */
export function isPrivateAddress(address: string): boolean {
  const literal = address.trim().replace(/^\[|\]$/g, '');
  const version = isIP(literal.split('%')[0]);
  if (version === 4) return blockedAddresses.check(literal, 'ipv4');
  if (version !== 6) return true;
  const groups = ipv6Groups(literal);
  if (!groups) return true;
  const ipv4 = embeddedIpv4(groups);
  if (ipv4 && blockedAddresses.check(ipv4, 'ipv4')) return true;
  const canonical = groups.map((group) => group.toString(16)).join(':');
  return blockedAddresses.check(canonical, 'ipv6');
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
  maxBytes: number,
  managedRoot?: string
): Promise<PreparedUpload> {
  if (Boolean(input.filePath) === Boolean(input.sourceUrl)) {
    throw new Error('Provide exactly one of filePath or sourceUrl');
  }
  return input.filePath
    ? prepareLocalSource(input, managedRoot, maxBytes)
    : prepareUrlSource(input, maxBytes);
}
