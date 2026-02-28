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
import { normalizeInputUrl } from './discovery.js';

const DEFAULT_REQUESTED_COUNT = 100;
const FALLBACK_MAX_URLS = 200;
const FALLBACK_POLL_INTERVAL_MS = 8000;
const FALLBACK_POLL_TIMEOUT_MS = 900000;
const NOTIFICATION_DURATION_MS = 10000;
const NOTIFICATION_ANIMATION_MS = 300;

const state = {
  defaultRequestedCount: DEFAULT_REQUESTED_COUNT,
  maxRequestedUrls: FALLBACK_MAX_URLS,
  runtime: {
    cloudflareTriggerEndpoint: '',
    pollIntervalMs: FALLBACK_POLL_INTERVAL_MS,
    pollTimeoutMs: FALLBACK_POLL_TIMEOUT_MS,
  },
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
const copyPromptButton = document.getElementById('copy-prompt');
const findUrlsButton = document.getElementById('find-urls');
const rescanUrlsButton = document.getElementById('rescan-urls');
const pageEstimate = document.getElementById('page-estimate');
const modal = document.getElementById('top-task-modal');
const openModalButton = document.getElementById('open-modal');
const closeModalButton = document.getElementById('close-modal');
const notificationModal = document.getElementById('notification-modal');
const notificationMessage = document.getElementById('notification-message');

let notificationTimeout = null;

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

function renderError(message) {
  renderStatus('error', message);
}

function renderServerCrawlStatus(message) {
  serverCrawlStatus.textContent = message;
}

function renderResult(result) {
  outputArea.value = Array.isArray(result.selectedUrls)
    ? result.selectedUrls.join('\n')
    : '';
  
  // Display page estimate if available
  if (result.totalDiscoveredPages) {
    const estimate = formatPageEstimate(result.totalDiscoveredPages);
    pageEstimate.textContent = `Estimated site size: ${estimate}`;
  }
}

function clearResultPresentation() {
  outputArea.value = '';
  cacheState.textContent = '';
  pageEstimate.textContent = '';
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
    const response = await fetch('config/limits.json', { cache: 'no-store' });
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

async function loadRuntimeConfig() {
  try {
    const response = await fetch('config/runtime.json', { cache: 'no-store' });
    if (!response.ok) {
      console.warn('Could not load runtime configuration. Using default values.');
      return;
    }

    const data = await response.json();
    const endpoint = String(data.cloudflareTriggerEndpoint || '').trim();
    const pollIntervalMs = Number(data.pollIntervalMs);
    const pollTimeoutMs = Number(data.pollTimeoutMs);

    if (endpoint) {
      state.runtime.cloudflareTriggerEndpoint = endpoint;
    }

    if (Number.isInteger(pollIntervalMs) && pollIntervalMs >= 1000) {
      state.runtime.pollIntervalMs = pollIntervalMs;
    }

    if (Number.isInteger(pollTimeoutMs) && pollTimeoutMs >= 30000) {
      state.runtime.pollTimeoutMs = pollTimeoutMs;
    }

    console.log('Runtime configuration loaded:', {
      endpoint: state.runtime.cloudflareTriggerEndpoint,
      pollIntervalMs: state.runtime.pollIntervalMs,
      pollTimeoutMs: state.runtime.pollTimeoutMs,
    });
  } catch (error) {
    console.error('Error loading runtime configuration:', error);
    // keep defaults
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

// Page estimate rounding thresholds: round to nearest 10 for small sites,
// 50 for medium sites, 500 for large sites, and 5000 for very large sites
const PAGE_ESTIMATE_THRESHOLDS = {
  SMALL_MAX: 100,        // Sites < 100 pages: round to nearest 10
  SMALL_ROUND: 10,
  MEDIUM_MAX: 1000,      // Sites < 1000 pages: round to nearest 50
  MEDIUM_ROUND: 50,
  LARGE_MAX: 10000,      // Sites < 10000 pages: round to nearest 500
  LARGE_ROUND: 500,
  XLARGE_ROUND: 5000,    // Sites >= 10000 pages: round to nearest 5000
};

function formatPageEstimate(count) {
  const { SMALL_MAX, SMALL_ROUND, MEDIUM_MAX, MEDIUM_ROUND, LARGE_MAX, LARGE_ROUND, XLARGE_ROUND } = PAGE_ESTIMATE_THRESHOLDS;
  
  if (count < SMALL_MAX) {
    return `~${Math.round(count / SMALL_ROUND) * SMALL_ROUND} pages`;
  }
  if (count < MEDIUM_MAX) {
    return `~${Math.round(count / MEDIUM_ROUND) * MEDIUM_ROUND} pages`;
  }
  if (count < LARGE_MAX) {
    return `~${Math.round(count / LARGE_ROUND) * LARGE_ROUND} pages`;
  }
  return `~${Math.round(count / XLARGE_ROUND) * XLARGE_ROUND}+ pages`;
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

async function loadGeneratedServerCache(scanRequest) {
  const host = canonicalizeHost(scanRequest.canonicalHost);
  const cachePath = `cache/${host}-${scanRequest.requestedCount}.json`;

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

async function sleep(ms) {
  await new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function triggerServerCrawl(scanRequest, forceRescan) {
  const endpoint = state.runtime.cloudflareTriggerEndpoint;
  if (!endpoint) {
    throw new Error('Server crawl endpoint is not configured. Set cloudflareTriggerEndpoint in config/runtime.json.');
  }

  const requestPayload = {
    domainUrl: scanRequest.normalizedUrl.origin,
    requestedCount: scanRequest.requestedCount,
    forceRescan: Boolean(forceRescan),
  };

  console.log('Triggering server crawl:', {
    endpoint,
    payload: requestPayload,
  });

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    });
  } catch (error) {
    console.error('Network error during server crawl trigger:', error);
    throw new Error(`Network error: Unable to reach server crawl endpoint. ${error.message}`);
  }

  let payload = {};
  try {
    payload = await response.json();
  } catch (parseError) {
    console.error('Failed to parse response JSON:', parseError);
    payload = {};
  }

  console.log('Server crawl response:', {
    status: response.status,
    ok: response.ok,
    payload,
  });

  if (!response.ok) {
    const message = typeof payload?.error === 'string'
      ? payload.error
      : `Server crawl trigger failed (${response.status}).`;
    throw new Error(message);
  }

  if (payload?.result) {
    validateUrlSelectionResult(payload.result);
    return {
      accepted: true,
      immediateResult: payload.result,
      runId: payload.runId ?? null,
    };
  }

  return {
    accepted: true,
    immediateResult: null,
    runId: payload?.runId ?? null,
  };
}

async function waitForGeneratedCache(scanRequest) {
  const startedAt = Date.now();
  const timeoutAt = startedAt + state.runtime.pollTimeoutMs;

  while (Date.now() < timeoutAt) {
    const cachedResult = await loadGeneratedServerCache(scanRequest);
    if (cachedResult) {
      return cachedResult;
    }

    const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
    renderServerCrawlStatus(`Server crawl in progress... ${elapsedSeconds}s elapsed.`);
    await sleep(state.runtime.pollIntervalMs);
  }

  return null;
}

async function runServerCrawlAndLoad(scanRequest, forceRescan) {
  renderStatus('info', 'No cached result found. Starting server crawl; this may take a few minutes...');
  renderServerCrawlStatus('Submitting crawl request...');

  const trigger = await triggerServerCrawl(scanRequest, forceRescan);
  if (trigger.immediateResult) {
    renderCachedResult(trigger.immediateResult, 'Generated server cache');
    saveCacheRecord(scanRequest, trigger.immediateResult);
    renderStatus('success', 'Popular URLs are ready.');
    renderServerCrawlStatus('Done.');
    return;
  }

  if (trigger.runId) {
    renderServerCrawlStatus(`Workflow run queued (#${trigger.runId}). Waiting for cache file...`);
  } else {
    renderServerCrawlStatus('Workflow queued. Waiting for cache file...');
  }

  const result = await waitForGeneratedCache(scanRequest);
  if (!result) {
    throw new Error('Server crawl timed out before cache became available. Please try again shortly.');
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

  await runServerCrawlAndLoad(scanRequest, forceRescan);
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
    showNotification('Cache cleared and rescan complete');
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
    showNotification('URLs have been copied');
  } catch (error) {
    console.error('Clipboard copy failed:', error);
    renderError('Unable to copy. Check browser clipboard permissions.');
  }
}

async function handleCopyPrompt() {
  try {
    const urls = outputArea.value.trim();
    if (!urls) {
      renderStatus('warning', 'Nothing to copy yet.');
      return;
    }

    // Load prompt template from text file
    const response = await fetch('assets/prompts/wcag-em-prompt.txt', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Failed to load prompt template.');
    }
    
    const promptTemplate = await response.text();
    
    // Append URLs to the prompt template
    const prompt = `${promptTemplate}\n\n${urls}`;

    await navigator.clipboard.writeText(prompt);
    showNotification('LLM prompt with URLs has been copied');
  } catch (error) {
    console.error('Clipboard copy failed:', error);
    renderError('Unable to copy. Check browser clipboard permissions.');
  }
}

async function initialize() {
  await Promise.all([loadLimitsConfig(), loadRuntimeConfig()]);
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
copyPromptButton.addEventListener('click', handleCopyPrompt);
rescanUrlsButton.addEventListener('click', handleRescan);
domainInput.addEventListener('input', updateUrlFromForm);

// Modal event handlers
function openModal() {
  modal.classList.add('open');
  modal.removeAttribute('hidden');
  closeModalButton.focus();
}

function closeModal() {
  modal.classList.remove('open');
  modal.setAttribute('hidden', '');
}

openModalButton.addEventListener('click', (event) => {
  event.preventDefault();
  openModal();
});

closeModalButton.addEventListener('click', closeModal);

modal.addEventListener('click', (event) => {
  if (event.target === modal) {
    closeModal();
  }
});

// Close modal on Escape key
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && modal.classList.contains('open')) {
    closeModal();
  }
});

// Notification modal functions
function showNotification(message) {
  if (notificationTimeout) {
    clearTimeout(notificationTimeout);
    notificationTimeout = null;
  }

  notificationMessage.textContent = message;
  notificationModal.removeAttribute('hidden');
  notificationModal.focus();

  notificationTimeout = setTimeout(() => {
    hideNotification();
  }, NOTIFICATION_DURATION_MS);
}

function hideNotification() {
  if (notificationTimeout) {
    clearTimeout(notificationTimeout);
    notificationTimeout = null;
  }
  
  notificationModal.classList.add('hiding');
  
  setTimeout(() => {
    notificationModal.setAttribute('hidden', '');
    notificationModal.classList.remove('hiding');
  }, NOTIFICATION_ANIMATION_MS);
}

// Allow keyboard dismissal of notification
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !notificationModal.hasAttribute('hidden')) {
    hideNotification();
  }
});

initialize();
