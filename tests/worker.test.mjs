/**
 * Tests for the Cloudflare Worker helper functions and the fetch handler.
 * The named exports (buildCorsHeaders, clampRequestedCount, normalizeDomainUrl)
 * are tested directly; the full request handler is tested via the default export.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

import worker, {
  buildCorsHeaders,
  clampRequestedCount,
  normalizeDomainUrl,
} from '../cloudflare/src/worker.js';

// ---------------------------------------------------------------------------
// buildCorsHeaders
// ---------------------------------------------------------------------------

describe('buildCorsHeaders', () => {
  it('returns wildcard origin when ALLOWED_ORIGIN is "*"', () => {
    const headers = buildCorsHeaders('https://example.com', { ALLOWED_ORIGIN: '*' });
    assert.equal(headers['Access-Control-Allow-Origin'], '*');
  });

  it('returns the request origin when ALLOWED_ORIGIN matches it', () => {
    const headers = buildCorsHeaders('https://mgifford.github.io', {
      ALLOWED_ORIGIN: 'https://mgifford.github.io',
    });
    assert.equal(headers['Access-Control-Allow-Origin'], 'https://mgifford.github.io');
  });

  it('always includes Access-Control-Allow-Methods', () => {
    const headers = buildCorsHeaders('*', { ALLOWED_ORIGIN: '*' });
    assert.ok(headers['Access-Control-Allow-Methods']);
    assert.ok(headers['Access-Control-Allow-Methods'].includes('POST'));
  });

  it('always includes Vary: Origin', () => {
    const headers = buildCorsHeaders('*', { ALLOWED_ORIGIN: '*' });
    assert.equal(headers['Vary'], 'Origin');
  });

  it('falls back to "*" when ALLOWED_ORIGIN is not set', () => {
    const headers = buildCorsHeaders('https://other.com', {});
    assert.equal(headers['Access-Control-Allow-Origin'], '*');
  });
});

// ---------------------------------------------------------------------------
// clampRequestedCount
// ---------------------------------------------------------------------------

describe('clampRequestedCount (worker)', () => {
  it('returns 100 for a non-integer string', () => {
    assert.equal(clampRequestedCount('abc'), 100);
  });

  it('returns 100 for a float', () => {
    assert.equal(clampRequestedCount(1.5), 100);
  });

  it('clamps to 200 for values above the maximum', () => {
    assert.equal(clampRequestedCount(999), 200);
  });

  it('clamps to 1 for zero', () => {
    assert.equal(clampRequestedCount(0), 1);
  });

  it('clamps to 1 for negative values', () => {
    assert.equal(clampRequestedCount(-5), 1);
  });

  it('passes through a valid integer within range', () => {
    assert.equal(clampRequestedCount(75), 75);
    assert.equal(clampRequestedCount(100), 100);
    assert.equal(clampRequestedCount(200), 200);
  });

  it('accepts numeric strings', () => {
    assert.equal(clampRequestedCount('50'), 50);
  });
});

// ---------------------------------------------------------------------------
// normalizeDomainUrl
// ---------------------------------------------------------------------------

describe('normalizeDomainUrl', () => {
  it('returns the origin for a bare domain', () => {
    assert.equal(normalizeDomainUrl('example.com'), 'https://example.com');
  });

  it('returns the origin for an https URL', () => {
    assert.equal(normalizeDomainUrl('https://example.com/path?q=1#frag'), 'https://example.com');
  });

  it('strips the path, query, and fragment', () => {
    const result = normalizeDomainUrl('https://example.com/path?q=1#frag');
    assert.ok(!result.includes('/path'));
    assert.ok(!result.includes('?'));
    assert.ok(!result.includes('#'));
  });

  it('throws for an empty string', () => {
    assert.throws(() => normalizeDomainUrl(''), /domainUrl is required/);
  });

  it('throws for null/undefined', () => {
    assert.throws(() => normalizeDomainUrl(null), /domainUrl is required/);
    assert.throws(() => normalizeDomainUrl(undefined), /domainUrl is required/);
  });

  it('trims surrounding whitespace before processing', () => {
    assert.equal(normalizeDomainUrl('  example.com  '), 'https://example.com');
  });
});

// ---------------------------------------------------------------------------
// Worker fetch handler
// ---------------------------------------------------------------------------

describe('worker fetch handler', () => {
  // We need to mock the global fetch used by dispatchGithubWorkflow.
  let originalFetch;

  before(() => {
    originalFetch = globalThis.fetch;
  });

  after(() => {
    globalThis.fetch = originalFetch;
  });

  const minimalEnv = {
    ALLOWED_ORIGIN: '*',
    GITHUB_OWNER: 'test-owner',
    GITHUB_REPO: 'test-repo',
    GITHUB_TOKEN: 'test-token',
    GITHUB_WORKFLOW_FILE: 'cache-refresh.yml',
    GITHUB_WORKFLOW_REF: 'main',
  };

  it('responds 204 to an OPTIONS preflight request', async () => {
    const request = new Request('https://worker.example.com/trigger-crawl', {
      method: 'OPTIONS',
    });
    const response = await worker.fetch(request, minimalEnv);
    assert.equal(response.status, 204);
  });

  it('responds 404 for a GET to an unknown path', async () => {
    const request = new Request('https://worker.example.com/unknown', {
      method: 'GET',
    });
    const response = await worker.fetch(request, minimalEnv);
    assert.equal(response.status, 404);
    const body = await response.json();
    assert.ok(body.error);
  });

  it('responds 404 for a POST to a path other than /trigger-crawl', async () => {
    const request = new Request('https://worker.example.com/other-path', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domainUrl: 'example.com', requestedCount: 100 }),
    });
    const response = await worker.fetch(request, minimalEnv);
    assert.equal(response.status, 404);
  });

  it('dispatches the workflow and returns 202 for a valid POST', async () => {
    // Capture the outbound GitHub API request to verify it is correctly formed
    let capturedUrl;
    let capturedInit;
    globalThis.fetch = async (url, init) => {
      capturedUrl = url;
      capturedInit = init;
      return new Response(null, { status: 204 });
    };

    const request = new Request('https://worker.example.com/trigger-crawl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domainUrl: 'https://example.com', requestedCount: 100 }),
    });
    const response = await worker.fetch(request, minimalEnv);
    assert.equal(response.status, 202);
    const body = await response.json();
    assert.equal(body.accepted, true);

    // Verify the GitHub API request was correctly formed
    assert.equal(new URL(capturedUrl).hostname, 'api.github.com', 'should call GitHub API');
    assert.ok(capturedUrl.endsWith('/dispatches'), 'should target dispatches endpoint');
    assert.ok(capturedUrl.indexOf('test-owner/test-repo') !== -1, 'should target correct repo');
    assert.ok(capturedUrl.indexOf('cache-refresh.yml') !== -1, 'should target correct workflow');
    assert.equal(capturedInit.method, 'POST');
    assert.equal(capturedInit.headers?.Authorization, 'Bearer test-token', 'should include Bearer token');
    const dispatchBody = JSON.parse(capturedInit.body);
    assert.equal(dispatchBody.inputs.domain_url, 'https://example.com');
    assert.equal(dispatchBody.inputs.requested_count, '100');
  });

  it('returns 500 when domainUrl is missing from the request body', async () => {
    const request = new Request('https://worker.example.com/trigger-crawl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestedCount: 100 }),
    });
    const response = await worker.fetch(request, minimalEnv);
    assert.equal(response.status, 500);
    const body = await response.json();
    assert.ok(body.error);
  });

  it('returns 500 when the GitHub dispatch fails', async () => {
    // Capture the request and simulate a GitHub API error
    let capturedUrl;
    globalThis.fetch = async (url) => {
      capturedUrl = url;
      return new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' });
    };

    const request = new Request('https://worker.example.com/trigger-crawl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domainUrl: 'https://example.com', requestedCount: 50 }),
    });
    const response = await worker.fetch(request, minimalEnv);
    assert.equal(response.status, 500);
    const body = await response.json();
    assert.ok(body.error.includes('401'), `expected "401" in error, got: ${body.error}`);
    // Verify the request was still directed at the GitHub API
    assert.equal(new URL(capturedUrl).hostname, 'api.github.com', 'should have called GitHub API before failing');
  });

  it('returns 500 when GITHUB_TOKEN is missing from env', async () => {
    const envWithoutToken = {
      ALLOWED_ORIGIN: '*',
      GITHUB_OWNER: 'test-owner',
      GITHUB_REPO: 'test-repo',
    };
    const request = new Request('https://worker.example.com/trigger-crawl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domainUrl: 'https://example.com', requestedCount: 100 }),
    });
    const response = await worker.fetch(request, envWithoutToken);
    assert.equal(response.status, 500);
  });

  it('returns JSON content-type on all responses', async () => {
    const request = new Request('https://worker.example.com/unknown', { method: 'GET' });
    const response = await worker.fetch(request, minimalEnv);
    assert.ok(response.headers.get('Content-Type')?.includes('application/json'));
  });

  it('sets CORS headers on all responses', async () => {
    const request = new Request('https://worker.example.com/unknown', { method: 'GET' });
    const response = await worker.fetch(request, minimalEnv);
    assert.ok(response.headers.get('Access-Control-Allow-Origin'));
  });
});
