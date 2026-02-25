---
layout: default
title: Accessible Top Task URL Finder
---

<main class="container" aria-labelledby="page-title">
  <h1 id="page-title">Accessible Top Task URL Finder</h1>
  <p class="lead">Generate a representative, editable URL list for accessibility review.</p>

  <section class="panel" aria-labelledby="scan-form-title">
    <h2 id="scan-form-title">Scan Inputs</h2>
    <form id="scan-form" novalidate>
      <div class="field">
        <label for="domain-url">Domain name / URL</label>
        <input id="domain-url" name="domainUrl" type="url" placeholder="https://example.org" required />
      </div>

      <div class="field">
        <label for="requested-count">Number of URLs</label>
        <input id="requested-count" name="requestedCount" type="number" min="1" step="1" />
        <p id="limit-help" class="hint" aria-live="polite"></p>
      </div>

      <div class="field-inline">
        <label>
          <input id="bypass-cache" name="bypassCache" type="checkbox" />
          Bypass cache for this run
        </label>
      </div>

      <div class="field">
        <label for="github-token">GitHub token (stored only in your browser)</label>
        <input id="github-token" name="githubToken" type="password" placeholder="ghp_..." autocomplete="off" />
      </div>

      <div class="actions">
        <button id="run-scan" type="submit">Generate URLs</button>
        <button id="run-server-crawl" type="button">Run server crawl</button>
        <button id="clear-cache" type="button">Clear cache</button>
      </div>

      <p id="server-crawl-status" class="hint" aria-live="polite"></p>
    </form>
  </section>

  <section class="panel" aria-labelledby="status-title">
    <h2 id="status-title">Status</h2>
    <div id="status-region" class="status info" role="status" aria-live="polite">
      Ready.
    </div>
    <p id="cache-state" class="hint" aria-live="polite"></p>
  </section>

  <section class="panel" aria-labelledby="results-title">
    <h2 id="results-title">URL Results</h2>
    <textarea id="url-output" rows="14" spellcheck="false" placeholder="One URL per line will appear here."></textarea>
    <div class="actions">
      <button id="copy-results" type="button">Copy URLs</button>
    </div>
  </section>
</main>

<script type="module" src="/assets/js/app.js"></script>