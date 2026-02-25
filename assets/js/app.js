import { discoverCandidates, normalizeInputUrl } from './discovery.js';
import {
  createDiscoverySummary,
  createScanRequest,
  createUrlSelectionResult,
  validateScanRequest,
  validateUrlSelectionResult,
} from './selection.js';
import {
  clearCacheForHost,
  loadCacheRecord,
  saveCacheRecord,
} from './cache.js';

const DEFAULT_REQUESTED_COUNT = 100;
const FALLBACK_MAX_URLS = 200;

const state = {
  maxRequestedUrls: FALLBACK_MAX_URLS,
  currentResult: null,
};

const scanForm = document.getElementById('scan-form');
const domainInput = document.getElementById('domain-url');
const requestedCountInput = document.getElementById('requested-count');
const bypassCacheInput = document.getElementById('bypass-cache');
const limitHelp = document.getElementById('limit-help');
const statusRegion = document.getElementById('status-region');
const cacheState = document.getElementById('cache-state');
const outputArea = document.getElementById('url-output');
const copyButton = document.getElementById('copy-results');
const clearCacheButton = document.getElementById('clear-cache');

function renderStatus(kind, message) {
  statusRegion.className = `status ${kind}`;
  statusRegion.textContent = message;
}

function renderError(errorMessage) {
  renderStatus('error', errorMessage);
}

function parseRequestedCount(rawValue) {
  if (!rawValue || rawValue.trim() === '') {
    return DEFAULT_REQUESTED_COUNT;
  }

  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error('Enter a whole number greater than 0 for Number of URLs.');
  }

  if (parsed > state.maxRequestedUrls) {
    return state.maxRequestedUrls;
  }

  return parsed;
}

async function loadLimitsConfig() {
  try {
    const response = await fetch('/config/limits.json', { cache: 'no-store' });
    if (!response.ok) {
      state.maxRequestedUrls = FALLBACK_MAX_URLS;
      return;
    }

    const data = await response.json();
    const configured = Number(data.maxRequestedUrls);
    if (Number.isInteger(configured) && configured >= DEFAULT_REQUESTED_COUNT) {
      state.maxRequestedUrls = configured;
      return;
    }

    state.maxRequestedUrls = FALLBACK_MAX_URLS;
  } catch {
    state.maxRequestedUrls = FALLBACK_MAX_URLS;
  }
}

function updateLimitHelp() {
  requestedCountInput.placeholder = String(DEFAULT_REQUESTED_COUNT);
  limitHelp.textContent = `Default ${DEFAULT_REQUESTED_COUNT}; max ${state.maxRequestedUrls}.`;
}

function renderResult(result) {
  outputArea.value = result.selectedUrls.join('\n');
  state.currentResult = result;
}

function buildPlaceholderResult(scanRequest, usedCache) {
  const summary = createDiscoverySummary({
    requestId: scanRequest.requestId,
    sourcesAttempted: ['placeholder'],
    fallbackUsed: false,
    cacheHit: usedCache,
    cacheCleared: false,
    warnings: ['Discovery pipeline placeholder active in WP01 scaffold.'],
  });

  return createUrlSelectionResult({
    requestId: scanRequest.requestId,
    selectedUrls: [scanRequest.normalizedUrl.href],
    requestedCount: scanRequest.requestedCount,
    returnedCount: 1,
    randomShareCount: 0,
    shortfallCount: Math.max(0, scanRequest.requestedCount - 1),
    priorityCoverage: {
      homepage: 1,
      search: 0,
      accessibility: 0,
      topTask: 0,
      other: 0,
    },
    languageDistribution: {
      primary: 1,
      additional: 0,
    },
    discoverySummary: summary,
  });
}

function buildResultFromDiscovery(scanRequest, discoveryOutput, usedCache) {
  const selectedUrls = discoveryOutput.candidates
    .map((candidate) => candidate.url)
    .slice(0, scanRequest.requestedCount);

  const summary = createDiscoverySummary({
    requestId: scanRequest.requestId,
    sourcesAttempted: discoveryOutput.summary.sourcesAttempted,
    fallbackUsed: discoveryOutput.summary.fallbackUsed,
    fallbackTriggerReasons: discoveryOutput.summary.fallbackTriggerReasons,
    cacheHit: usedCache,
    cacheCleared: false,
    warnings: discoveryOutput.summary.warnings,
    sourceCounts: discoveryOutput.summary.sourceCounts,
    priorityCoverage: discoveryOutput.summary.priorityCoverage,
    scoreDiagnostics: discoveryOutput.summary.scoreDiagnostics,
  });

  return createUrlSelectionResult({
    requestId: scanRequest.requestId,
    selectedUrls,
    requestedCount: scanRequest.requestedCount,
    returnedCount: selectedUrls.length,
    randomShareCount: 0,
    shortfallCount: Math.max(0, scanRequest.requestedCount - selectedUrls.length),
    priorityCoverage: {
      homepage: selectedUrls.some((url) => /\/$/.test(url)) ? 1 : 0,
      search: selectedUrls.some((url) => /\/search(?:\/|$)/.test(url)) ? 1 : 0,
      accessibility: selectedUrls.some((url) => /accessibility/.test(url)) ? 1 : 0,
      topTask: selectedUrls.some((url) => /top-?tasks?|services?|apply/.test(url)) ? 1 : 0,
      other: selectedUrls.length,
    },
    languageDistribution: {
      primary: selectedUrls.length,
      additional: 0,
    },
    discoverySummary: summary,
  });
}

async function handleSubmit(event) {
  event.preventDefault();
  try {
    renderStatus('info', 'Preparing scan request...');

    const normalizedUrl = normalizeInputUrl(domainInput.value);
    const requestedCount = parseRequestedCount(requestedCountInput.value);

    const scanRequest = createScanRequest({
      rawInputUrl: domainInput.value,
      normalizedUrl,
      requestedCount,
      effectiveCountLimit: state.maxRequestedUrls,
      bypassCache: bypassCacheInput.checked,
    });
    validateScanRequest(scanRequest);

    const cached = loadCacheRecord(scanRequest);
    if (cached && !scanRequest.bypassCache) {
      validateUrlSelectionResult(cached);
      renderResult(cached);
      renderStatus('success', 'Loaded cached result.');
      const accepted = cached.discoverySummary?.sourceCounts?.accepted ?? {};
      const sitemapAccepted = accepted.sitemap ?? 0;
      const searchAccepted = accepted.search ?? 0;
      const fallbackAccepted = accepted['homepage-fallback'] ?? 0;
      cacheState.textContent = `Cache state: hit, accepted(s:${sitemapAccepted} q:${searchAccepted} f:${fallbackAccepted})`;
      return;
    }

    const discoveryOutput = await discoverCandidates(scanRequest);
    let result = buildResultFromDiscovery(scanRequest, discoveryOutput, false);

    if (result.returnedCount === 0) {
      result = buildPlaceholderResult(scanRequest, false);
    }

    validateUrlSelectionResult(result);
    renderResult(result);
    saveCacheRecord(scanRequest, result);

    if (result.shortfallCount > 0) {
      renderStatus(
        'warning',
        `Generated ${result.returnedCount} URL(s); short by ${result.shortfallCount}.`,
      );
    } else {
      renderStatus('success', 'URL list generated from discovery sources.');
    }

    const warningsCount = result.discoverySummary?.warnings?.length ?? 0;
    const fallbackReasons = result.discoverySummary?.fallbackTriggerReasons ?? [];
    const accepted = result.discoverySummary?.sourceCounts?.accepted ?? {};
    const sitemapAccepted = accepted.sitemap ?? 0;
    const searchAccepted = accepted.search ?? 0;
    const fallbackAccepted = accepted['homepage-fallback'] ?? 0;
    const fallbackReasonText = fallbackReasons.length
      ? `, fallback: ${fallbackReasons.join('|')}`
      : '';
    cacheState.textContent = scanRequest.bypassCache
      ? `Cache state: bypassed, accepted(s:${sitemapAccepted} q:${searchAccepted} f:${fallbackAccepted})${warningsCount ? `, warnings: ${warningsCount}` : ''}${fallbackReasonText}`
      : `Cache state: miss then saved, accepted(s:${sitemapAccepted} q:${searchAccepted} f:${fallbackAccepted})${warningsCount ? `, warnings: ${warningsCount}` : ''}${fallbackReasonText}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.';
    renderError(message);
  }
}

async function handleCopy() {
  try {
    const text = outputArea.value.trim();
    if (!text) {
      renderStatus('warning', 'Nothing to copy yet. Generate URLs first.');
      return;
    }
    await navigator.clipboard.writeText(text);
    renderStatus('success', 'Copied URLs to clipboard.');
  } catch {
    renderError('Unable to copy. Check browser clipboard permissions.');
  }
}

function handleClearCache() {
  try {
    const normalizedUrl = normalizeInputUrl(domainInput.value || 'https://example.org');
    clearCacheForHost(normalizedUrl);
    cacheState.textContent = `Cache state: cleared for ${normalizedUrl.host}`;
    renderStatus('info', 'Cache cleared for normalized host scope.');
  } catch {
    renderError('Enter a valid URL before clearing cache for that host.');
  }
}

async function initialize() {
  await loadLimitsConfig();
  updateLimitHelp();
  requestedCountInput.value = String(DEFAULT_REQUESTED_COUNT);
  renderStatus('info', 'Ready.');
}

scanForm.addEventListener('submit', handleSubmit);
copyButton.addEventListener('click', handleCopy);
clearCacheButton.addEventListener('click', handleClearCache);

initialize();
