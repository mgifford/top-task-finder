/**
 * Tests for the browser-cache helpers in assets/js/cache.js.
 * A minimal localStorage mock is set up before importing the module so
 * that the functions can run in a Node.js test environment.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Minimal localStorage mock
// Set this up before importing cache.js so that the module sees the global.
// ---------------------------------------------------------------------------

function createLocalStorageMock() {
  const store = new Map();
  return {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); },
    removeItem(key) { store.delete(key); },
    get length() { return store.size; },
    key(index) { return Array.from(store.keys())[index] ?? null; },
    clear() { store.clear(); },
    // Expose the underlying store for inspection in tests
    _store: store,
  };
}

globalThis.localStorage = createLocalStorageMock();

// Now import the module under test – it will use the mock above.
const { loadCacheRecord, saveCacheRecord, clearCacheForHost } =
  await import('../assets/js/cache.js');

// Reset localStorage before each test so tests are independent.
beforeEach(() => {
  globalThis.localStorage.clear();
});

// ---------------------------------------------------------------------------
// saveCacheRecord / loadCacheRecord
// ---------------------------------------------------------------------------

describe('saveCacheRecord and loadCacheRecord', () => {
  const makeScanRequest = (host, count) => ({ canonicalHost: host, requestedCount: count });

  it('returns null for a key that was never saved', () => {
    assert.equal(loadCacheRecord(makeScanRequest('example.com', 100)), null);
  });

  it('round-trips a stored result', () => {
    const scanRequest = makeScanRequest('example.com', 100);
    const result = { selectedUrls: ['https://example.com/'], requestedCount: 100 };
    saveCacheRecord(scanRequest, result);
    const loaded = loadCacheRecord(scanRequest);
    assert.deepEqual(loaded, result);
  });

  it('stores different counts under separate keys', () => {
    const req50 = makeScanRequest('example.com', 50);
    const req100 = makeScanRequest('example.com', 100);
    saveCacheRecord(req50, { requestedCount: 50 });
    saveCacheRecord(req100, { requestedCount: 100 });

    assert.equal(loadCacheRecord(req50).requestedCount, 50);
    assert.equal(loadCacheRecord(req100).requestedCount, 100);
  });

  it('stores different hosts under separate keys', () => {
    const reqA = makeScanRequest('example.com', 100);
    const reqB = makeScanRequest('other.com', 100);
    saveCacheRecord(reqA, { host: 'example.com' });
    saveCacheRecord(reqB, { host: 'other.com' });

    assert.equal(loadCacheRecord(reqA).host, 'example.com');
    assert.equal(loadCacheRecord(reqB).host, 'other.com');
  });

  it('treats www-prefixed hosts the same as the canonical host', () => {
    const req = makeScanRequest('example.com', 100);
    const reqWww = makeScanRequest('www.example.com', 100);
    saveCacheRecord(req, { stored: true });
    const loaded = loadCacheRecord(reqWww);
    assert.deepEqual(loaded, { stored: true });
  });

  it('overwrites a previous entry for the same key', () => {
    const req = makeScanRequest('example.com', 100);
    saveCacheRecord(req, { version: 1 });
    saveCacheRecord(req, { version: 2 });
    assert.equal(loadCacheRecord(req).version, 2);
  });

  it('returns null when the stored value is not valid JSON', () => {
    // Save a valid record first, then corrupt it without assuming the key format
    const req = makeScanRequest('example.com', 100);
    saveCacheRecord(req, { valid: true });

    // Find the key that was just written
    let savedKey;
    for (let i = 0; i < globalThis.localStorage.length; i++) {
      const k = globalThis.localStorage.key(i);
      if (k) { savedKey = k; break; }
    }
    assert.ok(savedKey, 'expected a key to be present after saveCacheRecord');
    globalThis.localStorage.setItem(savedKey, '{not valid json}}}');

    assert.equal(loadCacheRecord(req), null);
  });
});

// ---------------------------------------------------------------------------
// clearCacheForHost
// ---------------------------------------------------------------------------

describe('clearCacheForHost', () => {
  const makeScanRequest = (host, count) => ({ canonicalHost: host, requestedCount: count });

  it('removes all entries for a given host', () => {
    saveCacheRecord(makeScanRequest('example.com', 50), { v: 50 });
    saveCacheRecord(makeScanRequest('example.com', 100), { v: 100 });
    saveCacheRecord(makeScanRequest('other.com', 100), { v: 'other' });

    clearCacheForHost('https://example.com/');

    assert.equal(loadCacheRecord(makeScanRequest('example.com', 50)), null);
    assert.equal(loadCacheRecord(makeScanRequest('example.com', 100)), null);
    // other.com must be untouched
    assert.deepEqual(loadCacheRecord(makeScanRequest('other.com', 100)), { v: 'other' });
  });

  it('returns the number of removed entries', () => {
    saveCacheRecord(makeScanRequest('example.com', 50), {});
    saveCacheRecord(makeScanRequest('example.com', 100), {});

    const count = clearCacheForHost('https://example.com/');
    assert.equal(count, 2);
  });

  it('returns 0 when there are no entries for the host', () => {
    const count = clearCacheForHost('https://example.com/');
    assert.equal(count, 0);
  });

  it('accepts a string URL for the host argument', () => {
    saveCacheRecord(makeScanRequest('example.com', 100), { v: 1 });
    clearCacheForHost('https://example.com');
    assert.equal(loadCacheRecord(makeScanRequest('example.com', 100)), null);
  });

  it('works with a www-prefixed URL (strips www)', () => {
    saveCacheRecord(makeScanRequest('example.com', 100), { v: 1 });
    clearCacheForHost('https://www.example.com');
    assert.equal(loadCacheRecord(makeScanRequest('example.com', 100)), null);
  });

  it('accepts a URL object instead of a string', () => {
    saveCacheRecord(makeScanRequest('example.com', 100), { v: 1 });
    const urlObj = new URL('https://example.com');
    clearCacheForHost(urlObj);
    assert.equal(loadCacheRecord(makeScanRequest('example.com', 100)), null);
  });
});
