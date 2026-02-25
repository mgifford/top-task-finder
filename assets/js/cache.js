const CACHE_PREFIX = 'ttf:v1';

function canonicalizeHost(hostname) {
  const normalized = String(hostname || '').toLowerCase();
  if (normalized.startsWith('www.')) {
    return normalized.slice(4);
  }
  return normalized;
}

function buildCacheKey({ canonicalHost, requestedCount }) {
  return `${CACHE_PREFIX}:selection:${canonicalHost}:${requestedCount}`;
}

export function loadCacheRecord(scanRequest) {
  const key = buildCacheKey({
    canonicalHost: canonicalizeHost(scanRequest.canonicalHost),
    requestedCount: scanRequest.requestedCount,
  });

  const raw = localStorage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveCacheRecord(scanRequest, result) {
  const key = buildCacheKey({
    canonicalHost: canonicalizeHost(scanRequest.canonicalHost),
    requestedCount: scanRequest.requestedCount,
  });

  localStorage.setItem(key, JSON.stringify(result));
}

export function clearCacheForHost(urlLike) {
  const url = typeof urlLike === 'string' ? new URL(urlLike) : new URL(urlLike.href);
  const host = canonicalizeHost(url.hostname);
  const targetPrefix = `${CACHE_PREFIX}:selection:${host}:`;
  const keysToRemove = [];

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(targetPrefix)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key));
  return keysToRemove.length;
}
