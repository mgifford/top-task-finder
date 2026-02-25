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

const NON_HTML_EXTENSION_PATTERN = /\.(?:png|jpe?g|gif|webp|svg|ico|pdf|zip|gz|mp4|mp3|woff2?|ttf|eot|xml|json|csv)$/i;

function isLikelyHtmlUrl(urlValue) {
  const parsed = typeof urlValue === 'string' ? new URL(urlValue) : new URL(urlValue.href);
  return !NON_HTML_EXTENSION_PATTERN.test(parsed.pathname);
}

async function fetchText(url, requestInit) {
  const response = await fetch(url, requestInit);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return response.text();
}

function parseXml(xmlText) {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(xmlText, 'application/xml');
  const hasError = parsed.querySelector('parsererror');
  if (hasError) {
    throw new Error('Invalid XML document');
  }
  return parsed;
}

function extractLocValues(xmlDocument) {
  return Array.from(xmlDocument.querySelectorAll('loc'))
    .map((node) => node.textContent?.trim())
    .filter(Boolean);
}

function extractHomepageLinks(htmlText, baseUrl) {
  const parser = new DOMParser();
  const html = parser.parseFromString(htmlText, 'text/html');
  return Array.from(html.querySelectorAll('a[href]'))
    .map((anchor) => anchor.getAttribute('href'))
    .filter(Boolean)
    .map((href) => {
      try {
        return new URL(href, baseUrl).href;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function normalizeAndDeduplicateCandidates(candidates, canonicalHost) {
  const accepted = [];
  const seen = new Set();

  candidates.forEach((candidate) => {
    const source = candidate?.source ?? 'unknown';
    const rawUrl = candidate?.url;
    if (!rawUrl) {
      return;
    }

    let parsed;
    try {
      parsed = normalizeInputUrl(rawUrl);
    } catch {
      return;
    }

    if (!isWithinCanonicalScope(parsed, canonicalHost)) {
      return;
    }

    if (!isLikelyHtmlUrl(parsed)) {
      return;
    }

    parsed.hash = '';
    const dedupeKey = buildNormalizedKey(parsed);
    if (seen.has(dedupeKey)) {
      return;
    }

    seen.add(dedupeKey);
    accepted.push({
      url: parsed.href,
      source,
    });
  });

  return accepted;
}

async function discoverFromSitemap(normalizedBaseUrl, warnings) {
  const sitemapUrl = new URL('/sitemap.xml', normalizedBaseUrl.origin);
  const candidates = [];
  const visited = new Set();
  const queue = [sitemapUrl.href];
  let nestedCount = 0;

  while (queue.length > 0 && nestedCount < 20) {
    const nextSitemapUrl = queue.shift();
    if (!nextSitemapUrl || visited.has(nextSitemapUrl)) {
      continue;
    }

    visited.add(nextSitemapUrl);
    nestedCount += 1;

    try {
      const xmlText = await fetchText(nextSitemapUrl, { cache: 'no-store' });
      const xml = parseXml(xmlText);
      const sitemapNodes = Array.from(xml.querySelectorAll('sitemap > loc'));

      if (sitemapNodes.length > 0) {
        sitemapNodes
          .map((node) => node.textContent?.trim())
          .filter(Boolean)
          .forEach((url) => {
            if (!visited.has(url)) {
              queue.push(url);
            }
          });
        continue;
      }

      extractLocValues(xml).forEach((url) => {
        candidates.push({ url, source: 'sitemap' });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown sitemap error';
      warnings.push(`Sitemap unavailable for ${nextSitemapUrl}: ${message}`);
    }
  }

  if (nestedCount >= 20 && queue.length > 0) {
    warnings.push('Sitemap parsing limit reached; additional nested sitemaps skipped.');
  }

  return candidates;
}

async function discoverFromSearchAdapter(normalizedBaseUrl, canonicalHost, warnings) {
  const query = encodeURIComponent(`site:${canonicalHost}`);
  const endpoint = `https://duckduckgo.com/html/?q=${query}`;

  try {
    const htmlText = await fetchText(endpoint, { cache: 'no-store' });
    const parser = new DOMParser();
    const html = parser.parseFromString(htmlText, 'text/html');
    const urls = Array.from(html.querySelectorAll('a[href]'))
      .map((node) => node.getAttribute('href'))
      .filter(Boolean)
      .map((href) => {
        try {
          return new URL(href, normalizedBaseUrl.origin).href;
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .slice(0, 40);

    return urls.map((url) => ({ url, source: 'search' }));
  } catch {
    warnings.push('No-key search source unavailable in current browser context.');
    return [];
  }
}

async function discoverFromHomepageFallback(normalizedBaseUrl, warnings) {
  try {
    const html = await fetchText(normalizedBaseUrl.href, { cache: 'no-store' });
    const links = extractHomepageLinks(html, normalizedBaseUrl.href);
    return links.map((url) => ({ url, source: 'homepage-fallback' }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown homepage fetch error';
    warnings.push(`Homepage fallback unavailable: ${message}`);
    return [];
  }
}

export async function discoverCandidates(scanRequest) {
  const warnings = [];
  const sourcesAttempted = ['sitemap', 'search', 'homepage-fallback'];
  const canonicalHost = canonicalizeHost(scanRequest.canonicalHost);
  const normalizedBaseUrl = scanRequest.normalizedUrl;

  const sitemapCandidates = await discoverFromSitemap(normalizedBaseUrl, warnings);
  const searchCandidates = await discoverFromSearchAdapter(
    normalizedBaseUrl,
    canonicalHost,
    warnings,
  );

  const primaryCandidates = normalizeAndDeduplicateCandidates(
    [...sitemapCandidates, ...searchCandidates],
    canonicalHost,
  );

  let fallbackUsed = false;
  let fallbackCandidates = [];
  if (primaryCandidates.length < scanRequest.requestedCount) {
    fallbackUsed = true;
    const rawFallback = await discoverFromHomepageFallback(normalizedBaseUrl, warnings);
    fallbackCandidates = normalizeAndDeduplicateCandidates(rawFallback, canonicalHost);
  }

  const mergedCandidates = normalizeAndDeduplicateCandidates(
    [...primaryCandidates, ...fallbackCandidates],
    canonicalHost,
  );

  return {
    candidates: mergedCandidates,
    summary: {
      requestId: scanRequest.requestId,
      sourcesAttempted,
      fallbackUsed,
      cacheHit: false,
      cacheCleared: false,
      warnings,
      sourceCounts: {
        sitemap: sitemapCandidates.length,
        search: searchCandidates.length,
        fallback: fallbackCandidates.length,
        accepted: mergedCandidates.length,
      },
    },
  };
}
