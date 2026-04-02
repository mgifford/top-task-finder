/**
 * Tests for the exported pure functions in assets/js/selection.js.
 * These functions are responsible for validating and creating scan request
 * and result data structures – all without any browser-specific APIs.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  validateScanRequest,
  validateUrlSelectionResult,
  createScanRequest,
  createDiscoverySummary,
  createUrlSelectionResult,
} from '../assets/js/selection.js';

// ---------------------------------------------------------------------------
// validateScanRequest
// ---------------------------------------------------------------------------

describe('validateScanRequest', () => {
  it('returns true for a valid scan request', () => {
    const scanRequest = {
      rawInputUrl: 'https://example.com',
      normalizedUrl: new URL('https://example.com'),
      requestedCount: 100,
    };
    assert.equal(validateScanRequest(scanRequest), true);
  });

  it('throws for null input', () => {
    assert.throws(() => validateScanRequest(null), /Invalid scan request/);
  });

  it('throws for a non-object input', () => {
    assert.throws(() => validateScanRequest('string'), /Invalid scan request/);
  });

  it('throws when rawInputUrl is missing', () => {
    const req = { normalizedUrl: new URL('https://example.com'), requestedCount: 50 };
    assert.throws(() => validateScanRequest(req), /missing required URL fields/);
  });

  it('throws when normalizedUrl is missing', () => {
    const req = { rawInputUrl: 'https://example.com', requestedCount: 50 };
    assert.throws(() => validateScanRequest(req), /missing required URL fields/);
  });

  it('throws when requestedCount is zero', () => {
    const req = {
      rawInputUrl: 'https://example.com',
      normalizedUrl: new URL('https://example.com'),
      requestedCount: 0,
    };
    assert.throws(() => validateScanRequest(req), /positive whole number/);
  });

  it('throws when requestedCount is negative', () => {
    const req = {
      rawInputUrl: 'https://example.com',
      normalizedUrl: new URL('https://example.com'),
      requestedCount: -5,
    };
    assert.throws(() => validateScanRequest(req), /positive whole number/);
  });

  it('throws when requestedCount is a float', () => {
    const req = {
      rawInputUrl: 'https://example.com',
      normalizedUrl: new URL('https://example.com'),
      requestedCount: 1.5,
    };
    assert.throws(() => validateScanRequest(req), /positive whole number/);
  });

  it('throws when requestedCount is not a number', () => {
    const req = {
      rawInputUrl: 'https://example.com',
      normalizedUrl: new URL('https://example.com'),
      requestedCount: 'lots',
    };
    assert.throws(() => validateScanRequest(req), /positive whole number/);
  });
});

// ---------------------------------------------------------------------------
// validateUrlSelectionResult
// ---------------------------------------------------------------------------

describe('validateUrlSelectionResult', () => {
  it('returns true for a valid result', () => {
    const result = { selectedUrls: ['https://example.com/'], requestedCount: 10 };
    assert.equal(validateUrlSelectionResult(result), true);
  });

  it('throws for null', () => {
    assert.throws(() => validateUrlSelectionResult(null), /Invalid selection result/);
  });

  it('throws for a non-object', () => {
    assert.throws(() => validateUrlSelectionResult(42), /Invalid selection result/);
  });

  it('throws when selectedUrls is missing', () => {
    assert.throws(() => validateUrlSelectionResult({ requestedCount: 10 }), /selectedUrls/);
  });

  it('throws when selectedUrls is not an array', () => {
    assert.throws(() => validateUrlSelectionResult({ selectedUrls: 'bad', requestedCount: 10 }), /selectedUrls/);
  });

  it('throws when requestedCount is not a positive integer', () => {
    assert.throws(() => validateUrlSelectionResult({ selectedUrls: [], requestedCount: 0 }), /requestedCount/);
    assert.throws(() => validateUrlSelectionResult({ selectedUrls: [], requestedCount: -1 }), /requestedCount/);
  });

  it('accepts an empty selectedUrls array with a valid requestedCount', () => {
    assert.equal(validateUrlSelectionResult({ selectedUrls: [], requestedCount: 1 }), true);
  });
});

// ---------------------------------------------------------------------------
// createScanRequest
// ---------------------------------------------------------------------------

describe('createScanRequest', () => {
  const normalizedUrl = new URL('https://example.com');

  it('returns an object with the expected shape', () => {
    const result = createScanRequest({
      rawInputUrl: 'example.com',
      normalizedUrl,
      requestedCount: 100,
      effectiveCountLimit: 200,
      bypassCache: false,
    });

    assert.equal(result.rawInputUrl, 'example.com');
    assert.equal(result.normalizedUrl, normalizedUrl);
    assert.equal(result.requestedCount, 100);
    assert.equal(result.effectiveCountLimit, 200);
    assert.equal(result.includeSubdomains, false);
  });

  it('derives canonicalHost from normalizedUrl.host', () => {
    const result = createScanRequest({
      rawInputUrl: 'example.com',
      normalizedUrl,
      requestedCount: 50,
      effectiveCountLimit: 200,
    });
    assert.equal(result.canonicalHost, normalizedUrl.host);
  });

  it('coerces bypassCache to a Boolean', () => {
    const withBypass = createScanRequest({
      rawInputUrl: 'x.com',
      normalizedUrl,
      requestedCount: 10,
      effectiveCountLimit: 200,
      bypassCache: 1,
    });
    assert.equal(withBypass.bypassCache, true);

    const withoutBypass = createScanRequest({
      rawInputUrl: 'x.com',
      normalizedUrl,
      requestedCount: 10,
      effectiveCountLimit: 200,
      bypassCache: 0,
    });
    assert.equal(withoutBypass.bypassCache, false);
  });

  it('generates a unique requestId each call', () => {
    const a = createScanRequest({ rawInputUrl: 'a.com', normalizedUrl, requestedCount: 10, effectiveCountLimit: 200 });
    const b = createScanRequest({ rawInputUrl: 'b.com', normalizedUrl, requestedCount: 10, effectiveCountLimit: 200 });
    assert.notEqual(a.requestId, b.requestId);
  });

  it('includes a submittedAt ISO timestamp', () => {
    const result = createScanRequest({ rawInputUrl: 'x.com', normalizedUrl, requestedCount: 10, effectiveCountLimit: 200 });
    assert.ok(result.submittedAt);
    assert.doesNotThrow(() => new Date(result.submittedAt).toISOString());
  });
});

// ---------------------------------------------------------------------------
// createDiscoverySummary
// ---------------------------------------------------------------------------

describe('createDiscoverySummary', () => {
  it('returns an object with all expected fields', () => {
    const result = createDiscoverySummary({
      requestId: 'req-1',
      sourcesAttempted: ['sitemap'],
      fallbackUsed: true,
      fallbackTriggerReasons: ['shortfall'],
      cacheHit: false,
      cacheCleared: false,
      warnings: ['w1'],
      sourceCounts: { sitemap: 10 },
      priorityCoverage: { homepage: true },
      scoreDiagnostics: {},
    });

    assert.equal(result.requestId, 'req-1');
    assert.deepEqual(result.sourcesAttempted, ['sitemap']);
    assert.equal(result.fallbackUsed, true);
    assert.deepEqual(result.fallbackTriggerReasons, ['shortfall']);
    assert.equal(result.cacheHit, false);
    assert.equal(result.cacheCleared, false);
    assert.deepEqual(result.warnings, ['w1']);
  });

  it('defaults arrays/objects to empty when not provided', () => {
    const result = createDiscoverySummary({ requestId: 'r' });
    assert.deepEqual(result.sourcesAttempted, []);
    assert.deepEqual(result.fallbackTriggerReasons, []);
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(result.sourceCounts, {});
    assert.deepEqual(result.priorityCoverage, {});
    assert.deepEqual(result.scoreDiagnostics, {});
  });

  it('coerces fallbackUsed and cacheHit/cacheCleared to Boolean', () => {
    const result = createDiscoverySummary({ requestId: 'r', fallbackUsed: 1, cacheHit: 0, cacheCleared: null });
    assert.equal(result.fallbackUsed, true);
    assert.equal(result.cacheHit, false);
    assert.equal(result.cacheCleared, false);
  });
});

// ---------------------------------------------------------------------------
// createUrlSelectionResult
// ---------------------------------------------------------------------------

describe('createUrlSelectionResult', () => {
  const discoverySummary = { requestId: 'r', sourcesAttempted: [] };

  it('returns an object with the expected shape', () => {
    const result = createUrlSelectionResult({
      requestId: 'r',
      selectedUrls: ['https://example.com/'],
      requestedCount: 100,
      returnedCount: 1,
      randomShareCount: 0,
      shortfallCount: 99,
      priorityCoverage: { homepage: true },
      languageDistribution: { primary: 1, additional: 0 },
      discoverySummary,
    });

    assert.equal(result.requestId, 'r');
    assert.deepEqual(result.selectedUrls, ['https://example.com/']);
    assert.equal(result.requestedCount, 100);
    assert.equal(result.returnedCount, 1);
    assert.equal(result.randomShareCount, 0);
    assert.equal(result.shortfallCount, 99);
    assert.equal(result.discoverySummary, discoverySummary);
  });

  it('defaults selectedUrls, priorityCoverage, and languageDistribution to empty when omitted', () => {
    const result = createUrlSelectionResult({
      requestId: 'r',
      requestedCount: 10,
      returnedCount: 0,
      discoverySummary,
    });
    assert.deepEqual(result.selectedUrls, []);
    assert.deepEqual(result.priorityCoverage, {});
    assert.deepEqual(result.languageDistribution, {});
  });

  it('defaults randomShareCount and shortfallCount to undefined when omitted', () => {
    const result = createUrlSelectionResult({
      requestId: 'r',
      requestedCount: 10,
      returnedCount: 0,
      discoverySummary,
    });
    assert.equal(result.randomShareCount, undefined);
    assert.equal(result.shortfallCount, undefined);
  });

  it('includes a generatedAt ISO timestamp', () => {
    const result = createUrlSelectionResult({
      requestId: 'r',
      requestedCount: 10,
      returnedCount: 0,
      discoverySummary,
    });
    assert.ok(result.generatedAt);
    assert.doesNotThrow(() => new Date(result.generatedAt).toISOString());
  });
});
