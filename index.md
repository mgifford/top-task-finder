---
layout: default
title: Accessible Top Task URL Finder
---

<main class="container" aria-labelledby="page-title">
  <header class="hero">
    <h1 id="page-title">Find Popular URLs</h1>
    <p class="lead">Enter a website URL and get a representative, editable list of pages for review.</p>
  </header>

  <section class="panel" aria-labelledby="scan-form-title">
    <h2 id="scan-form-title">Website</h2>
    <form id="scan-form" novalidate>
      <div class="field">
        <label for="domain-url">Domain name / URL (required)</label>
        <input id="domain-url" name="domainUrl" type="url" placeholder="https://example.org" required />
        <p id="limit-help" class="hint" aria-live="polite"></p>
      </div>

      <div class="actions">
        <button id="find-urls" type="submit">Find Popular URLs</button>
      </div>

      <input id="requested-count" name="requestedCount" type="hidden" />
      <input id="bypass-cache" name="bypassCache" type="hidden" value="0" />
    </form>
  </section>

  <section class="panel" aria-labelledby="status-title">
    <h2 id="status-title">Progress</h2>
    <div id="status-region" class="status info" role="status" aria-live="polite">
      Ready.
    </div>
    <p id="cache-state" class="hint" aria-live="polite"></p>
    <p id="server-crawl-status" class="hint" aria-live="polite"></p>
  </section>

  <section class="panel" aria-labelledby="results-title">
    <h2 id="results-title">URL Results</h2>
    <p class="hint">This list represents a diverse selection of popular and important pages from the website, prioritizing the homepage, search, accessibility pages, and top task pages while limiting deep subdirectories to increase variety across the site.</p>
    <textarea id="url-output" rows="14" spellcheck="false" placeholder="One URL per line will appear here."></textarea>
    <div class="actions">
      <button id="copy-results" type="button">Copy URLs</button>
      <button id="rescan-urls" type="button" class="secondary" hidden>Clear cache and rescan</button>
    </div>
  </section>
</main>

<script type="module" src="{{ '/assets/js/app.js' | relative_url }}"></script>