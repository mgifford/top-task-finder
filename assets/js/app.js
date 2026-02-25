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
const CACHE_DISPATCH_TIMEOUT_MS = 120000;
const CACHE_RUN_TIMEOUT_MS = 900000;
const GITHUB_TOKEN_STORAGE_KEY = 'ttf:github-token';
const GITHUB_API_BASE = 'https://api.github.com';
const FALLBACK_GITHUB_OWNER = 'mgifford';
const FALLBACK_GITHUB_REPO = 'top-task-finder';
const CACHE_WORKFLOW_FILE = 'cache-refresh.yml';
const CACHE_WORKFLOW_REF = 'main';

const state = {
  maxRequestedUrls: FALLBACK_MAX_URLS,
  currentResult: null,
  githubContext: null,
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
const githubTokenInput = document.getElementById('github-token');
const runServerCrawlButton = document.getElementById('run-server-crawl');
const serverCrawlStatus = document.getElementById('server-crawl-status');

function canonicalizeHost(hostname) {
  const normalized = String(hostname || '').toLowerCase();
  if (normalized.startsWith('www.')) {
    return normalized.slice(4);
  }
  return normalized;
}

function renderStatus(kind, message) {
  statusRegion.className = `status ${kind}`;
  statusRegion.textContent = message;
}

function renderError(errorMessage) {
  renderStatus('error', errorMessage);
}

function renderServerCrawlStatus(message) {
  if (serverCrawlStatus) {
    serverCrawlStatus.textContent = message;
  }
}

function getGithubContext() {
  if (state.githubContext) {
    return state.githubContext;
  }

  const host = window.location.hostname || '';
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  let owner = FALLBACK_GITHUB_OWNER;
  let repo = FALLBACK_GITHUB_REPO;

  if (host.endsWith('.github.io')) {
    owner = host.split('.')[0] || owner;
    if (pathParts.length > 0) {
      repo = pathParts[0] || repo;
    }
  }

  state.githubContext = { owner, repo };
  return state.githubContext;
}

function loadStoredGithubToken() {
  try {
    return localStorage.getItem(GITHUB_TOKEN_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function storeGithubToken(tokenValue) {
  try {
    const trimmed = String(tokenValue || '').trim();
    if (!trimmed) {
      localStorage.removeItem(GITHUB_TOKEN_STORAGE_KEY);
      return;
    }
    localStorage.setItem(GITHUB_TOKEN_STORAGE_KEY, trimmed);
  } catch {
    renderServerCrawlStatus('Unable to persist token in this browser context.');
  }
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

function updateUrlFromForm() {
  const params = new URLSearchParams(window.location.search);
  const domainValue = domainInput.value.trim();
  const requestedValue = requestedCountInput.value.trim();

  if (domainValue) {
    params.set('domainUrl', domainValue);
  } else {
    params.delete('domainUrl');
  }

  if (/^\d+$/.test(requestedValue)) {
    params.set('requestedCount', requestedValue);
  } else {
    params.delete('requestedCount');
  }

  if (bypassCacheInput.checked) {
    params.set('bypassCache', '1');
  } else {
    params.delete('bypassCache');
  }

  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}`;
  window.history.replaceState({}, '', nextUrl);
}

function applyQueryParamsToForm() {
  const params = new URLSearchParams(window.location.search);
  const domainUrl = params.get('domainUrl');
  const requestedCount = params.get('requestedCount');
  const bypassCache = params.get('bypassCache');

  let hasDomainInput = false;
  if (domainUrl) {
    domainInput.value = domainUrl;
    hasDomainInput = true;
  }

  if (requestedCount && /^\d+$/.test(requestedCount)) {
    requestedCountInput.value = requestedCount;
  }

  if (bypassCache && /^(1|true|yes)$/i.test(bypassCache)) {
    bypassCacheInput.checked = true;
  }

  return {
    hasDomainInput,
    shouldAutoRun: hasDomainInput,
  };
}

function encodeRepoPath(pathValue) {
  return pathValue
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

async function githubApiRequest(endpoint, token, options = {}) {
  const response = await fetch(`${GITHUB_API_BASE}${endpoint}`, {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body,
  });

  if (!response.ok) {
    const message = response.status === 401 || response.status === 403
      ? 'GitHub token rejected or missing required permissions.'
      : `GitHub API error (${response.status}).`;
    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function dispatchCacheWorkflow(scanRequest, token) {
  const { owner, repo } = getGithubContext();
  await githubApiRequest(
    `/repos/${owner}/${repo}/actions/workflows/${CACHE_WORKFLOW_FILE}/dispatches`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        ref: CACHE_WORKFLOW_REF,
        inputs: {
          domain_url: scanRequest.normalizedUrl.origin,
          requested_count: String(scanRequest.requestedCount),
        },
      }),
    },
  );
}

async function sleep(ms) {
  await new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function findWorkflowRun(runsPayload, startedAtMs) {
  const runs = Array.isArray(runsPayload?.workflow_runs)
    ? runsPayload.workflow_runs
    : [];

  const candidates = runs
    .filter((run) => run?.event === 'workflow_dispatch')
    .filter((run) => Date.parse(run.created_at || 0) >= startedAtMs - 60000)
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at));

  return candidates[0] ?? null;
}

async function waitForWorkflowRun(token, startedAtMs) {
  const { owner, repo } = getGithubContext();
  const timeoutAt = Date.now() + CACHE_DISPATCH_TIMEOUT_MS;

  while (Date.now() < timeoutAt) {
    const runsPayload = await githubApiRequest(
      `/repos/${owner}/${repo}/actions/workflows/${CACHE_WORKFLOW_FILE}/runs?event=workflow_dispatch&branch=${CACHE_WORKFLOW_REF}&per_page=20`,
      token,
    );

    const run = findWorkflowRun(runsPayload, startedAtMs);
    if (run) {
      return run;
    }

    await sleep(4000);
  }

  throw new Error('Timed out waiting for dispatched workflow run.');
}

async function waitForRunCompletion(token, runId) {
  const { owner, repo } = getGithubContext();
  const timeoutAt = Date.now() + CACHE_RUN_TIMEOUT_MS;

  while (Date.now() < timeoutAt) {
    const run = await githubApiRequest(
      `/repos/${owner}/${repo}/actions/runs/${runId}`,
      token,
    );

    if (run?.status === 'completed') {
      if (run.conclusion === 'success') {
        return run;
      }

      throw new Error(`Workflow completed with conclusion: ${run.conclusion || 'unknown'}.`);
    }

    await sleep(6000);
  }

  throw new Error('Timed out waiting for workflow completion.');
}

function decodeBase64Json(base64Content) {
  const clean = String(base64Content || '').replace(/\n/g, '');
  const jsonText = atob(clean);
  return JSON.parse(jsonText);
}

async function loadGeneratedCacheFromGithubApi(scanRequest, token) {
  const { owner, repo } = getGithubContext();
  const host = canonicalizeHost(scanRequest.canonicalHost);
  const filePath = `cache/${host}-${scanRequest.requestedCount}.json`;

  try {
    const payload = await githubApiRequest(
      `/repos/${owner}/${repo}/contents/${encodeRepoPath(filePath)}?ref=${CACHE_WORKFLOW_REF}`,
      token,
    );

    if (!payload?.content) {
      return null;
    }

    const parsed = decodeBase64Json(payload.content);
    validateUrlSelectionResult(parsed);
    return parsed;
  } catch {
    return null;
  }
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

async function loadGeneratedServerCache(scanRequest) {
  const host = canonicalizeHost(scanRequest.canonicalHost);
  const cachePath = `/cache/${host}-${scanRequest.requestedCount}.json`;

  try {
    const response = await fetch(cachePath, { cache: 'no-store' });
    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    validateUrlSelectionResult(payload);
    return payload;
  } catch {
    return null;
  }
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
    updateUrlFromForm();

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

    if (!scanRequest.bypassCache) {
      const generatedCache = await loadGeneratedServerCache(scanRequest);
      if (generatedCache) {
        renderResult(generatedCache);
        saveCacheRecord(scanRequest, generatedCache);
        renderStatus('success', 'Loaded generated server cache.');
        const accepted = generatedCache.discoverySummary?.sourceCounts?.accepted ?? {};
        const sitemapAccepted = accepted.sitemap ?? 0;
        const searchAccepted = accepted.search ?? 0;
        const fallbackAccepted = accepted['homepage-fallback'] ?? 0;
        cacheState.textContent = `Cache state: generated file hit, accepted(s:${sitemapAccepted} q:${searchAccepted} f:${fallbackAccepted})`;
        return;
      }
    }

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
    const acceptedTotal = sitemapAccepted + searchAccepted + fallbackAccepted;
    const fallbackReasonText = fallbackReasons.length
      ? `, fallback: ${fallbackReasons.join('|')}`
      : '';

    if (acceptedTotal === 0 && warningsCount > 0) {
      renderStatus(
        'warning',
        'Discovery sources were blocked or unavailable in this browser context. Try enabling bypass cache and rerun, or use a server-side fetch proxy for cross-site discovery.',
      );
    }

    cacheState.textContent = scanRequest.bypassCache
      ? `Cache state: bypassed, accepted(s:${sitemapAccepted} q:${searchAccepted} f:${fallbackAccepted})${warningsCount ? `, warnings: ${warningsCount}` : ''}${fallbackReasonText}`
      : `Cache state: miss then saved, accepted(s:${sitemapAccepted} q:${searchAccepted} f:${fallbackAccepted})${warningsCount ? `, warnings: ${warningsCount}` : ''}${fallbackReasonText}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.';
    renderError(message);
  }
}

async function handleRunServerCrawl() {
  runServerCrawlButton.disabled = true;
  renderServerCrawlStatus('Starting server crawl workflow...');

  try {
    const token = githubTokenInput.value.trim();
    if (!token) {
      throw new Error('Enter a GitHub token to run server crawl.');
    }

    storeGithubToken(token);
    updateUrlFromForm();

    const normalizedUrl = normalizeInputUrl(domainInput.value);
    const requestedCount = parseRequestedCount(requestedCountInput.value);
    const scanRequest = createScanRequest({
      rawInputUrl: domainInput.value,
      normalizedUrl,
      requestedCount,
      effectiveCountLimit: state.maxRequestedUrls,
      bypassCache: true,
    });
    validateScanRequest(scanRequest);

    const dispatchStartedAt = Date.now();
    await dispatchCacheWorkflow(scanRequest, token);
    renderServerCrawlStatus('Workflow dispatched. Waiting for run to start...');

    const run = await waitForWorkflowRun(token, dispatchStartedAt);
    renderServerCrawlStatus(`Run started (#${run.run_number}). Waiting for completion...`);

    await waitForRunCompletion(token, run.id);
    renderServerCrawlStatus('Workflow complete. Loading generated cache result...');

    let result = await loadGeneratedCacheFromGithubApi(scanRequest, token);
    if (!result) {
      result = await loadGeneratedServerCache(scanRequest);
    }

    if (!result) {
      throw new Error('Workflow succeeded, but generated cache file was not readable yet. Retry in a moment.');
    }

    validateUrlSelectionResult(result);
    renderResult(result);
    saveCacheRecord(scanRequest, result);

    const accepted = result.discoverySummary?.sourceCounts?.accepted ?? {};
    const sitemapAccepted = accepted.sitemap ?? 0;
    const searchAccepted = accepted.search ?? 0;
    const fallbackAccepted = accepted['homepage-fallback'] ?? 0;
    cacheState.textContent = `Cache state: server crawl completed, accepted(s:${sitemapAccepted} q:${searchAccepted} f:${fallbackAccepted})`;

    renderStatus('success', 'Server crawl completed and results loaded.');
    renderServerCrawlStatus('Done. Results loaded into the page.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server crawl failed.';
    renderError(message);
    renderServerCrawlStatus(message);
  } finally {
    runServerCrawlButton.disabled = false;
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

  const queryPrefill = applyQueryParamsToForm();

  if (!requestedCountInput.value) {
    requestedCountInput.value = String(DEFAULT_REQUESTED_COUNT);
  }

  const storedToken = loadStoredGithubToken();
  if (storedToken) {
    githubTokenInput.value = storedToken;
  }

  updateUrlFromForm();
  renderStatus('info', 'Ready.');

  if (queryPrefill.shouldAutoRun) {
    renderStatus('info', 'Loaded scan inputs from URL. Running scan...');
    scanForm.requestSubmit();
  }
}

scanForm.addEventListener('submit', handleSubmit);
copyButton.addEventListener('click', handleCopy);
clearCacheButton.addEventListener('click', handleClearCache);
runServerCrawlButton.addEventListener('click', handleRunServerCrawl);

domainInput.addEventListener('input', updateUrlFromForm);
requestedCountInput.addEventListener('input', updateUrlFromForm);
bypassCacheInput.addEventListener('change', updateUrlFromForm);
githubTokenInput.addEventListener('change', () => {
  storeGithubToken(githubTokenInput.value);
});

initialize();
