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

const NON_HTML_EXTENSION_PATTERN = /\.(?:png|jpe?g|gif|webp|svg|ico|pdf|doc|docx|xml|xlsx|xls|pptx?|zip|gz|mp4|mp3|woff2?|ttf|eot|json|csv)$/i;

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

  return {
    text: await response.text(),
    finalUrl: response.url,
  };
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
  // Match href attribute in <a> tags, whether it's the first attribute or not
  const pattern = /<a\s+[^>]*href=["']([^"'#]+)["'][^>]*>/gim;
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

function deduplicateYearBasedUrls(candidates, maxRecentItems = 3) {
  // Match year patterns: -2020, -2020-2021, /2020, _2020, etc.
  // Updated to allow year patterns followed by dashes, underscores, slashes, or end of path
  const yearPattern = /[-_/]((?:19|20)\d{2})(?:[-_]((?:19|20)\d{2}))?(?=[-_/?#]|$)/g;
  const groupedByPattern = new Map();
  
  candidates.forEach((candidate) => {
    const url = candidate.url;
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    
    // Create a normalized pattern by replacing all year occurrences with {YEAR}
    const patternKey = pathname.replace(yearPattern, '-{YEAR}');
    
    // Check if this URL has any year patterns
    const hasYearPattern = yearPattern.test(pathname);
    yearPattern.lastIndex = 0; // Reset regex state
    
    if (!hasYearPattern) {
      // No year pattern, treat as unique
      if (!groupedByPattern.has(url)) {
        groupedByPattern.set(url, [candidate]);
      }
      return;
    }
    
    // Group by the pattern
    const fullKey = `${parsed.hostname}${patternKey}`;
    if (!groupedByPattern.has(fullKey)) {
      groupedByPattern.set(fullKey, []);
    }
    
    groupedByPattern.get(fullKey).push(candidate);
  });
  
  const result = [];
  
  groupedByPattern.forEach((group, key) => {
    // If the group has maxRecentItems or fewer, keep all
    if (group.length <= maxRecentItems) {
      result.push(...group);
      return;
    }
    
    // Sort by the most recent year found in the URL
    const sortedByYear = group.sort((a, b) => {
      // Extract all years from each URL
      const yearsA = [];
      const yearsB = [];
      
      let match;
      const patternA = /[-_/]((?:19|20)\d{2})/g;
      while ((match = patternA.exec(a.url)) !== null) {
        yearsA.push(parseInt(match[1], 10));
      }
      
      const patternB = /[-_/]((?:19|20)\d{2})/g;
      while ((match = patternB.exec(b.url)) !== null) {
        yearsB.push(parseInt(match[1], 10));
      }
      
      // Use the maximum year from each URL for comparison
      const maxYearA = yearsA.length > 0 ? Math.max(...yearsA) : 0;
      const maxYearB = yearsB.length > 0 ? Math.max(...yearsB) : 0;
      
      return maxYearB - maxYearA;
    });
    
    // Keep only the most recent N items
    result.push(...sortedByYear.slice(0, maxRecentItems));
  });
  
  return result;
}

function applyUrlDiversityLimits(sortedCandidates) {
  const selected = [];
  const skipped = [];
  const selectedFirstSegments = new Set();
  
  // Track counts for efficient O(n) performance
  const firstSegmentCounts = new Map();
  const depth3PrefixCounts = new Map();
  const segmentCounts = new Map(); // Track individual segment repetition across all positions
  
  // Limits for diversity
  const MAX_FIRST_SEGMENT = 15;
  const MAX_DEPTH3_PREFIX = 3;
  const MAX_INDIVIDUAL_SEGMENT = 10; // Max URLs containing any single segment
  
  // Process candidates in order of their score
  sortedCandidates.forEach((candidate) => {
    const parsed = new URL(candidate.url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    
    // Always include homepage and search pages
    const isHomepage = candidate.prioritySignals?.homepage;
    const isSearch = candidate.prioritySignals?.search;
    
    if (isHomepage || isSearch) {
      selected.push(candidate);
      // Track segments from selected URLs
      if (segments.length >= 1) {
        selectedFirstSegments.add(segments[0]);
        firstSegmentCounts.set(segments[0], (firstSegmentCounts.get(segments[0]) || 0) + 1);
      }
      // Track all segments for individual segment counting
      segments.forEach((segment) => {
        segmentCounts.set(segment, (segmentCounts.get(segment) || 0) + 1);
      });
      return;
    }
    
    // Check if this URL shares path segments with already selected URLs
    let shouldSkip = false;
    
    // For URLs with at least one segment, check if the first segment is already seen
    if (segments.length >= 1) {
      const firstSegment = segments[0];
      
      // If we've already selected a URL with this first segment,
      // limit to MAX_FIRST_SEGMENT URLs per first-level segment to ensure diversity
      if (selectedFirstSegments.has(firstSegment)) {
        const countWithSameFirstSegment = firstSegmentCounts.get(firstSegment) || 0;
        
        if (countWithSameFirstSegment >= MAX_FIRST_SEGMENT) {
          shouldSkip = true;
        }
      }
    }
    
    // For deeper URLs (3+ segments), apply stricter limits on prefixes
    if (!shouldSkip && segments.length >= 3) {
      const depth3Prefix = '/' + segments.slice(0, 3).join('/');
      const countWithSamePrefix = depth3PrefixCounts.get(depth3Prefix) || 0;
      
      // Limit to MAX_DEPTH3_PREFIX URLs per 3-segment prefix
      if (countWithSamePrefix >= MAX_DEPTH3_PREFIX) {
        shouldSkip = true;
      }
    }
    
    // Check for individual segment repetition across all path positions
    // This catches patterns like "health-services" or "caregiver-support" appearing in many URLs
    if (!shouldSkip) {
      for (const segment of segments) {
        const count = segmentCounts.get(segment) || 0;
        if (count >= MAX_INDIVIDUAL_SEGMENT) {
          shouldSkip = true;
          break;
        }
      }
    }
    
    if (shouldSkip) {
      skipped.push(candidate);
    } else {
      selected.push(candidate);
      // Track the first segment and depth-3 prefix
      if (segments.length >= 1) {
        const firstSegment = segments[0];
        selectedFirstSegments.add(firstSegment);
        firstSegmentCounts.set(firstSegment, (firstSegmentCounts.get(firstSegment) || 0) + 1);
      }
      if (segments.length >= 3) {
        const depth3Prefix = '/' + segments.slice(0, 3).join('/');
        depth3PrefixCounts.set(depth3Prefix, (depth3PrefixCounts.get(depth3Prefix) || 0) + 1);
      }
      // Track all individual segments
      segments.forEach((segment) => {
        segmentCounts.set(segment, (segmentCounts.get(segment) || 0) + 1);
      });
    }
  });

  // Return both selected and skipped for potential backfill
  return {
    selected,
    skipped,
  };
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

async function findSitemapUrl(baseUrl, warnings) {
  // Try common sitemap locations
  const sitemapCandidates = [
    new URL('/sitemap.xml', baseUrl.origin).href,
    new URL('/sitemap_index.xml', baseUrl.origin).href,
    new URL('/sitemap/sitemap.xml', baseUrl.origin).href,
  ];

  // Try to get sitemap from robots.txt
  try {
    const robotsUrl = new URL('/robots.txt', baseUrl.origin).href;
    const { text: robotsText } = await fetchText(robotsUrl);
    const sitemapMatch = robotsText.match(/^Sitemap:\s*(.+)$/im);
    if (sitemapMatch) {
      const sitemapFromRobots = sitemapMatch[1].trim();
      // Add to beginning of candidates if not already present
      if (!sitemapCandidates.includes(sitemapFromRobots)) {
        sitemapCandidates.unshift(sitemapFromRobots);
      }
    }
  } catch (err) {
    // robots.txt not available, continue with default candidates
  }

  // Try each candidate until we find one that works
  for (const candidateUrl of sitemapCandidates) {
    try {
      const { text } = await fetchText(candidateUrl);
      // Check if it looks like XML
      if (text.trim().startsWith('<?xml') || text.includes('<urlset') || text.includes('<sitemapindex')) {
        return candidateUrl;
      }
    } catch (err) {
      // This candidate didn't work, try the next one
    }
  }

  // No sitemap found
  return null;
}

async function discoverFromSitemap(baseUrl, warnings) {
  const candidates = [];
  const initialSitemapUrl = await findSitemapUrl(baseUrl, warnings);
  
  if (!initialSitemapUrl) {
    warnings.push('No sitemap found at common locations or robots.txt');
    return candidates;
  }

  const queue = [initialSitemapUrl];
  const visited = new Set();

  while (queue.length > 0 && visited.size < MAX_SITEMAP_DOCS) {
    const sitemapUrl = queue.shift();
    if (!sitemapUrl || visited.has(sitemapUrl)) {
      continue;
    }

    visited.add(sitemapUrl);

    try {
      const { text: xmlText } = await fetchText(sitemapUrl);
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
    } catch (err) {
      warnings.push(`Sitemap fetch failed for ${sitemapUrl}: ${err.message}`);
    }
  }

  if (visited.size >= MAX_SITEMAP_DOCS && queue.length > 0) {
    warnings.push('Sitemap traversal limit reached; skipped additional sitemap files.');
  }

  return candidates;
}

async function discoverFromHomepage(baseUrl, warnings) {
  try {
    const { text: html, finalUrl } = await fetchText(baseUrl.href);
    // Use the final URL after redirects as the base for resolving relative links
    const effectiveBaseUrl = finalUrl || baseUrl.href;
    const links = extractHrefValues(html, effectiveBaseUrl);
    
    if (links.length === 0) {
      warnings.push(`Homepage fallback found 0 links from ${effectiveBaseUrl}`);
    }
    
    return links.map((url) => ({
      url,
      source: 'homepage-fallback',
    }));
  } catch (err) {
    warnings.push(`Homepage fallback unavailable: ${err.message}`);
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
  const deduplicatedCandidates = deduplicateYearBasedUrls(rankedCandidates, 3);
  const diversityResult = applyUrlDiversityLimits(deduplicatedCandidates);
  
  let finalCandidates = diversityResult.selected;
  
  // If we don't have enough URLs, backfill from skipped ones
  if (finalCandidates.length < scanRequest.requestedCount && diversityResult.skipped.length > 0) {
    const needed = scanRequest.requestedCount - finalCandidates.length;
    // Shuffle skipped URLs for random selection
    const shuffled = diversityResult.skipped
      .map(item => ({ item, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ item }) => item);
    
    finalCandidates = [...finalCandidates, ...shuffled.slice(0, needed)];
  }
  
  const selectedUrls = finalCandidates
    .slice(0, scanRequest.requestedCount)
    .map((candidate) => candidate.url);

  // Calculate total discovered pages for estimate
  const totalDiscovered = rankedCandidates.length;

  return {
    requestId: scanRequest.requestId,
    selectedUrls,
    requestedCount: scanRequest.requestedCount,
    returnedCount: selectedUrls.length,
    randomShareCount: 0,
    shortfallCount: Math.max(0, scanRequest.requestedCount - selectedUrls.length),
    priorityCoverage: aggregatePriorityCoverage(finalCandidates),
    languageDistribution: {
      primary: selectedUrls.length,
      additional: 0,
    },
    totalDiscoveredPages: totalDiscovered,
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
