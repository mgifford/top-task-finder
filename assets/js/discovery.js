function canonicalizeHost(hostname) {
  const normalized = hostname.toLowerCase();
  if (normalized === 'www') {
    return normalized;
  }
  if (normalized.startsWith('www.')) {
    return normalized.slice(4);
  }
  return normalized;
}

export function normalizeInputUrl(rawValue) {
  if (!rawValue || rawValue.trim() === '') {
    throw new Error('Domain/URL is required.');
  }

  const trimmed = rawValue.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let parsed;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new Error('Enter a valid domain or URL.');
  }

  const canonicalHost = canonicalizeHost(parsed.hostname);
  parsed.hostname = canonicalHost;
  parsed.hash = '';

  return parsed;
}

export function buildNormalizedKey(urlLike) {
  const parsed = typeof urlLike === 'string' ? new URL(urlLike) : new URL(urlLike.href);
  const canonicalHost = canonicalizeHost(parsed.hostname);
  const cleanPath = parsed.pathname.replace(/\/$/, '') || '/';
  const query = parsed.search ? parsed.search : '';
  return `${canonicalHost}${cleanPath}${query}`;
}

export function isWithinCanonicalScope(candidateUrl, canonicalHost) {
  const parsed = typeof candidateUrl === 'string' ? new URL(candidateUrl) : new URL(candidateUrl.href);
  const candidateHost = canonicalizeHost(parsed.hostname);
  return candidateHost === canonicalizeHost(canonicalHost);
}
