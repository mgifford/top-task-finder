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
const SOURCE_BASE_WEIGHTS = {
  sitemap: 40,
  search: 28,
  'homepage-fallback': 20,
  unknown: 10,
};

function detectPrioritySignals(pathname) {
  const normalized = pathname.toLowerCase();
  return {
    homepage: normalized === '/' || normalized === '',
    search: /(^|\/)search(\/|$)|find/.test(normalized),
    accessibility: /accessibility|a11y/.test(normalized),
    topTask: /services?|apply|pay|register|renew|book|report|request|top-?tasks?/.test(normalized),
  };
}

function isLikelyHtmlUrl(urlValue) {
  const parsed = typeof urlValue === 'string' ? new URL(urlValue) : new URL(urlValue.href);
  return !NON_HTML_EXTENSION_PATTERN.test(parsed.pathname);
}

function scoreCandidateUrl(normalizedUrl, source) {
  const sourceWeight = SOURCE_BASE_WEIGHTS[source] ?? SOURCE_BASE_WEIGHTS.unknown;
  const pathSegments = normalizedUrl.pathname.split('/').filter(Boolean).length;
  const depthWeight = Math.max(0, 15 - pathSegments * 2);
  const hasQueryPenalty = normalizedUrl.search ? -4 : 0;
  const prioritySignals = detectPrioritySignals(normalizedUrl.pathname);

  let priorityWeight = 0;
  if (prioritySignals.homepage) {
    priorityWeight += 35;
  }
  if (prioritySignals.search) {
    priorityWeight += 18;
  }
  if (prioritySignals.accessibility) {
    priorityWeight += 22;
  }
  if (prioritySignals.topTask) {
    priorityWeight += 14;
  }

  return {
    score: sourceWeight + depthWeight + priorityWeight + hasQueryPenalty,
    prioritySignals,
    pathDepth: pathSegments,
  };
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

function aggregatePriorityCoverage(candidates) {
  return candidates.reduce(
    (coverage, candidate) => ({
      homepage: coverage.homepage || Boolean(candidate.prioritySignals?.homepage),
      search: coverage.search || Boolean(candidate.prioritySignals?.search),
      accessibility: coverage.accessibility || Boolean(candidate.prioritySignals?.accessibility),
      topTask: coverage.topTask || Boolean(candidate.prioritySignals?.topTask),
    }),
    {
      homepage: false,
      search: false,
      accessibility: false,
      topTask: false,
    },
  );
}

function normalizeAndScoreCandidates(candidates, canonicalHost) {
  const acceptedByKey = new Map();

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
    const scoring = scoreCandidateUrl(parsed, source);
    const existing = acceptedByKey.get(dedupeKey);
    const candidateRecord = {
      url: parsed.href,
      source,
      score: scoring.score,
      prioritySignals: scoring.prioritySignals,
      pathDepth: scoring.pathDepth,
      sourceSet: [source],
    };

    if (!existing || candidateRecord.score > existing.score) {
      acceptedByKey.set(dedupeKey, {
        ...candidateRecord,
        sourceSet: existing ? Array.from(new Set([...existing.sourceSet, source])) : [source],
      });
      return;
    }

    if (!existing.sourceSet.includes(source)) {
      existing.sourceSet.push(source);
      acceptedByKey.set(dedupeKey, existing);
    }
  });

  return Array.from(acceptedByKey.values()).sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.url.localeCompare(right.url);
  });
}

function buildSourceCounts(candidates) {
  return candidates.reduce(
    (counts, candidate) => {
      const source = candidate?.source ?? 'unknown';
      counts[source] = (counts[source] ?? 0) + 1;
      return counts;
    },
    {},
  );
}

function buildAcceptedSourceCounts(candidates) {
  return candidates.reduce(
    (counts, candidate) => {
      const source = candidate?.source ?? 'unknown';
      counts[source] = (counts[source] ?? 0) + 1;
      return counts;
    },
    {},
  );
}

function calculateScoreDiagnostics(candidates) {
  if (!candidates.length) {
    return {
      average: 0,
      highest: 0,
      lowest: 0,
    };
  }

  const scores = candidates.map((candidate) => candidate.score);
  const sum = scores.reduce((total, score) => total + score, 0);

  return {
    average: Number((sum / candidates.length).toFixed(2)),
    highest: Math.max(...scores),
    lowest: Math.min(...scores),
  };
}

function evaluateFallbackNeed({ primaryCandidates, requestedCount }) {
  const reasons = [];
  const shortfall = Math.max(0, requestedCount - primaryCandidates.length);
  const priorityCoverage = aggregatePriorityCoverage(primaryCandidates);
  const missingCriticalPriority = !priorityCoverage.homepage
    || !priorityCoverage.search
    || !priorityCoverage.accessibility;

  if (shortfall > 0) {
    reasons.push(`shortfall:${shortfall}`);
  }

  if (missingCriticalPriority) {
    reasons.push('missing-priority-coverage');
  }

  return {
    fallbackNeeded: reasons.length > 0,
    reasons,
    shortfall,
    priorityCoverage,
  };
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
    } catch {
      warnings.push('Sitemap source unavailable or unreadable for one or more sitemap files.');
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
    warnings.push('No-key search source unavailable in the current browser context.');
    return [];
  }
}

async function discoverFromHomepageFallback(normalizedBaseUrl, warnings) {
  try {
    const html = await fetchText(normalizedBaseUrl.href, { cache: 'no-store' });
    const links = extractHomepageLinks(html, normalizedBaseUrl.href);
    return links.map((url) => ({ url, source: 'homepage-fallback' }));
  } catch {
    warnings.push('Homepage fallback source unavailable.');
    return [];
  }
}

export async function discoverCandidates(scanRequest) {
  const warnings = [];
  const sourcesAttempted = ['sitemap', 'search'];
  const canonicalHost = canonicalizeHost(scanRequest.canonicalHost);
  const normalizedBaseUrl = scanRequest.normalizedUrl;

  const sitemapCandidates = await discoverFromSitemap(normalizedBaseUrl, warnings);
  const searchCandidates = await discoverFromSearchAdapter(
    normalizedBaseUrl,
    canonicalHost,
    warnings,
  );

  const primaryRawCandidates = [...sitemapCandidates, ...searchCandidates];
  const primaryCandidates = normalizeAndScoreCandidates(
    [...sitemapCandidates, ...searchCandidates],
    canonicalHost,
  );

  const fallbackEvaluation = evaluateFallbackNeed({
    primaryCandidates,
    requestedCount: scanRequest.requestedCount,
  });

  let fallbackUsed = false;
  let fallbackCandidates = [];
  if (fallbackEvaluation.fallbackNeeded) {
    fallbackUsed = true;
    sourcesAttempted.push('homepage-fallback');
    const rawFallback = await discoverFromHomepageFallback(normalizedBaseUrl, warnings);
    fallbackCandidates = normalizeAndScoreCandidates(rawFallback, canonicalHost);

    if (!fallbackCandidates.length) {
      warnings.push('Fallback triggered but did not yield additional eligible URLs.');
    }
  }

  const mergedCandidates = normalizeAndScoreCandidates(
    [...primaryCandidates, ...fallbackCandidates],
    canonicalHost,
  );

  const finalPriorityCoverage = aggregatePriorityCoverage(mergedCandidates);
  const sourceCountsRaw = {
    ...buildSourceCounts(primaryRawCandidates),
    ...(fallbackUsed ? buildSourceCounts(fallbackCandidates) : {}),
  };

  const sourceCountsAccepted = buildAcceptedSourceCounts(mergedCandidates);
  const scoreDiagnostics = calculateScoreDiagnostics(mergedCandidates);

  return {
    candidates: mergedCandidates,
    summary: {
      requestId: scanRequest.requestId,
      sourcesAttempted,
      fallbackUsed,
      fallbackTriggerReasons: fallbackEvaluation.reasons,
      cacheHit: false,
      cacheCleared: false,
      warnings,
      sourceCounts: {
        raw: sourceCountsRaw,
        accepted: sourceCountsAccepted,
      },
      priorityCoverage: finalPriorityCoverage,
      scoreDiagnostics,
    },
  };
}
