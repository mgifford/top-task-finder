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
    <p id="page-estimate" class="hint" aria-live="polite"></p>
    <textarea id="url-output" rows="14" spellcheck="false" placeholder="One URL per line will appear here."></textarea>
    <div class="actions">
      <button id="copy-results" type="button">Copy URLs</button>
      <button id="copy-prompt" type="button">Copy Prompt for LLM</button>
      <button id="rescan-urls" type="button" class="secondary" hidden>Clear cache and rescan</button>
    </div>
  </section>

  <div class="disclaimer">
    <p><strong>Note:</strong> This tool provides a quick way to sample popular URLs from a website, but it is <em>not</em> a replacement for proper Top Task research methodology. <button type="button" id="open-modal" class="disclaimer-link">Learn more about Top Tasks</button>.</p>
  </div>
</main>

<!-- Modal Dialog -->
<div id="top-task-modal" class="modal" role="dialog" aria-labelledby="modal-title" aria-modal="true" hidden>
  <div class="modal-content">
    <div class="modal-header">
      <h2 id="modal-title">About Top Task Research</h2>
      <button id="close-modal" class="modal-close" aria-label="Close dialog">&times;</button>
    </div>
    <div class="modal-body">
      <p>This tool provides a quick sample of popular URLs, but <strong>it is not a substitute for proper Top Task research</strong>. Top Task research is a rigorous methodology for identifying what matters most to your users.</p>
      
      <h3>Why Proper Top Task Research Matters</h3>
      <p>True Top Task identification involves:</p>
      <ul>
        <li>Direct user research and surveys</li>
        <li>Analysis of user intent and goals</li>
        <li>Prioritization through voting and ranking</li>
        <li>Validation with real user data</li>
      </ul>
      
      <h3>Learn More About Top Tasks</h3>
      <p>To conduct proper Top Task research, we recommend these resources:</p>
      <ul>
        <li><a href="https://www.optimalworkshop.com/blog/understanding-top-tasks" target="_blank" rel="noopener noreferrer">Understanding Top Tasks (Optimal Workshop)</a></li>
        <li><a href="https://www.interaction-design.org/literature/article/task-analysis-a-ux-designer-s-best-friend" target="_blank" rel="noopener noreferrer">Task Analysis: A UX Designer's Best Friend</a></li>
        <li><a href="https://alistapart.com/article/what-really-matters-focusing-on-top-tasks/" target="_blank" rel="noopener noreferrer">What Really Matters: Focusing on Top Tasks (A List Apart)</a></li>
        <li><a href="https://articles.centercentre.com/focusing_top_tasks/" target="_blank" rel="noopener noreferrer">Focusing on Top Tasks (Center Centre)</a></li>
        <li><a href="https://www.smashingmagazine.com/2022/05/top-tasks-focus-what-matters-must-defocus-what-doesnt/" target="_blank" rel="noopener noreferrer">Top Tasks: Focus on What Matters (Smashing Magazine)</a></li>
        <li><a href="https://medium.com/@gerrymcgovern/identifying-customer-top-tasks-ee228206b6ed" target="_blank" rel="noopener noreferrer">Identifying Customer Top Tasks (Gerry McGovern)</a></li>
        <li><a href="https://gerrymcgovern.com/books/top-tasks-a-how-to-guide/read-the-first-chapter/" target="_blank" rel="noopener noreferrer">Top Tasks: A How-To Guide (First Chapter)</a></li>
      </ul>
      
      <h3>When This Tool Can Help</h3>
      <p>While not a replacement for proper research, this tool can be useful for:</p>
      <ul>
        <li>Quick content audits</li>
        <li>Getting a sense of site structure</li>
        <li>Preliminary accessibility reviews</li>
        <li>Identifying pages to test with real users</li>
      </ul>
    </div>
  </div>
</div>

<!-- Notification Modal -->
<div id="notification-modal" class="notification-modal" role="alert" aria-live="assertive" tabindex="-1" hidden>
  <div class="notification-content">
    <p id="notification-message"></p>
  </div>
</div>

<script type="module" src="{{ '/assets/js/app.js' | relative_url }}?v={{ site.time | date: '%s' }}"></script>