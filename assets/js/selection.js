function createRequestId() {
  return `scan-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

export function validateScanRequest(scanRequest) {
  if (!scanRequest || typeof scanRequest !== 'object') {
    throw new Error('Invalid scan request payload.');
  }

  if (!scanRequest.rawInputUrl || !scanRequest.normalizedUrl) {
    throw new Error('Scan request is missing required URL fields.');
  }

  if (!isPositiveInteger(scanRequest.requestedCount)) {
    throw new Error('Scan request count must be a positive whole number.');
  }

  return true;
}

export function validateUrlSelectionResult(result) {
  if (!result || typeof result !== 'object') {
    throw new Error('Invalid selection result payload.');
  }

  if (!Array.isArray(result.selectedUrls)) {
    throw new Error('Selection result must include selectedUrls.');
  }

  if (!isPositiveInteger(result.requestedCount)) {
    throw new Error('Selection result has invalid requestedCount.');
  }

  return true;
}

export function createScanRequest({
  rawInputUrl,
  normalizedUrl,
  requestedCount,
  effectiveCountLimit,
  bypassCache,
}) {
  return {
    requestId: createRequestId(),
    submittedAt: new Date().toISOString(),
    rawInputUrl,
    normalizedUrl,
    canonicalHost: normalizedUrl.host,
    requestedCount,
    effectiveCountLimit,
    includeSubdomains: false,
    bypassCache: Boolean(bypassCache),
  };
}

export function createDiscoverySummary({
  requestId,
  sourcesAttempted,
  fallbackUsed,
  fallbackTriggerReasons,
  cacheHit,
  cacheCleared,
  warnings,
  sourceCounts,
  priorityCoverage,
  scoreDiagnostics,
}) {
  return {
    requestId,
    sourcesAttempted: sourcesAttempted ?? [],
    fallbackUsed: Boolean(fallbackUsed),
    fallbackTriggerReasons: fallbackTriggerReasons ?? [],
    cacheHit: Boolean(cacheHit),
    cacheCleared: Boolean(cacheCleared),
    warnings: warnings ?? [],
    sourceCounts: sourceCounts ?? {},
    priorityCoverage: priorityCoverage ?? {},
    scoreDiagnostics: scoreDiagnostics ?? {},
  };
}

export function createUrlSelectionResult({
  requestId,
  selectedUrls,
  requestedCount,
  returnedCount,
  randomShareCount,
  shortfallCount,
  priorityCoverage,
  languageDistribution,
  discoverySummary,
}) {
  return {
    requestId,
    selectedUrls: selectedUrls ?? [],
    requestedCount,
    returnedCount,
    randomShareCount,
    shortfallCount,
    priorityCoverage: priorityCoverage ?? {},
    languageDistribution: languageDistribution ?? {},
    discoverySummary,
    generatedAt: new Date().toISOString(),
  };
}
