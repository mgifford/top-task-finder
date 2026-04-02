/**
 * Tests for the exported pure functions in assets/js/discovery.js.
 *
 * The three exported utility functions – normalizeInputUrl, buildNormalizedKey,
 * and isWithinCanonicalScope – are pure and do not use any browser-specific
 * APIs, so they can be exercised directly in Node.js.
 *
 * The main orchestration function (discoverCandidates) depends on fetch and
 * DOMParser which are not available in Node.js; it is covered by manual
 * browser-based testing as documented in ACCESSIBILITY.md.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeInputUrl,
  buildNormalizedKey,
  isWithinCanonicalScope,
} from '../assets/js/discovery.js';

// ---------------------------------------------------------------------------
// normalizeInputUrl
// ---------------------------------------------------------------------------

describe('normalizeInputUrl (discovery)', () => {
  it('prepends https:// when no protocol is given', () => {
    const result = normalizeInputUrl('example.com');
    assert.equal(result.protocol, 'https:');
    assert.equal(result.hostname, 'example.com');
  });

  it('accepts an explicit https:// URL', () => {
    const result = normalizeInputUrl('https://example.com/path');
    assert.equal(result.protocol, 'https:');
    assert.equal(result.pathname, '/path');
  });

  it('accepts an explicit http:// URL', () => {
    const result = normalizeInputUrl('http://example.com/');
    assert.equal(result.protocol, 'http:');
  });

  it('strips the www. prefix from the hostname', () => {
    const result = normalizeInputUrl('https://www.example.com/');
    assert.equal(result.hostname, 'example.com');
  });

  it('removes the hash fragment', () => {
    const result = normalizeInputUrl('https://example.com/page#section');
    assert.equal(result.hash, '');
  });

  it('preserves query parameters', () => {
    const result = normalizeInputUrl('https://example.com/search?q=a11y');
    assert.equal(result.search, '?q=a11y');
  });

  it('trims surrounding whitespace before processing', () => {
    const result = normalizeInputUrl('  example.com  ');
    assert.equal(result.hostname, 'example.com');
  });

  it('returns a URL object', () => {
    const result = normalizeInputUrl('example.com');
    assert.ok(result instanceof URL);
  });

  it('throws for an empty string', () => {
    assert.throws(() => normalizeInputUrl(''), /Domain\/URL is required/);
  });

  it('throws for a whitespace-only string', () => {
    assert.throws(() => normalizeInputUrl('   '), /Domain\/URL is required/);
  });

  it('throws for null', () => {
    assert.throws(() => normalizeInputUrl(null), /Domain\/URL is required/);
  });

  it('throws for undefined', () => {
    assert.throws(() => normalizeInputUrl(undefined), /Domain\/URL is required/);
  });

  it('throws for a string that cannot be parsed as a URL', () => {
    assert.throws(() => normalizeInputUrl(':::not-a-url'), /Enter a valid domain or URL/);
  });
});

// ---------------------------------------------------------------------------
// buildNormalizedKey (discovery)
// ---------------------------------------------------------------------------

describe('buildNormalizedKey (discovery)', () => {
  it('strips a trailing slash from the path', () => {
    assert.equal(buildNormalizedKey('https://example.com/path/'), 'example.com/path');
  });

  it('keeps the root path as /', () => {
    assert.equal(buildNormalizedKey('https://example.com/'), 'example.com/');
  });

  it('strips the www. prefix from the hostname', () => {
    assert.equal(buildNormalizedKey('https://www.example.com/page'), 'example.com/page');
  });

  it('includes the query string', () => {
    assert.equal(
      buildNormalizedKey('https://example.com/search?q=test'),
      'example.com/search?q=test',
    );
  });

  it('accepts a URL object (with .href)', () => {
    const url = new URL('https://example.com/about');
    assert.equal(buildNormalizedKey(url), 'example.com/about');
  });

  it('lowercases the hostname', () => {
    assert.equal(buildNormalizedKey('https://EXAMPLE.COM/page'), 'example.com/page');
  });

  it('produces the same key for www and non-www variants of the same path', () => {
    const withWww = buildNormalizedKey('https://www.example.com/about');
    const withoutWww = buildNormalizedKey('https://example.com/about');
    assert.equal(withWww, withoutWww);
  });

  it('omits a trailing slash on multi-segment paths', () => {
    const withSlash = buildNormalizedKey('https://example.com/a/b/');
    const withoutSlash = buildNormalizedKey('https://example.com/a/b');
    assert.equal(withSlash, withoutSlash);
  });
});

// ---------------------------------------------------------------------------
// isWithinCanonicalScope (discovery)
// ---------------------------------------------------------------------------

describe('isWithinCanonicalScope (discovery)', () => {
  it('returns true for exactly the same host', () => {
    assert.equal(isWithinCanonicalScope('https://example.com/page', 'example.com'), true);
  });

  it('returns true when the candidate is the www. variant of the canonical host', () => {
    assert.equal(isWithinCanonicalScope('https://www.example.com/page', 'example.com'), true);
  });

  it('returns true when the canonical host itself carries www. and the candidate does not', () => {
    assert.equal(isWithinCanonicalScope('https://example.com/page', 'www.example.com'), true);
  });

  it('returns false for a completely different host', () => {
    assert.equal(isWithinCanonicalScope('https://other.com/page', 'example.com'), false);
  });

  it('returns false for a subdomain of the canonical host', () => {
    assert.equal(isWithinCanonicalScope('https://sub.example.com/page', 'example.com'), false);
  });

  it('accepts a URL object for the candidate', () => {
    const url = new URL('https://example.com/about');
    assert.equal(isWithinCanonicalScope(url, 'example.com'), true);
  });

  it('is case-insensitive for the hostname', () => {
    assert.equal(isWithinCanonicalScope('https://EXAMPLE.COM/page', 'example.com'), true);
  });

  it('returns false when the candidate is on a sibling subdomain', () => {
    assert.equal(isWithinCanonicalScope('https://blog.example.com/', 'app.example.com'), false);
  });
});
