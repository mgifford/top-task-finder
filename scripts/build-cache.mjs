#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_REQUESTED_COUNT = 100;
const MAX_REQUESTED_COUNT = 200;
const MAX_SITEMAP_DOCS = 24;
const CRITICAL_PAGE_SCORE = 1000;

function parseArgs(argv) {
  const parsed = {};
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) {
      continue;
    }

    const key = arg.slice(2);
    const value = argv[index + 1] && !argv[index + 1].startsWith('--')
      ? argv[index + 1]
      : 'true';

    parsed[key] = value;

    if (value !== 'true') {
      index += 1;
    }
  }
  return parsed;
}

function canonicalizeHost(hostname) {
  const normalized = String(hostname || '').toLowerCase();
  if (normalized.startsWith('www.')) {
    return normalized.slice(4);
  }
  return normalized;
}

function normalizeInputUrl(rawValue) {
  const trimmed = String(rawValue || '').trim();
  if (!trimmed) {
    throw new Error('domainUrl is required');
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  const parsed = new URL(withProtocol);
  parsed.hostname = canonicalizeHost(parsed.hostname);
  parsed.hash = '';
  return parsed;
}

function clampRequestedCount(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return DEFAULT_REQUESTED_COUNT;
  }
  return Math.min(MAX_REQUESTED_COUNT, parsed);
}

function buildNormalizedKey(urlLike) {
  const parsed = typeof urlLike === 'string' ? new URL(urlLike) : new URL(urlLike.href);
  const cleanPath = parsed.pathname.replace(/\/$/, '') || '/';
  const query = parsed.search ? parsed.search : '';
  return `${canonicalizeHost(parsed.hostname)}${cleanPath}${query}`;
}

function isWithinCanonicalScope(candidateUrl, canonicalHost) {
  const parsed = typeof candidateUrl === 'string' ? new URL(candidateUrl) : new URL(candidateUrl.href);
  return canonicalizeHost(parsed.hostname) === canonicalizeHost(canonicalHost);
}

const NON_HTML_EXTENSION_PATTERN = /\.(?:png|jpe?g|gif|webp|svg|ico|pdf|zip|gz|mp4|mp3|woff2?|ttf|eot|xml|json|csv)$/i;

function isLikelyHtmlUrl(urlValue) {
  const parsed = typeof urlValue === 'string' ? new URL(urlValue) : new URL(urlValue.href);
  return !NON_HTML_EXTENSION_PATTERN.test(parsed.pathname);
}

function detectPrioritySignals(pathname) {
  const normalized = pathname.toLowerCase();
  return {
    homepage: normalized === '/' || normalized === '',
    search: /(^|\/)search(\/|$)|find/.test(normalized),
    accessibility: /accessibility|a11y/.test(normalized),
    topTask: /services?|apply|pay|register|renew|book|report|request|top-?tasks?/.test(normalized),
    contact: /(^|\/)contact(\/|$)/.test(normalized),
    about: /(^|\/)about(\/|$)/.test(normalized),
    help: /(^|\/)help|support|faq(\/|$)/.test(normalized),
    resources: /(^|\/)resources?(\/|$)/.test(normalized),
  };
}

const SOURCE_BASE_WEIGHTS = {
  sitemap: 40,
  'homepage-fallback': 20,
  unknown: 10,
};

function scoreCandidateUrl(normalizedUrl, source) {
  const sourceWeight = SOURCE_BASE_WEIGHTS[source] ?? SOURCE_BASE_WEIGHTS.unknown;
  const pathSegments = normalizedUrl.pathname.split('/').filter(Boolean).length;
  const depthWeight = Math.max(0, 15 - pathSegments * 2);
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
  if (prioritySignals.contact) {
    priorityWeight += 12;
  }
  if (prioritySignals.about) {
    priorityWeight += 10;
  }
  if (prioritySignals.help) {
    priorityWeight += 10;
  }
  if (prioritySignals.resources) {
    priorityWeight += 8;
  }

  return {
    score: sourceWeight + depthWeight + priorityWeight,
    prioritySignals,
  };
}

async function fetchText(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': 'top-task-finder-cache-builder/1.0 (+https://github.com/mgifford/top-task-finder)',
      accept: 'text/html,application/xml,text/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }

  return response.text();
}

function extractXmlLocValues(xmlText) {
  const values = [];
  const pattern = /<loc>\s*([^<]+?)\s*<\/loc>/gim;
  let match = pattern.exec(xmlText);
  while (match) {
    values.push(match[1].trim());
    match = pattern.exec(xmlText);
  }
  return values;
}

function xmlLooksLikeSitemapIndex(xmlText) {
  return /<sitemapindex[\s>]/i.test(xmlText);
}

function extractHrefValues(htmlText, baseUrl) {
  const values = [];
  const pattern = /<a[^>]+href=["']([^"'#]+)["']/gim;
  let match = pattern.exec(htmlText);
  while (match) {
    try {
      values.push(new URL(match[1], baseUrl).href);
    } catch {
      // ignore invalid links
    }
    match = pattern.exec(htmlText);
  }
  return values;
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
    const key = buildNormalizedKey(parsed);
    const scoring = scoreCandidateUrl(parsed, source);
    const existing = acceptedByKey.get(key);
    const candidateRecord = {
      url: parsed.href,
      source,
      score: scoring.score,
      prioritySignals: scoring.prioritySignals,
    };

    if (!existing || candidateRecord.score > existing.score) {
      acceptedByKey.set(key, candidateRecord);
    }
  });

  return Array.from(acceptedByKey.values()).sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.url.localeCompare(right.url);
  });
}

function aggregatePriorityCoverage(candidates) {
  return candidates.reduce(
    (coverage, candidate) => ({
      homepage: coverage.homepage || Boolean(candidate.prioritySignals?.homepage),
      search: coverage.search || Boolean(candidate.prioritySignals?.search),
      accessibility: coverage.accessibility || Boolean(candidate.prioritySignals?.accessibility),
      topTask: coverage.topTask || Boolean(candidate.prioritySignals?.topTask),
      contact: coverage.contact || Boolean(candidate.prioritySignals?.contact),
      about: coverage.about || Boolean(candidate.prioritySignals?.about),
      help: coverage.help || Boolean(candidate.prioritySignals?.help),
      resources: coverage.resources || Boolean(candidate.prioritySignals?.resources),
    }),
    {
      homepage: false,
      search: false,
      accessibility: false,
      topTask: false,
      contact: false,
      about: false,
      help: false,
      resources: false,
    },
  );
}

function applyUrlDiversityLimits(sortedCandidates) {
  const result = [];
  const pathCounts = new Map();
  const MAX_DEPTH_3 = 3;
  const MAX_DEPTH_2 = 15;

  sortedCandidates.forEach((candidate) => {
    const parsed = new URL(candidate.url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    
    const isHomepage = candidate.prioritySignals?.homepage;
    const isSearch = candidate.prioritySignals?.search;
    
    if (isHomepage || isSearch) {
      result.push(candidate);
      return;
    }
    
    let canAdd = true;
    
    if (segments.length >= 2) {
      const depth2Prefix = '/' + segments.slice(0, 2).join('/');
      const depth2Count = pathCounts.get(depth2Prefix) || 0;
      
      if (depth2Count >= MAX_DEPTH_2) {
        canAdd = false;
      }
    }
    
    if (canAdd && segments.length >= 3) {
      const depth3Prefix = '/' + segments.slice(0, 3).join('/');
      const depth3Count = pathCounts.get(depth3Prefix) || 0;
      
      if (depth3Count >= MAX_DEPTH_3) {
        canAdd = false;
      }
    }
    
    if (!canAdd) {
      return;
    }
    
    if (segments.length >= 3) {
      const depth3Prefix = '/' + segments.slice(0, 3).join('/');
      const depth3Count = pathCounts.get(depth3Prefix) || 0;
      pathCounts.set(depth3Prefix, depth3Count + 1);
    }
    
    if (segments.length >= 2) {
      const depth2Prefix = '/' + segments.slice(0, 2).join('/');
      const depth2Count = pathCounts.get(depth2Prefix) || 0;
      pathCounts.set(depth2Prefix, depth2Count + 1);
    }
    
    result.push(candidate);
  });

  return result;
}

function ensureCriticalPages(candidates, baseUrl) {
  const hasHomepage = candidates.some(c => c.prioritySignals?.homepage);
  
  if (!hasHomepage) {
    const homepageUrl = new URL('/', baseUrl.origin).href;
    candidates.unshift({
      url: homepageUrl,
      source: 'critical-pages',
      score: CRITICAL_PAGE_SCORE,
      prioritySignals: {
        homepage: true,
        search: false,
        accessibility: false,
        topTask: false,
        contact: false,
        about: false,
        help: false,
        resources: false,
      },
    });
  }
  
  return candidates;
}

async function discoverFromSitemap(baseUrl, warnings) {
  const candidates = [];
  const queue = [new URL('/sitemap.xml', baseUrl.origin).href];
  const visited = new Set();

  while (queue.length > 0 && visited.size < MAX_SITEMAP_DOCS) {
    const sitemapUrl = queue.shift();
    if (!sitemapUrl || visited.has(sitemapUrl)) {
      continue;
    }

    visited.add(sitemapUrl);

    try {
      const xmlText = await fetchText(sitemapUrl);
      const locValues = extractXmlLocValues(xmlText);

      if (xmlLooksLikeSitemapIndex(xmlText)) {
        locValues.forEach((next) => {
          if (!visited.has(next)) {
            queue.push(next);
          }
        });
      } else {
        locValues.forEach((url) => {
          candidates.push({ url, source: 'sitemap' });
        });
      }
    } catch {
      warnings.push(`Sitemap fetch unavailable for ${sitemapUrl}`);
    }
  }

  if (visited.size >= MAX_SITEMAP_DOCS && queue.length > 0) {
    warnings.push('Sitemap traversal limit reached; skipped additional sitemap files.');
  }

  return candidates;
}

async function discoverFromHomepage(baseUrl, warnings) {
  try {
    const html = await fetchText(baseUrl.href);
    return extractHrefValues(html, baseUrl.href).map((url) => ({
      url,
      source: 'homepage-fallback',
    }));
  } catch {
    warnings.push('Homepage fallback unavailable.');
    return [];
  }
}

function buildDiscoverySummary({ requestId, warnings, fallbackUsed, sourceCounts, priorityCoverage }) {
  return {
    requestId,
    sourcesAttempted: fallbackUsed ? ['sitemap', 'homepage-fallback'] : ['sitemap'],
    fallbackUsed,
    fallbackTriggerReasons: fallbackUsed ? ['shortfall-or-priority-gap'] : [],
    cacheHit: false,
    cacheCleared: false,
    warnings,
    sourceCounts,
    priorityCoverage,
    scoreDiagnostics: {},
  };
}

function createScanRequest(domainUrl, requestedCount) {
  const normalizedUrl = normalizeInputUrl(domainUrl);
  return {
    requestId: `cache-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    submittedAt: new Date().toISOString(),
    rawInputUrl: domainUrl,
    normalizedUrl,
    canonicalHost: normalizedUrl.host,
    requestedCount: clampRequestedCount(requestedCount),
    effectiveCountLimit: MAX_REQUESTED_COUNT,
    includeSubdomains: false,
    bypassCache: true,
  };
}

function buildResult(scanRequest, rankedCandidates, discoverySummary) {
  const diverseCandidates = applyUrlDiversityLimits(rankedCandidates);
  const selectedUrls = diverseCandidates
    .slice(0, scanRequest.requestedCount)
    .map((candidate) => candidate.url);

  return {
    requestId: scanRequest.requestId,
    selectedUrls,
    requestedCount: scanRequest.requestedCount,
    returnedCount: selectedUrls.length,
    randomShareCount: 0,
    shortfallCount: Math.max(0, scanRequest.requestedCount - selectedUrls.length),
    priorityCoverage: aggregatePriorityCoverage(diverseCandidates),
    languageDistribution: {
      primary: selectedUrls.length,
      additional: 0,
    },
    discoverySummary,
    generatedAt: new Date().toISOString(),
    generatedBy: 'github-action-cache',
  };
}

function slugForTarget(scanRequest) {
  return `${canonicalizeHost(scanRequest.canonicalHost)}-${scanRequest.requestedCount}.json`;
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function loadTargetsFromFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  const data = JSON.parse(raw);
  return Array.isArray(data.targets) ? data.targets : [];
}

async function processTarget(target, outDir) {
  const scanRequest = createScanRequest(target.domainUrl, target.requestedCount);
  const warnings = [];

  const sitemapRaw = await discoverFromSitemap(scanRequest.normalizedUrl, warnings);
  let ranked = normalizeAndScoreCandidates(sitemapRaw, scanRequest.canonicalHost);

  let fallbackUsed = false;
  let fallbackRaw = [];
  const priorityCoverage = aggregatePriorityCoverage(ranked);
  const missingCriticalPriority = !priorityCoverage.homepage
    || !priorityCoverage.search
    || !priorityCoverage.accessibility;

  if (ranked.length < scanRequest.requestedCount || missingCriticalPriority) {
    fallbackUsed = true;
    fallbackRaw = await discoverFromHomepage(scanRequest.normalizedUrl, warnings);
    ranked = normalizeAndScoreCandidates(
      [...ranked, ...fallbackRaw],
      scanRequest.canonicalHost,
    );
  }
  
  ranked = ensureCriticalPages(ranked, scanRequest.normalizedUrl);

  const discoverySummary = buildDiscoverySummary({
    requestId: scanRequest.requestId,
    warnings,
    fallbackUsed,
    sourceCounts: {
      raw: {
        sitemap: sitemapRaw.length,
        'homepage-fallback': fallbackRaw.length,
      },
      accepted: ranked.reduce((counts, item) => {
        counts[item.source] = (counts[item.source] ?? 0) + 1;
        return counts;
      }, {}),
    },
    priorityCoverage: aggregatePriorityCoverage(ranked),
  });

  const result = buildResult(scanRequest, ranked, discoverySummary);
  const fileName = slugForTarget(scanRequest);
  const outputPath = path.join(outDir, fileName);

  await fs.writeFile(outputPath, JSON.stringify(result, null, 2), 'utf8');

  return {
    fileName,
    canonicalHost: canonicalizeHost(scanRequest.canonicalHost),
    requestedCount: scanRequest.requestedCount,
    returnedCount: result.returnedCount,
    generatedAt: result.generatedAt,
    warnings,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const root = process.cwd();
  const outDir = path.resolve(root, args.out ?? 'cache');
  await ensureDir(outDir);

  let targets = [];
  if (args['domain-url']) {
    targets.push({
      domainUrl: args['domain-url'],
      requestedCount: clampRequestedCount(args['requested-count'] ?? DEFAULT_REQUESTED_COUNT),
    });
  } else {
    const targetFile = path.resolve(root, args.targets ?? 'config/cache-targets.json');
    targets = await loadTargetsFromFile(targetFile);
  }

  if (!targets.length) {
    throw new Error('No cache targets provided.');
  }

  const built = [];
  for (const target of targets) {
    const output = await processTarget(target, outDir);
    built.push(output);
    console.log(`Built cache: ${output.fileName} (${output.returnedCount} URLs)`);
  }

  const indexPath = path.join(outDir, 'index.json');
  await fs.writeFile(indexPath, JSON.stringify({ generatedAt: new Date().toISOString(), targets: built }, null, 2), 'utf8');
  console.log(`Wrote cache index: ${indexPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
