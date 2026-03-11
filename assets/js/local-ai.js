/**
 * Local LLM Integration for Top Task Finder
 *
 * Supports:
 *  - Chrome 2026 Built-in AI (LanguageModel global API) when available
 *  - Chrome/Firefox/Edge legacy Prompt API (window.ai.languageModel) as fallback
 *
 * Emits detailed console diagnostics at every step to help troubleshoot
 * API availability issues across browsers.
 */

const LOG_PREFIX = '[Local AI]';

/** Detect the current browser from the user-agent string.
 *  NOTE: Edge must be checked before Chrome because Edge's UA string
 *  contains both "Edg/" and "Chrome/".
 */
function detectBrowser() {
  const ua = navigator.userAgent;
  if (ua.includes('Edg/')) return 'edge';
  if (ua.includes('Firefox/')) return 'firefox';
  if (ua.includes('Chrome/')) return 'chrome';
  return 'other';
}

/**
 * Fire the shared notification via app.js by dispatching a custom event.
 */
function showLocalAINotification(message) {
  document.dispatchEvent(new CustomEvent('local-ai:notify', { detail: { message } }));
}

/**
 * Debug helper that logs the exact reason AI is unavailable so developers can
 * quickly identify whether the issue is flags, GPU backend, incognito mode, etc.
 */
async function debugAI() {
  const browser = detectBrowser();
  const hasNewApi = 'LanguageModel' in window;
  const hasLegacyApi = 'ai' in self && 'languageModel' in self.ai;

  if (!hasNewApi && !hasLegacyApi) {
    if (browser === 'chrome') {
      console.warn(
        `${LOG_PREFIX} [debugAI] No AI API found in Chrome.\n` +
        '  Possible causes:\n' +
        '  1. Browser flags disabled – enable chrome://flags/#prompt-api-for-gemini-nano\n' +
        '  2. GPU Backend not ready – check chrome://gpu for WebGPU support\n' +
        '  3. Incognito mode detected – Prompt API is disabled in private browsing\n' +
        '  4. Model not downloaded – visit chrome://on-device-internals'
      );
    } else {
      console.warn(`${LOG_PREFIX} [debugAI] No AI API found (browser: ${browser}).`);
    }
    return;
  }

  if (hasNewApi) {
    try {
      const availability = await LanguageModel.availability();
      if (availability === 'no') {
        console.warn(
          `${LOG_PREFIX} [debugAI] LanguageModel.availability() = "no".\n` +
          '  Possible causes:\n' +
          '  1. Browser flags – check chrome://flags for LanguageModel/Prompt API flags\n' +
          '  2. GPU Backend not ready – check chrome://gpu\n' +
          '  3. Incognito mode – AI is disabled in private browsing\n' +
          '  4. Enterprise policy – check if browser policy blocks AI features'
        );
      } else {
        console.info(`${LOG_PREFIX} [debugAI] LanguageModel.availability() = "${availability}"`);
      }
    } catch (err) {
      console.error(`${LOG_PREFIX} [debugAI] LanguageModel.availability() threw:`, err);
    }
  }
}

/**
 * Check AI availability using the 2026 LanguageModel API first, then the
 * legacy window.ai.languageModel API.
 *
 * Returns { available: boolean, status: string, api: 'LanguageModel'|'legacy'|'none' }
 */
async function initAI() {
  // Check new 2026 LanguageModel global API first
  if ('LanguageModel' in window) {
    try {
      const availability = await LanguageModel.availability();
      console.info(`${LOG_PREFIX} LanguageModel.availability() = "${availability}"`);

      switch (availability) {
        case 'readily':
          return { available: true, status: 'ready', api: 'LanguageModel' };
        case 'downloadable':
          return { available: true, status: 'downloadable', api: 'LanguageModel' };
        case 'after-download':
          return { available: false, status: 'after-download', api: 'LanguageModel' };
        case 'no':
        default:
          return { available: false, status: 'no', api: 'LanguageModel' };
      }
    } catch (err) {
      console.info(`${LOG_PREFIX} LanguageModel.availability() threw:`, err);
    }
  }

  // Fall back to legacy window.ai.languageModel API
  if ('ai' in self && 'languageModel' in self.ai) {
    try {
      const availability = await self.ai.languageModel.availability();
      console.info(`${LOG_PREFIX} [legacy] languageModel.availability() = "${availability}"`);

      if (availability === 'readily') {
        return { available: true, status: 'ready', api: 'legacy' };
      }
      if (availability === 'after-download') {
        return { available: false, status: 'after-download', api: 'legacy' };
      }
      return { available: false, status: availability || 'no', api: 'legacy' };
    } catch (err) {
      console.info(`${LOG_PREFIX} [legacy] languageModel.availability() threw:`, err);
    }
  }

  return { available: false, status: 'none', api: 'none' };
}

/**
 * Create an AI session using the appropriate API, specifying language and
 * expectedUsage to silence console warnings and optimize safety checks.
 */
async function createAISession(api, systemPrompt) {
  if (api === 'LanguageModel') {
    const options = {
      language: 'en',
      expectedUsage: 'text-generation',
    };
    if (systemPrompt) options.systemPrompt = systemPrompt;
    return await LanguageModel.create(options);
  }
  // Legacy window.ai.languageModel API
  return await self.ai.languageModel.create({
    systemPrompt:
      systemPrompt ||
      "You are a UX researcher specializing in Gerry McGovern's Top Tasks methodology. Clean, deduplicate, and professionally format the following task list.",
  });
}

async function setupLocalAIIntegration() {
  const browser = detectBrowser();
  console.info(`${LOG_PREFIX} Browser detected: ${browser}`);

  const aiStatus = await initAI();
  console.info(`${LOG_PREFIX} AI init result:`, aiStatus);

  // No AI API found in this browser
  if (aiStatus.api === 'none') {
    if (browser === 'chrome') {
      console.info(
        `${LOG_PREFIX} Chrome detected but no AI API found.\n` +
        '  To enable Gemini Nano (LanguageModel API):\n' +
        '    1. Open chrome://flags/#prompt-api-for-gemini-nano  →  Enabled\n' +
        '    2. Open chrome://flags/#optimization-guide-on-device-model  →  Enabled BypassPerfRequirement\n' +
        '    3. Restart Chrome.\n' +
        '    4. Visit chrome://on-device-internals and confirm "Foundational model state: Ready".'
      );
    } else if (browser === 'firefox') {
      console.info(
        `${LOG_PREFIX} Firefox detected but no AI API found.\n` +
        '  The Prompt API is experimental in Firefox.\n' +
        '  For Firefox Nightly: open about:config and set dom.ai.chatbot.enabled = true.\n' +
        '  To analyze URLs with the Firefox AI Chatbot sidebar, use the\n' +
        '  "Copy Prompt for LLM" button on the page, then paste into the sidebar\n' +
        '  (open via the sidebar button or View → Firefox Labs → AI Chatbot).'
      );
    } else if (browser === 'edge') {
      console.info(
        `${LOG_PREFIX} Edge detected but no AI API found.\n` +
        '  The Prompt API is not currently exposed via JavaScript in Edge.\n' +
        '  To analyze URLs with the Edge Copilot sidebar, use the\n' +
        '  "Copy Prompt for LLM" button on the page, then paste into Copilot\n' +
        '  (open via Ctrl+Shift+.).'
      );
    } else {
      console.info(`${LOG_PREFIX} Unrecognised browser – Prompt API not available.`);
    }
    await debugAI();
    return;
  }

  // API found but explicitly disabled
  if (aiStatus.status === 'no') {
    console.info(
      `${LOG_PREFIX} AI is disabled (availability: "no").\n` +
      '  Check chrome://flags for LanguageModel/Prompt API flags.'
    );
    await debugAI();
    return;
  }

  // Model exists but has not been downloaded yet
  if (aiStatus.status === 'after-download') {
    console.info(
      `${LOG_PREFIX} Model is available but not yet downloaded.\n` +
      '  Visit chrome://on-device-internals and wait for the download to complete,\n' +
      '  then reload this page.'
    );
    return;
  }

  // Model can be downloaded on demand – trigger and track progress
  if (aiStatus.status === 'downloadable') {
    // console.info(`${LOG_PREFIX} Model needs to be downloaded. Triggering download...`);
    // showLocalAINotification('Downloading AI model (4 GB+). This may take a while…');

    try {
      // Create a session solely to trigger and monitor the model download;
      // the session is destroyed immediately after the download completes.
      const session = await LanguageModel.create({
        language: 'en',
        expectedUsage: 'text-generation',
        monitor(m) {
          m.addEventListener('downloadprogress', (e) => {
            if (e.total > 0) {
              const pct = Math.round((e.loaded / e.total) * 100);
              console.info(`${LOG_PREFIX} Model download progress: ${pct}%`);
            }
          });
        },
      });
      session.destroy();
      console.info(`${LOG_PREFIX} Model download complete. Injecting AI buttons.`);
      injectLocalAIButton(aiStatus.api);
    } catch (err) {
      console.error(`${LOG_PREFIX} Model download failed:`, err);
    }
    return;
  }

  // Model is readily available – inject the AI processing buttons
  console.info(`${LOG_PREFIX} Model is ready. Injecting AI buttons.`);
  injectLocalAIButton(aiStatus.api);
}

/** Inject the on-device AI processing button and streaming analysis section. */
function injectLocalAIButton(api) {
  const existingBtn = document.getElementById('copy-prompt');
  if (!existingBtn) return;

  const aiBtn = document.createElement('button');
  aiBtn.id = 'copy-ai-improved';
  aiBtn.type = 'button';
  aiBtn.textContent = 'Copy LLM Improved List';

  aiBtn.addEventListener('click', async () => {
    const llmPromptArea = document.getElementById('llmPrompt');
    const rawPrompt = llmPromptArea ? llmPromptArea.value.trim() : '';
    if (!rawPrompt) {
      showLocalAINotification('Generate the task list first!');
      return;
    }

    const originalText = aiBtn.textContent;
    aiBtn.textContent = '🪄 Processing...';
    aiBtn.disabled = true;

    let session;
    try {
      session = await createAISession(api,
        "You are a UX researcher specializing in Gerry McGovern's Top Tasks methodology. Clean, deduplicate, and professionally format the following task list."
      );
      const response = await session.prompt(rawPrompt);
      await navigator.clipboard.writeText(response);
      aiBtn.textContent = '✅ Copied!';
    } catch (err) {
      console.error(`${LOG_PREFIX} Processing error:`, err);
      aiBtn.textContent = '❌ Error';
    } finally {
      if (session) session.destroy();
      setTimeout(() => {
        aiBtn.textContent = originalText;
        aiBtn.disabled = false;
      }, 3000);
    }
  });

  existingBtn.after(aiBtn);
  injectStreamingAnalysisSection(api, aiBtn);
}

/**
 * Inject the "Summarize Site Tasks with AI" button and streaming output area.
 * Uses promptStreaming() so users see incremental progress rather than a long wait.
 */
function injectStreamingAnalysisSection(api, afterElement) {
  // Streaming summary output
  const summaryOutput = document.createElement('div');
  summaryOutput.id = 'ai-summary-output';
  summaryOutput.className = 'ai-summary';
  summaryOutput.setAttribute('aria-live', 'polite');
  summaryOutput.hidden = true;

  // Status indicator
  const statusEl = document.createElement('p');
  statusEl.id = 'ai-status-indicator';
  statusEl.className = 'hint';
  statusEl.setAttribute('aria-live', 'polite');
  statusEl.hidden = true;

  // Summarize button
  const summarizeBtn = document.createElement('button');
  summarizeBtn.id = 'ai-summarize';
  summarizeBtn.type = 'button';
  summarizeBtn.textContent = 'Summarize Site Tasks with AI';

  summarizeBtn.addEventListener('click', async () => {
    const urlsTextarea = document.getElementById('url-output');
    const urls = urlsTextarea ? urlsTextarea.value.trim() : '';
    if (!urls) {
      showLocalAINotification('Generate the URL list first!');
      return;
    }

    const urlList = urls.split('\n').filter(Boolean);
    statusEl.textContent = 'Thinking…';
    statusEl.hidden = false;
    summaryOutput.textContent = '';
    summaryOutput.hidden = false;
    summarizeBtn.disabled = true;

    const prompt =
      `Based on these URLs from a government site, identify the top 5 user tasks:\n` +
      urlList.join('\n');

    let session;
    try {
      session = await createAISession(api);

      if (typeof session.promptStreaming === 'function') {
        const stream = session.promptStreaming(prompt);
        let rafId = null;
        let latestChunk = '';
        for await (const chunk of stream) {
          latestChunk = chunk;
          if (!rafId) {
            rafId = requestAnimationFrame(() => {
              summaryOutput.textContent = latestChunk;
              rafId = null;
            });
          }
        }
        // Ensure the final chunk is always rendered
        if (rafId) {
          cancelAnimationFrame(rafId);
        }
        summaryOutput.textContent = latestChunk;
      } else {
        // Non-streaming fallback for legacy API
        const response = await session.prompt(prompt);
        summaryOutput.textContent = response;
      }

      statusEl.textContent = 'Analysis complete (processed locally)';
    } catch (err) {
      console.error(`${LOG_PREFIX} Streaming analysis error:`, err);
      statusEl.textContent = 'Error: check console for details';
    } finally {
      if (session) session.destroy();
      summarizeBtn.disabled = false;
    }
  });

  afterElement.after(summarizeBtn);
  summarizeBtn.after(statusEl);
  statusEl.after(summaryOutput);
}

setupLocalAIIntegration();

