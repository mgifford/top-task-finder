/**
 * Tests for pure utility functions in scripts/build-cache.mjs.
 * These functions handle URL normalisation, scoring, de-duplication, and
 * diversity enforcement – all without any I/O or browser-specific APIs.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseArgs,
  canonicalizeHost,
  normalizeInputUrl,
  clampRequestedCount,
  buildNormalizedKey,
  isWithinCanonicalScope,
  isLikelyHtmlUrl,
  detectPrioritySignals,
  stripTrackingParams,
  scoreCandidateUrl,
  extractXmlLocValues,
  xmlLooksLikeSitemapIndex,
  extractHrefValues,
  extractPrioritizedLinks,
  normalizeAndScoreCandidates,
  aggregatePriorityCoverage,
  deduplicateYearBasedUrls,
  applyUrlDiversityLimits,
  ensureCriticalPages,
  buildDiscoverySummary,
  slugForTarget,
  DEFAULT_REQUESTED_COUNT,
  MAX_REQUESTED_COUNT,
  SOURCE_BASE_WEIGHTS,
} from '../scripts/build-cache.mjs';

// ---------------------------------------------------------------------------
// parseArgs
// ---------------------------------------------------------------------------

describe('parseArgs', () => {
  it('parses key-value pairs', () => {
    const result = parseArgs(['node', 'script', '--domain-url', 'example.com', '--out', 'cache']);
    assert.deepEqual(result, { 'domain-url': 'example.com', out: 'cache' });
  });

  it('treats a flag with no following value as "true"', () => {
    const result = parseArgs(['node', 'script', '--verbose']);
    assert.deepEqual(result, { verbose: 'true' });
  });

  it('treats a flag followed by another flag as "true"', () => {
    const result = parseArgs(['node', 'script', '--verbose', '--out', 'cache']);
    assert.deepEqual(result, { verbose: 'true', out: 'cache' });
  });

  it('ignores non-flag positional arguments', () => {
    const result = parseArgs(['node', 'script', 'positional', '--key', 'val']);
    assert.deepEqual(result, { key: 'val' });
  });

  it('returns empty object when there are no extra args', () => {
    assert.deepEqual(parseArgs(['node', 'script']), {});
  });

  it('handles a trailing boolean flag after a key-value pair', () => {
    const result = parseArgs(['node', 'script', '--out', 'cache', '--dry-run']);
    assert.equal(result.out, 'cache');
    assert.equal(result['dry-run'], 'true');
  });
});

// ---------------------------------------------------------------------------
// canonicalizeHost
// ---------------------------------------------------------------------------

describe('canonicalizeHost', () => {
  it('strips www. prefix', () => {
    assert.equal(canonicalizeHost('www.example.com'), 'example.com');
  });

  it('lowercases the hostname', () => {
    assert.equal(canonicalizeHost('EXAMPLE.COM'), 'example.com');
  });

  it('handles null gracefully', () => {
    assert.equal(canonicalizeHost(null), '');
  });

  it('handles undefined gracefully', () => {
    assert.equal(canonicalizeHost(undefined), '');
  });

  it('does not strip non-www subdomains', () => {
    assert.equal(canonicalizeHost('app.example.com'), 'app.example.com');
  });

  it('handles an empty string', () => {
    assert.equal(canonicalizeHost(''), '');
  });
});

// ---------------------------------------------------------------------------
// normalizeInputUrl
// ---------------------------------------------------------------------------

describe('normalizeInputUrl', () => {
  it('prepends https:// when no protocol is provided', () => {
    const result = normalizeInputUrl('example.com');
    assert.equal(result.protocol, 'https:');
    assert.equal(result.hostname, 'example.com');
  });

  it('accepts an explicit https:// URL unchanged', () => {
    const result = normalizeInputUrl('https://example.com/path');
    assert.equal(result.protocol, 'https:');
    assert.equal(result.pathname, '/path');
  });

  it('strips the www. prefix from the hostname', () => {
    const result = normalizeInputUrl('https://www.example.com/');
    assert.equal(result.hostname, 'example.com');
  });

  it('removes the hash fragment', () => {
    const result = normalizeInputUrl('https://example.com/page#section');
    assert.equal(result.hash, '');
  });

  it('throws for an empty string', () => {
    assert.throws(() => normalizeInputUrl(''), /domainUrl is required/);
  });

  it('throws for null', () => {
    assert.throws(() => normalizeInputUrl(null), /domainUrl is required/);
  });

  it('preserves query parameters', () => {
    const result = normalizeInputUrl('https://example.com/search?q=a11y');
    assert.equal(result.search, '?q=a11y');
  });
});

// ---------------------------------------------------------------------------
// clampRequestedCount
// ---------------------------------------------------------------------------

describe('clampRequestedCount', () => {
  it('returns DEFAULT_REQUESTED_COUNT for a non-numeric string', () => {
    assert.equal(clampRequestedCount('abc'), DEFAULT_REQUESTED_COUNT);
  });

  it('returns DEFAULT_REQUESTED_COUNT for a float', () => {
    assert.equal(clampRequestedCount('1.5'), DEFAULT_REQUESTED_COUNT);
  });

  it('returns DEFAULT_REQUESTED_COUNT for zero', () => {
    assert.equal(clampRequestedCount(0), DEFAULT_REQUESTED_COUNT);
  });

  it('returns DEFAULT_REQUESTED_COUNT for negative values', () => {
    assert.equal(clampRequestedCount(-10), DEFAULT_REQUESTED_COUNT);
  });

  it('clamps to MAX_REQUESTED_COUNT when value is too large', () => {
    assert.equal(clampRequestedCount(9999), MAX_REQUESTED_COUNT);
  });

  it('passes through a valid integer count', () => {
    assert.equal(clampRequestedCount(50), 50);
    assert.equal(clampRequestedCount(100), 100);
  });

  it('accepts a numeric string', () => {
    assert.equal(clampRequestedCount('75'), 75);
  });

  it('accepts MAX_REQUESTED_COUNT exactly', () => {
    assert.equal(clampRequestedCount(MAX_REQUESTED_COUNT), MAX_REQUESTED_COUNT);
  });
});

// ---------------------------------------------------------------------------
// buildNormalizedKey
// ---------------------------------------------------------------------------

describe('buildNormalizedKey', () => {
  it('strips a trailing slash from the path', () => {
    assert.equal(buildNormalizedKey('https://example.com/path/'), 'example.com/path');
  });

  it('keeps the root path as /', () => {
    assert.equal(buildNormalizedKey('https://example.com/'), 'example.com/');
  });

  it('strips www. from the hostname', () => {
    assert.equal(buildNormalizedKey('https://www.example.com/page'), 'example.com/page');
  });

  it('includes the query string', () => {
    assert.equal(buildNormalizedKey('https://example.com/search?q=test'), 'example.com/search?q=test');
  });

  it('accepts a URL object (with .href)', () => {
    const url = new URL('https://example.com/about');
    assert.equal(buildNormalizedKey(url), 'example.com/about');
  });
});

// ---------------------------------------------------------------------------
// isWithinCanonicalScope
// ---------------------------------------------------------------------------

describe('isWithinCanonicalScope', () => {
  it('returns true for exactly the same host', () => {
    assert.equal(isWithinCanonicalScope('https://example.com/page', 'example.com'), true);
  });

  it('returns true when www. variant matches the canonical host', () => {
    assert.equal(isWithinCanonicalScope('https://www.example.com/page', 'example.com'), true);
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
});

// ---------------------------------------------------------------------------
// isLikelyHtmlUrl
// ---------------------------------------------------------------------------

describe('isLikelyHtmlUrl', () => {
  it('returns true for a plain path with no extension', () => {
    assert.equal(isLikelyHtmlUrl('https://example.com/about'), true);
  });

  it('returns true for the root path', () => {
    assert.equal(isLikelyHtmlUrl('https://example.com/'), true);
  });

  it('returns false for common image extensions', () => {
    for (const ext of ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico']) {
      assert.equal(isLikelyHtmlUrl(`https://example.com/image.${ext}`), false, `expected false for .${ext}`);
    }
  });

  it('returns false for document/data file extensions', () => {
    for (const ext of ['pdf', 'doc', 'docx', 'xlsx', 'xls', 'pptx', 'zip', 'csv', 'json']) {
      assert.equal(isLikelyHtmlUrl(`https://example.com/file.${ext}`), false, `expected false for .${ext}`);
    }
  });

  it('returns false for XML files', () => {
    assert.equal(isLikelyHtmlUrl('https://example.com/sitemap.xml'), false);
  });

  it('returns false for RSS/Atom feed paths', () => {
    assert.equal(isLikelyHtmlUrl('https://example.com/feed'), false);
    assert.equal(isLikelyHtmlUrl('https://example.com/rss'), false);
    assert.equal(isLikelyHtmlUrl('https://example.com/atom/'), false);
    assert.equal(isLikelyHtmlUrl('https://example.com/blog/feed/'), false);
  });

  it('returns true for media-style paths that do not end in a media extension', () => {
    assert.equal(isLikelyHtmlUrl('https://example.com/media-releases'), true);
  });

  it('is case-insensitive for extensions', () => {
    assert.equal(isLikelyHtmlUrl('https://example.com/photo.JPG'), false);
    assert.equal(isLikelyHtmlUrl('https://example.com/doc.PDF'), false);
  });
});

// ---------------------------------------------------------------------------
// detectPrioritySignals
// ---------------------------------------------------------------------------

describe('detectPrioritySignals', () => {
  it('detects the homepage at /', () => {
    assert.equal(detectPrioritySignals('/').homepage, true);
  });

  it('detects the homepage for an empty string', () => {
    assert.equal(detectPrioritySignals('').homepage, true);
  });

  it('does not flag non-root paths as homepage', () => {
    assert.equal(detectPrioritySignals('/about').homepage, false);
  });

  it('detects /search as a search page', () => {
    assert.equal(detectPrioritySignals('/search').search, true);
  });

  it('detects /search/results as a search page', () => {
    assert.equal(detectPrioritySignals('/search/results').search, true);
  });

  it('detects a path containing "find" as a search page', () => {
    assert.equal(detectPrioritySignals('/find-services').search, true);
  });

  it('does not flag /about as a search page', () => {
    assert.equal(detectPrioritySignals('/about').search, false);
  });

  it('detects English accessibility path', () => {
    assert.equal(detectPrioritySignals('/accessibility').accessibility, true);
    assert.equal(detectPrioritySignals('/a11y').accessibility, true);
  });

  it('detects French accessibility path (accessibilite)', () => {
    assert.equal(detectPrioritySignals('/accessibilite').accessibility, true);
  });

  it('detects German accessibility path (barrierefreiheit)', () => {
    assert.equal(detectPrioritySignals('/barrierefreiheit').accessibility, true);
  });

  it('detects Spanish accessibility path (accesibilidad)', () => {
    assert.equal(detectPrioritySignals('/accesibilidad').accessibility, true);
  });

  it('does not flag /about as an accessibility page', () => {
    assert.equal(detectPrioritySignals('/about').accessibility, false);
  });

  it('detects top-task service/action paths', () => {
    for (const segment of ['services', 'apply', 'register', 'renew', 'book', 'report', 'request', 'pay']) {
      assert.equal(detectPrioritySignals(`/${segment}`).topTask, true, `expected topTask for /${segment}`);
    }
  });

  it('does not flag /about as a top-task page', () => {
    assert.equal(detectPrioritySignals('/about').topTask, false);
  });

  it('detects /contact', () => {
    assert.equal(detectPrioritySignals('/contact').contact, true);
    assert.equal(detectPrioritySignals('/contact/form').contact, true);
    // hyphenated variant is not matched by the exact-segment regex
    assert.equal(detectPrioritySignals('/contact-us').contact, false);
  });

  it('detects /about', () => {
    assert.equal(detectPrioritySignals('/about').about, true);
  });

  it('detects /help and /support and /faq paths', () => {
    assert.equal(detectPrioritySignals('/help').help, true);
    assert.equal(detectPrioritySignals('/support').help, true);
    assert.equal(detectPrioritySignals('/faq').help, true);
  });

  it('detects /resources path', () => {
    assert.equal(detectPrioritySignals('/resources').resources, true);
    assert.equal(detectPrioritySignals('/resource').resources, true);
  });
});

// ---------------------------------------------------------------------------
// stripTrackingParams
// ---------------------------------------------------------------------------

describe('stripTrackingParams', () => {
  it('removes utm_* parameters', () => {
    const url = new URL('https://example.com/page?utm_source=google&utm_medium=email&id=123');
    stripTrackingParams(url);
    assert.equal(url.searchParams.has('utm_source'), false);
    assert.equal(url.searchParams.has('utm_medium'), false);
    assert.equal(url.searchParams.get('id'), '123');
  });

  it('removes fbclid and gclid', () => {
    const url = new URL('https://example.com/?fbclid=abc&gclid=xyz&page=1');
    stripTrackingParams(url);
    assert.equal(url.searchParams.has('fbclid'), false);
    assert.equal(url.searchParams.has('gclid'), false);
    assert.equal(url.searchParams.get('page'), '1');
  });

  it('removes msclkid', () => {
    const url = new URL('https://example.com/?msclkid=foo&q=bar');
    stripTrackingParams(url);
    assert.equal(url.searchParams.has('msclkid'), false);
    assert.equal(url.searchParams.get('q'), 'bar');
  });

  it('leaves non-tracking parameters intact', () => {
    const url = new URL('https://example.com/?q=search&lang=fr');
    stripTrackingParams(url);
    assert.equal(url.searchParams.get('q'), 'search');
    assert.equal(url.searchParams.get('lang'), 'fr');
  });

  it('handles a URL with no query string', () => {
    const url = new URL('https://example.com/page');
    stripTrackingParams(url);
    assert.equal(url.search, '');
  });
});

// ---------------------------------------------------------------------------
// scoreCandidateUrl
// ---------------------------------------------------------------------------

describe('scoreCandidateUrl', () => {
  it('gives a homepage a higher score than a deep page', () => {
    const homepage = scoreCandidateUrl(new URL('https://example.com/'), 'sitemap');
    const deep = scoreCandidateUrl(new URL('https://example.com/a/b/c/d'), 'sitemap');
    assert.ok(homepage.score > deep.score, 'homepage should score higher than deep page');
  });

  it('gives a sitemap source a higher base weight than homepage-fallback', () => {
    const sitemap = scoreCandidateUrl(new URL('https://example.com/about'), 'sitemap');
    const fallback = scoreCandidateUrl(new URL('https://example.com/about'), 'homepage-fallback');
    assert.ok(sitemap.score > fallback.score, 'sitemap weight should exceed homepage-fallback');
  });

  it('boosts an accessibility page over an ordinary page', () => {
    const regular = scoreCandidateUrl(new URL('https://example.com/news'), 'sitemap');
    const a11y = scoreCandidateUrl(new URL('https://example.com/accessibility'), 'sitemap');
    assert.ok(a11y.score > regular.score, 'accessibility page should score higher');
  });

  it('uses SOURCE_BASE_WEIGHTS.unknown for an unrecognised source', () => {
    const result = scoreCandidateUrl(new URL('https://example.com/about'), 'mystery-source');
    const unknownBase = SOURCE_BASE_WEIGHTS.unknown;
    assert.ok(result.score >= unknownBase, 'score should include at least the unknown base weight');
  });

  it('returns prioritySignals with the correct shape', () => {
    const result = scoreCandidateUrl(new URL('https://example.com/search'), 'sitemap');
    assert.ok('homepage' in result.prioritySignals);
    assert.ok('search' in result.prioritySignals);
    assert.ok('accessibility' in result.prioritySignals);
    assert.ok('topTask' in result.prioritySignals);
    assert.equal(result.prioritySignals.search, true);
  });

  it('penalises deeper paths with lower depthWeight', () => {
    const shallow = scoreCandidateUrl(new URL('https://example.com/about'), 'sitemap');
    const deep = scoreCandidateUrl(new URL('https://example.com/a/b/c/d/e/f/g'), 'sitemap');
    assert.ok(shallow.score > deep.score);
  });

  it('boosts a contact page over an ordinary page', () => {
    const ordinary = scoreCandidateUrl(new URL('https://example.com/news'), 'sitemap');
    const contact = scoreCandidateUrl(new URL('https://example.com/contact'), 'sitemap');
    assert.ok(contact.score > ordinary.score, 'contact page should score higher');
    assert.equal(contact.prioritySignals.contact, true);
  });

  it('boosts an about page over an ordinary page', () => {
    const ordinary = scoreCandidateUrl(new URL('https://example.com/news'), 'sitemap');
    const about = scoreCandidateUrl(new URL('https://example.com/about'), 'sitemap');
    assert.ok(about.score > ordinary.score, 'about page should score higher');
    assert.equal(about.prioritySignals.about, true);
  });

  it('boosts a help/support page over an ordinary page', () => {
    const ordinary = scoreCandidateUrl(new URL('https://example.com/news'), 'sitemap');
    const help = scoreCandidateUrl(new URL('https://example.com/help'), 'sitemap');
    assert.ok(help.score > ordinary.score, 'help page should score higher');
    assert.equal(help.prioritySignals.help, true);
  });

  it('boosts a resources page over an ordinary page', () => {
    const ordinary = scoreCandidateUrl(new URL('https://example.com/news'), 'sitemap');
    const resources = scoreCandidateUrl(new URL('https://example.com/resources'), 'sitemap');
    assert.ok(resources.score > ordinary.score, 'resources page should score higher');
    assert.equal(resources.prioritySignals.resources, true);
  });
});

// ---------------------------------------------------------------------------
// extractXmlLocValues
// ---------------------------------------------------------------------------

describe('extractXmlLocValues', () => {
  it('extracts URLs from <loc> tags', () => {
    const xml = `<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc></url>
  <url><loc>https://example.com/about</loc></url>
</urlset>`;
    const result = extractXmlLocValues(xml);
    assert.deepEqual(result, ['https://example.com/', 'https://example.com/about']);
  });

  it('trims whitespace around the URL value', () => {
    const xml = '<urlset><url><loc>  https://example.com/page  </loc></url></urlset>';
    const result = extractXmlLocValues(xml);
    assert.deepEqual(result, ['https://example.com/page']);
  });

  it('returns an empty array when there are no <loc> tags', () => {
    assert.deepEqual(extractXmlLocValues('<urlset></urlset>'), []);
  });

  it('handles upper-case <LOC> tags (case-insensitive match)', () => {
    const xml = '<urlset><url><LOC>https://example.com/upper</LOC></url></urlset>';
    const result = extractXmlLocValues(xml);
    assert.deepEqual(result, ['https://example.com/upper']);
  });

  it('extracts multiple URLs from a sitemap index', () => {
    const xml = `<sitemapindex>
  <sitemap><loc>https://example.com/sitemap-news.xml</loc></sitemap>
  <sitemap><loc>https://example.com/sitemap-pages.xml</loc></sitemap>
</sitemapindex>`;
    const result = extractXmlLocValues(xml);
    assert.equal(result.length, 2);
    assert.ok(result.includes('https://example.com/sitemap-news.xml'));
  });
});

// ---------------------------------------------------------------------------
// xmlLooksLikeSitemapIndex
// ---------------------------------------------------------------------------

describe('xmlLooksLikeSitemapIndex', () => {
  it('returns true for a <sitemapindex> root element', () => {
    assert.equal(xmlLooksLikeSitemapIndex('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'), true);
    assert.equal(xmlLooksLikeSitemapIndex('<sitemapindex>'), true);
  });

  it('returns false for a regular <urlset>', () => {
    assert.equal(xmlLooksLikeSitemapIndex('<urlset>...</urlset>'), false);
  });

  it('is case-insensitive', () => {
    assert.equal(xmlLooksLikeSitemapIndex('<SitemapIndex>'), true);
    assert.equal(xmlLooksLikeSitemapIndex('<SITEMAPINDEX>'), true);
  });

  it('returns false for arbitrary XML', () => {
    assert.equal(xmlLooksLikeSitemapIndex('<root><child/></root>'), false);
  });
});

// ---------------------------------------------------------------------------
// extractHrefValues
// ---------------------------------------------------------------------------

describe('extractHrefValues', () => {
  it('extracts absolute URLs from <a href="..."> tags', () => {
    const html = '<a href="https://example.com/about">About</a>';
    const result = extractHrefValues(html, 'https://example.com');
    assert.deepEqual(result, ['https://example.com/about']);
  });

  it('resolves relative URLs against the base URL', () => {
    const html = '<a href="/contact">Contact</a>';
    const result = extractHrefValues(html, 'https://example.com');
    assert.deepEqual(result, ['https://example.com/contact']);
  });

  it('ignores hash-only hrefs', () => {
    const html = '<a href="#section">Jump</a>';
    const result = extractHrefValues(html, 'https://example.com');
    assert.equal(result.length, 0);
  });

  it('extracts multiple links from a page', () => {
    const html = `
      <a href="/page1">P1</a>
      <a href="/page2">P2</a>
      <a href="https://other.com/page">External</a>
    `;
    const result = extractHrefValues(html, 'https://example.com');
    assert.deepEqual(result.sort(), [
      'https://example.com/page1',
      'https://example.com/page2',
      'https://other.com/page',
    ].sort());
  });

  it('handles a link with additional attributes before href', () => {
    const html = '<a class="nav-link" href="/nav-page">Nav</a>';
    const result = extractHrefValues(html, 'https://example.com');
    assert.deepEqual(result, ['https://example.com/nav-page']);
  });

  it('returns an empty array for HTML with no anchor tags', () => {
    assert.deepEqual(extractHrefValues('<p>No links here</p>', 'https://example.com'), []);
  });
});

// ---------------------------------------------------------------------------
// extractPrioritizedLinks
// ---------------------------------------------------------------------------

describe('extractPrioritizedLinks', () => {
  it('returns footerLinks, navLinks, otherLinks, and allLinks', () => {
    const html = `
      <nav><a href="/nav-page">Nav</a></nav>
      <footer><a href="/footer-page">Footer</a></footer>
      <a href="/other-page">Other</a>
    `;
    const result = extractPrioritizedLinks(html, 'https://example.com');
    assert.ok(Array.isArray(result.footerLinks));
    assert.ok(Array.isArray(result.navLinks));
    assert.ok(Array.isArray(result.otherLinks));
    assert.ok(Array.isArray(result.allLinks));
  });

  it('places footer links in footerLinks and not navLinks/otherLinks', () => {
    const html = '<footer><a href="/footer">Footer link</a></footer>';
    const result = extractPrioritizedLinks(html, 'https://example.com');
    assert.ok(result.footerLinks.some((u) => u.includes('/footer')));
    assert.equal(result.navLinks.filter((u) => u.includes('/footer')).length, 0);
    assert.equal(result.otherLinks.filter((u) => u.includes('/footer')).length, 0);
  });

  it('places nav links in navLinks and not footerLinks', () => {
    const html = '<nav><a href="/nav">Nav link</a></nav>';
    const result = extractPrioritizedLinks(html, 'https://example.com');
    assert.ok(result.navLinks.some((u) => u.includes('/nav')));
    assert.equal(result.footerLinks.filter((u) => u.includes('/nav')).length, 0);
  });

  it('allLinks is footer + nav + other (in that order, de-duped)', () => {
    const html = `
      <footer><a href="/footer">F</a></footer>
      <nav><a href="/nav">N</a></nav>
      <a href="/other">O</a>
    `;
    const result = extractPrioritizedLinks(html, 'https://example.com');
    assert.equal(result.allLinks.length, result.footerLinks.length + result.navLinks.length + result.otherLinks.length);
  });
});

// ---------------------------------------------------------------------------
// normalizeAndScoreCandidates
// ---------------------------------------------------------------------------

describe('normalizeAndScoreCandidates', () => {
  it('returns an empty array for no candidates', () => {
    assert.deepEqual(normalizeAndScoreCandidates([], 'example.com'), []);
  });

  it('deduplicates the same URL from different sources, keeping the higher score', () => {
    const candidates = [
      { url: 'https://example.com/page', source: 'sitemap' },
      { url: 'https://example.com/page', source: 'homepage-fallback' },
    ];
    const result = normalizeAndScoreCandidates(candidates, 'example.com');
    assert.equal(result.length, 1);
    assert.equal(result[0].source, 'sitemap');
  });

  it('filters out non-HTML URLs', () => {
    const candidates = [
      { url: 'https://example.com/page', source: 'sitemap' },
      { url: 'https://example.com/file.pdf', source: 'sitemap' },
      { url: 'https://example.com/image.png', source: 'sitemap' },
    ];
    const result = normalizeAndScoreCandidates(candidates, 'example.com');
    assert.equal(result.length, 1);
    assert.ok(result[0].url.endsWith('/page'));
  });

  it('filters out URLs outside the canonical host', () => {
    const candidates = [
      { url: 'https://example.com/page', source: 'sitemap' },
      { url: 'https://other.com/page', source: 'sitemap' },
    ];
    const result = normalizeAndScoreCandidates(candidates, 'example.com');
    assert.equal(result.length, 1);
    assert.equal(new URL(result[0].url).hostname, 'example.com');
  });

  it('sorts results by score descending (homepage first)', () => {
    const candidates = [
      { url: 'https://example.com/deep/page/here', source: 'sitemap' },
      { url: 'https://example.com/', source: 'sitemap' },
    ];
    const result = normalizeAndScoreCandidates(candidates, 'example.com');
    assert.equal(result[0].url, 'https://example.com/');
  });

  it('strips tracking params during normalisation', () => {
    const candidates = [
      { url: 'https://example.com/page?utm_source=google', source: 'sitemap' },
      { url: 'https://example.com/page', source: 'homepage-fallback' },
    ];
    const result = normalizeAndScoreCandidates(candidates, 'example.com');
    assert.equal(result.length, 1);
    assert.ok(!result[0].url.includes('utm_source'));
  });

  it('treats www. variant as in-scope for the canonical host', () => {
    const candidates = [
      { url: 'https://www.example.com/page', source: 'sitemap' },
    ];
    const result = normalizeAndScoreCandidates(candidates, 'example.com');
    assert.equal(result.length, 1);
  });

  it('skips candidates with missing or invalid URLs', () => {
    const candidates = [
      { url: null, source: 'sitemap' },
      { url: 'not-a-url', source: 'sitemap' },
      { url: 'https://example.com/valid', source: 'sitemap' },
    ];
    const result = normalizeAndScoreCandidates(candidates, 'example.com');
    assert.equal(result.length, 1);
  });
});

// ---------------------------------------------------------------------------
// aggregatePriorityCoverage
// ---------------------------------------------------------------------------

describe('aggregatePriorityCoverage', () => {
  it('returns all false for an empty candidate list', () => {
    const result = aggregatePriorityCoverage([]);
    assert.equal(result.homepage, false);
    assert.equal(result.search, false);
    assert.equal(result.accessibility, false);
    assert.equal(result.topTask, false);
  });

  it('detects homepage coverage', () => {
    const candidates = [
      { prioritySignals: { homepage: true, search: false, accessibility: false, topTask: false } },
    ];
    const result = aggregatePriorityCoverage(candidates);
    assert.equal(result.homepage, true);
    assert.equal(result.search, false);
  });

  it('aggregates true values across multiple candidates', () => {
    const candidates = [
      { prioritySignals: { homepage: true, search: false, accessibility: false, topTask: false } },
      { prioritySignals: { homepage: false, search: true, accessibility: false, topTask: false } },
      { prioritySignals: { homepage: false, search: false, accessibility: true, topTask: false } },
    ];
    const result = aggregatePriorityCoverage(candidates);
    assert.equal(result.homepage, true);
    assert.equal(result.search, true);
    assert.equal(result.accessibility, true);
    assert.equal(result.topTask, false);
  });

  it('handles candidates with undefined prioritySignals', () => {
    const candidates = [{ prioritySignals: undefined }];
    const result = aggregatePriorityCoverage(candidates);
    assert.equal(result.homepage, false);
  });

  it('includes contact, about, help, resources fields', () => {
    const candidates = [
      { prioritySignals: { contact: true, about: false, help: false, resources: true } },
    ];
    const result = aggregatePriorityCoverage(candidates);
    assert.equal(result.contact, true);
    assert.equal(result.resources, true);
    assert.equal(result.about, false);
  });
});

// ---------------------------------------------------------------------------
// deduplicateYearBasedUrls
// ---------------------------------------------------------------------------

describe('deduplicateYearBasedUrls', () => {
  it('keeps all URLs that contain no year patterns', () => {
    const candidates = [
      { url: 'https://example.com/about', score: 50 },
      { url: 'https://example.com/contact', score: 40 },
    ];
    const result = deduplicateYearBasedUrls(candidates, 3);
    assert.equal(result.length, 2);
  });

  it('limits year-based URL groups to maxRecentItems', () => {
    const candidates = [
      { url: 'https://example.com/news/2024/article', score: 50 },
      { url: 'https://example.com/news/2023/article', score: 50 },
      { url: 'https://example.com/news/2022/article', score: 50 },
      { url: 'https://example.com/news/2021/article', score: 50 },
    ];
    const result = deduplicateYearBasedUrls(candidates, 3);
    assert.equal(result.length, 3);
  });

  it('keeps the most recent years when trimming', () => {
    const candidates = [
      { url: 'https://example.com/report/2018', score: 50 },
      { url: 'https://example.com/report/2020', score: 50 },
      { url: 'https://example.com/report/2024', score: 50 },
      { url: 'https://example.com/report/2022', score: 50 },
    ];
    const result = deduplicateYearBasedUrls(candidates, 2);
    const urls = result.map((c) => c.url);
    assert.equal(urls.indexOf('https://example.com/report/2024') !== -1, true, '2024 should be kept');
    assert.equal(urls.indexOf('https://example.com/report/2022') !== -1, true, '2022 should be kept');
    assert.equal(urls.indexOf('https://example.com/report/2018'), -1, '2018 should be dropped');
  });

  it('keeps all items when count is within maxRecentItems', () => {
    const candidates = [
      { url: 'https://example.com/news/2024/item', score: 50 },
      { url: 'https://example.com/news/2023/item', score: 40 },
    ];
    const result = deduplicateYearBasedUrls(candidates, 3);
    assert.equal(result.length, 2);
  });

  it('treats URLs with different patterns independently', () => {
    const candidates = [
      { url: 'https://example.com/news/2024/item', score: 50 },
      { url: 'https://example.com/reports/2024/doc', score: 50 },
    ];
    const result = deduplicateYearBasedUrls(candidates, 1);
    // They have different patterns so each group keeps 1
    assert.equal(result.length, 2);
  });
});

// ---------------------------------------------------------------------------
// applyUrlDiversityLimits
// ---------------------------------------------------------------------------

describe('applyUrlDiversityLimits', () => {
  it('always includes homepage candidates', () => {
    const candidates = [
      {
        url: 'https://example.com/',
        score: 90,
        prioritySignals: { homepage: true, search: false },
      },
    ];
    const { selected } = applyUrlDiversityLimits(candidates);
    assert.equal(selected.length, 1);
  });

  it('always includes search candidates', () => {
    const candidates = [
      {
        url: 'https://example.com/search',
        score: 85,
        prioritySignals: { homepage: false, search: true },
      },
    ];
    const { selected } = applyUrlDiversityLimits(candidates);
    assert.equal(selected.length, 1);
  });

  it('returns selected and skipped arrays', () => {
    const candidates = [
      { url: 'https://example.com/page', score: 50, prioritySignals: { homepage: false, search: false } },
    ];
    const result = applyUrlDiversityLimits(candidates);
    assert.ok(Array.isArray(result.selected));
    assert.ok(Array.isArray(result.skipped));
  });

  it('enforces the MAX_FIRST_SEGMENT limit (15 per first segment)', () => {
    const candidates = Array.from({ length: 20 }, (_, i) => ({
      url: `https://example.com/blog/post-${i}`,
      score: 50 - i,
      prioritySignals: { homepage: false, search: false },
    }));
    const { selected, skipped } = applyUrlDiversityLimits(candidates);
    assert.ok(selected.length <= 15, `selected.length (${selected.length}) should be ≤ 15`);
    assert.ok(skipped.length >= 5, `skipped.length (${skipped.length}) should be ≥ 5`);
  });

  it('enforces the MAX_DEPTH3_PREFIX limit (3 per 3-segment prefix)', () => {
    const candidates = Array.from({ length: 6 }, (_, i) => ({
      url: `https://example.com/gov/health/services/item-${i}`,
      score: 50 - i,
      prioritySignals: { homepage: false, search: false },
    }));
    const { selected } = applyUrlDiversityLimits(candidates);
    const withPrefix = selected.filter((c) => c.url.includes('/gov/health/services'));
    assert.ok(withPrefix.length <= 3, `URLs with same depth-3 prefix should be ≤ 3, got ${withPrefix.length}`);
  });

  it('returns skipped URLs for potential backfill', () => {
    const candidates = Array.from({ length: 20 }, (_, i) => ({
      url: `https://example.com/section/page-${i}`,
      score: 50 - i,
      prioritySignals: { homepage: false, search: false },
    }));
    const { skipped } = applyUrlDiversityLimits(candidates);
    assert.ok(skipped.length > 0);
  });

  it('enforces the MAX_INDIVIDUAL_SEGMENT limit (10 per unique segment value)', () => {
    // 12 URLs all containing the path segment "common".
    // Once 10 have been selected, that segment's count reaches MAX_INDIVIDUAL_SEGMENT (10)
    // and subsequent URLs sharing it are skipped – before the MAX_FIRST_SEGMENT (15) cap fires.
    const candidates = Array.from({ length: 12 }, (_, i) => ({
      url: `https://example.com/common/page-${i}`,
      score: 50 - i,
      prioritySignals: { homepage: false, search: false },
    }));
    const { selected, skipped } = applyUrlDiversityLimits(candidates);
    assert.ok(
      selected.length <= 10,
      `selected.length (${selected.length}) should be ≤ 10 (MAX_INDIVIDUAL_SEGMENT)`,
    );
    assert.ok(
      skipped.length >= 2,
      `skipped.length (${skipped.length}) should be ≥ 2`,
    );
  });
});

// ---------------------------------------------------------------------------
// ensureCriticalPages
// ---------------------------------------------------------------------------

describe('ensureCriticalPages', () => {
  it('prepends a homepage candidate when none is present', () => {
    const candidates = [
      { url: 'https://example.com/about', score: 50, prioritySignals: { homepage: false } },
    ];
    const result = ensureCriticalPages(candidates, new URL('https://example.com'));
    assert.ok(result.some((c) => c.prioritySignals?.homepage));
    assert.ok(result.some((c) => c.url === 'https://example.com/'));
    assert.equal(result[0].url, 'https://example.com/');
  });

  it('does not add a duplicate homepage when one already exists', () => {
    const candidates = [
      { url: 'https://example.com/', score: 90, prioritySignals: { homepage: true } },
    ];
    const result = ensureCriticalPages(candidates, new URL('https://example.com'));
    const homepages = result.filter((c) => c.prioritySignals?.homepage);
    assert.equal(homepages.length, 1);
  });

  it('assigns CRITICAL_PAGE_SCORE to the injected homepage', () => {
    const candidates = [
      { url: 'https://example.com/about', score: 50, prioritySignals: { homepage: false } },
    ];
    const result = ensureCriticalPages(candidates, new URL('https://example.com'));
    const homepage = result.find((c) => c.prioritySignals?.homepage);
    assert.ok(homepage.score >= 1000, `expected CRITICAL_PAGE_SCORE, got ${homepage.score}`);
  });
});

// ---------------------------------------------------------------------------
// buildDiscoverySummary
// ---------------------------------------------------------------------------

describe('buildDiscoverySummary', () => {
  const base = {
    requestId: 'test-123',
    warnings: [],
    sourceCounts: {},
    priorityCoverage: {},
  };

  it('always includes "sitemap" in sourcesAttempted', () => {
    const result = buildDiscoverySummary({ ...base, fallbackUsed: false, crawlUsed: false });
    assert.ok(result.sourcesAttempted.includes('sitemap'));
  });

  it('adds "homepage-fallback" when fallbackUsed is true', () => {
    const result = buildDiscoverySummary({ ...base, fallbackUsed: true, crawlUsed: false });
    assert.ok(result.sourcesAttempted.includes('homepage-fallback'));
  });

  it('adds "crawl" when crawlUsed is true', () => {
    const result = buildDiscoverySummary({ ...base, fallbackUsed: false, crawlUsed: true });
    assert.ok(result.sourcesAttempted.includes('crawl'));
  });

  it('sets fallbackUsed:true when crawlUsed is true', () => {
    const result = buildDiscoverySummary({ ...base, fallbackUsed: false, crawlUsed: true });
    assert.equal(result.fallbackUsed, true);
  });

  it('sets fallbackUsed:false when neither flag is set', () => {
    const result = buildDiscoverySummary({ ...base, fallbackUsed: false, crawlUsed: false });
    assert.equal(result.fallbackUsed, false);
  });

  it('includes all three sources when both fallback and crawl are used', () => {
    const result = buildDiscoverySummary({ ...base, fallbackUsed: true, crawlUsed: true });
    assert.ok(result.sourcesAttempted.includes('sitemap'));
    assert.ok(result.sourcesAttempted.includes('homepage-fallback'));
    assert.ok(result.sourcesAttempted.includes('crawl'));
  });

  it('propagates warnings into the result', () => {
    const warnings = ['something went wrong'];
    const result = buildDiscoverySummary({ ...base, fallbackUsed: false, crawlUsed: false, warnings });
    assert.deepEqual(result.warnings, warnings);
  });

  it('includes cacheHit:false and cacheCleared:false', () => {
    const result = buildDiscoverySummary({ ...base, fallbackUsed: false, crawlUsed: false });
    assert.equal(result.cacheHit, false);
    assert.equal(result.cacheCleared, false);
  });
});

// ---------------------------------------------------------------------------
// slugForTarget
// ---------------------------------------------------------------------------

describe('slugForTarget', () => {
  it('builds a filename from canonicalHost and requestedCount', () => {
    assert.equal(slugForTarget({ canonicalHost: 'example.com', requestedCount: 100 }), 'example.com-100.json');
  });

  it('strips www. from the host in the slug', () => {
    assert.equal(slugForTarget({ canonicalHost: 'www.example.com', requestedCount: 50 }), 'example.com-50.json');
  });

  it('handles different count values', () => {
    assert.equal(slugForTarget({ canonicalHost: 'gov.uk', requestedCount: 75 }), 'gov.uk-75.json');
  });
});
