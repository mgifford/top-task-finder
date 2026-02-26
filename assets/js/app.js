import { normalizeInputUrl } from './discovery.js';
import {
  createScanRequest,
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
  defaultRequestedCount: DEFAULT_REQUESTED_COUNT,
  maxRequestedUrls: FALLBACK_MAX_URLS,
  githubContext: null,
};

const scanForm = document.getElementById('scan-form');
const domainInput = document.getElementById('domain-url');
const requestedCountInput = document.getElementById('requested-count');
const limitHelp = document.getElementById('limit-help');
const statusRegion = document.getElementById('status-region');
const cacheState = document.getElementById('cache-state');
const serverCrawlStatus = document.getElementById('server-crawl-status');
const outputArea = document.getElementById('url-output');
const copyButton = document.getElementById('copy-results');
const findUrlsButton = document.getElementById('find-urls');
const rescanUrlsButton = document.getElementById('rescan-urls');

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
  serverCrawlStatus.textContent = message;
}

function renderResult(result) {
  outputArea.value = Array.isArray(result.selectedUrls)
    ? result.selectedUrls.join('\n')
    : '';
}

function clearResultPresentation() {
  outputArea.value = '';
  cacheState.textContent = '';
  renderServerCrawlStatus('');
  rescanUrlsButton.hidden = true;
}

function parseRequestedCount(rawValue) {
  if (!rawValue || rawValue.trim() === '') {
    return state.defaultRequestedCount;
  }

  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return state.defaultRequestedCount;
  }

  return Math.min(parsed, state.maxRequestedUrls);
}

async function loadLimitsConfig() {
  try {
    const response = await fetch('/config/limits.json', { cache: 'no-store' });
    if (!response.ok) {
      state.maxRequestedUrls = FALLBACK_MAX_URLS;
      return;
    }

    const data = await response.json();

    const configuredDefault = Number(data.defaultUrlCount);
    if (Number.isInteger(configuredDefault) && configuredDefault > 0) {
      state.defaultRequestedCount = configuredDefault;
    }

    const configuredMax = Number(data.maxRequestedUrls);
    if (Number.isInteger(configuredMax) && configuredMax >= state.defaultRequestedCount) {
      state.maxRequestedUrls = configuredMax;
      return;
    }

    state.maxRequestedUrls = FALLBACK_MAX_URLS;
  } catch {
    state.maxRequestedUrls = FALLBACK_MAX_URLS;
  }
}

function updateLimitHelp() {
  limitHelp.textContent = `Default ${state.defaultRequestedCount} URLs (max ${state.maxRequestedUrls}).`;
}

function formatAge(isoDate) {
  const timestamp = Date.parse(isoDate || '');
  if (!Number.isFinite(timestamp)) {
    return 'unknown age';
  }

  const deltaMs = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(deltaMs / 60000);

  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function renderCacheMeta(result, sourceLabel) {
  const accepted = result?.discoverySummary?.sourceCounts?.accepted ?? {};
  const sitemapAccepted = accepted.sitemap ?? 0;
  const searchAccepted = accepted.search ?? 0;
  const fallbackAccepted = accepted['homepage-fallback'] ?? 0;
  const ageText = formatAge(result?.generatedAt);

  cacheState.textContent = `${sourceLabel} • Cached ${ageText} • accepted(s:${sitemapAccepted} q:${searchAccepted} f:${fallbackAccepted})`;
}

function renderCachedResult(result, sourceLabel) {
  validateUrlSelectionResult(result);
  renderResult(result);
  renderCacheMeta(result, sourceLabel);
  rescanUrlsButton.hidden = false;
}

function updateUrlFromForm() {
  const params = new URLSearchParams(window.location.search);
  const domainValue = domainInput.value.trim();
  const requestedValue = parseRequestedCount(requestedCountInput.value);

  if (domainValue) {
    params.set('domainUrl', domainValue);
  } else {
    params.delete('domainUrl');
  }

  if (requestedValue !== state.defaultRequestedCount) {
    params.set('requestedCount', String(requestedValue));
  } else {
    params.delete('requestedCount');
  }

  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}`;
  window.history.replaceState({}, '', nextUrl);
}

function applyQueryParamsToForm() {
  const params = new URLSearchParams(window.location.search);
  const domainUrl = params.get('domainUrl');
  const requestedCount = params.get('requestedCount');

  let hasDomainInput = false;
  if (domainUrl) {
    domainInput.value = domainUrl;
    hasDomainInput = true;
  }

  if (requestedCount && /^\d+$/.test(requestedCount)) {
    requestedCountInput.value = requestedCount;
  }

  return {
    shouldAutoRun: hasDomainInput,
  };
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
    // no-op
  }
}

function getOrPromptGithubToken() {
  const existing = loadStoredGithubToken();
  if (existing) {
    return existing;
  }

  const entered = window.prompt(
    'Enter a GitHub token with Actions + Contents permissions for this repository. It will be stored only in this browser.',
  );

  const trimmed = String(entered || '').trim();
  if (!trimmed) {
    throw new Error('A GitHub token is required to create new server cache.');
  }

  storeGithubToken(trimmed);
  return trimmed;
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

function buildScanRequest() {
  const normalizedUrl = normalizeInputUrl(domainInput.value);
  const requestedCount = parseRequestedCount(requestedCountInput.value);
  requestedCountInput.value = String(requestedCount);

  const scanRequest = createScanRequest({
    rawInputUrl: domainInput.value,
    normalizedUrl,
    requestedCount,
    effectiveCountLimit: state.maxRequestedUrls,
    bypassCache: false,
  });

  validateScanRequest(scanRequest);
  return scanRequest;
}

async function runServerCrawlAndLoad(scanRequest) {
  const token = getOrPromptGithubToken();
  const dispatchStartedAt = Date.now();

  renderStatus('info', 'No cached result found. Starting server crawl; this may take a few minutes...');
  renderServerCrawlStatus('Dispatching GitHub Action workflow...');

  await dispatchCacheWorkflow(scanRequest, token);
  const run = await waitForWorkflowRun(token, dispatchStartedAt);
  renderServerCrawlStatus(`Workflow run #${run.run_number} started. Waiting for completion...`);

  await waitForRunCompletion(token, run.id);
  renderServerCrawlStatus('Workflow complete. Loading generated result...');

  let result = await loadGeneratedCacheFromGithubApi(scanRequest, token);
  if (!result) {
    result = await loadGeneratedServerCache(scanRequest);
  }

  if (!result) {
    throw new Error('Server crawl completed, but cached file is not readable yet. Please retry in a minute.');
  }

  renderCachedResult(result, 'Generated server cache');
  saveCacheRecord(scanRequest, result);
  renderStatus('success', 'Popular URLs are ready.');
  renderServerCrawlStatus('Done.');
}

async function resolveResult(scanRequest, { forceRescan } = { forceRescan: false }) {
  if (!forceRescan) {
    const generated = await loadGeneratedServerCache(scanRequest);
    if (generated) {
      renderCachedResult(generated, 'Generated cache');
      saveCacheRecord(scanRequest, generated);
      renderStatus('success', 'Loaded cached popular URLs.');
      return;
    }

    const local = loadCacheRecord(scanRequest);
    if (local) {
      renderCachedResult(local, 'Local cache');
      renderStatus('success', 'Loaded cached popular URLs.');
      return;
    }
  }

  await runServerCrawlAndLoad(scanRequest);
}

async function handleSubmit(event) {
  event.preventDefault();
  findUrlsButton.disabled = true;

  try {
    clearResultPresentation();
    renderStatus('info', 'Preparing request...');

    const scanRequest = buildScanRequest();
    updateUrlFromForm();

    await resolveResult(scanRequest, { forceRescan: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.';
    renderError(message);
    renderServerCrawlStatus('');
  } finally {
    findUrlsButton.disabled = false;
  }
}

async function handleRescan() {
  findUrlsButton.disabled = true;
  rescanUrlsButton.disabled = true;

  try {
    const confirmed = window.confirm('Clear cached results and run a fresh server crawl for this URL?');
    if (!confirmed) {
      return;
    }

    const scanRequest = buildScanRequest();
    clearCacheForHost(scanRequest.normalizedUrl);
    updateUrlFromForm();

    await resolveResult(scanRequest, { forceRescan: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to rescan.';
    renderError(message);
  } finally {
    findUrlsButton.disabled = false;
    rescanUrlsButton.disabled = false;
  }
}

async function handleCopy() {
  try {
    const text = outputArea.value.trim();
    if (!text) {
      renderStatus('warning', 'Nothing to copy yet.');
      return;
    }

    await navigator.clipboard.writeText(text);
    renderStatus('success', 'Copied URLs to clipboard.');
  } catch {
    renderError('Unable to copy. Check browser clipboard permissions.');
  }
}

async function initialize() {
  await loadLimitsConfig();
  updateLimitHelp();

  const queryPrefill = applyQueryParamsToForm();

  if (!requestedCountInput.value) {
    requestedCountInput.value = String(state.defaultRequestedCount);
  }

  updateUrlFromForm();
  renderStatus('info', 'Ready.');

  if (queryPrefill.shouldAutoRun) {
    renderStatus('info', 'Loaded URL from query string. Finding popular URLs...');
    scanForm.requestSubmit();
  }
}

scanForm.addEventListener('submit', handleSubmit);
copyButton.addEventListener('click', handleCopy);
rescanUrlsButton.addEventListener('click', handleRescan);
domainInput.addEventListener('input', updateUrlFromForm);

initialize();
