/**
 * Local LLM Integration for Top Task Finder
 *
 * Supports:
 *  - Chrome/Firefox/Edge Prompt API (window.ai.languageModel) when available
 *  - Firefox AI Chatbot sidebar fallback (clipboard copy + instructions)
 *  - Edge Copilot sidebar fallback (clipboard copy + instructions)
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

async function setupLocalAIIntegration() {
  const browser = detectBrowser();
  console.info(`${LOG_PREFIX} Browser detected: ${browser}`);

  // Step 1 – check for window.ai
  if (!('ai' in self)) {
    console.info(`${LOG_PREFIX} window.ai is not present.`);
    if (browser === 'chrome') {
      console.info(
        `${LOG_PREFIX} Chrome detected but window.ai is missing.\n` +
        '  To enable Gemini Nano (Prompt API):\n' +
        '    1. Open chrome://flags/#prompt-api-for-gemini-nano  →  Enabled\n' +
        '    2. Open chrome://flags/#optimization-guide-on-device-model  →  Enabled BypassPerfRequirement\n' +
        '    3. Restart Chrome.\n' +
        '    4. Visit chrome://on-device-internals and confirm "Foundational model state: Ready".'
      );
    } else if (browser === 'firefox') {
      console.info(
        `${LOG_PREFIX} Firefox detected but window.ai is missing.\n` +
        '  The Prompt API is experimental in Firefox.\n' +
        '  For Firefox Nightly: open about:config and set dom.ai.chatbot.enabled = true.\n' +
        '  Alternatively, use the Firefox AI Chatbot sidebar manually\n' +
        '  (open via the sidebar button or View → Firefox Labs → AI Chatbot).'
      );
      injectSidebarFallbackButton('firefox');
    } else if (browser === 'edge') {
      console.info(
        `${LOG_PREFIX} Edge detected but window.ai is missing.\n` +
        '  The Prompt API is not currently exposed via JavaScript in Edge.\n' +
        '  Use the Edge Copilot sidebar (Ctrl+Shift+.) to process prompts manually.'
      );
      injectSidebarFallbackButton('edge');
    } else {
      console.info(`${LOG_PREFIX} Unrecognised browser – Prompt API not available.`);
    }
    return;
  }

  // Step 2 – check for languageModel within window.ai
  if (!('languageModel' in self.ai)) {
    const available = Object.keys(self.ai).join(', ') || '(none)';
    console.info(
      `${LOG_PREFIX} window.ai found but languageModel sub-API is missing.\n` +
      `  Available sub-APIs on window.ai: ${available}`
    );
    if (browser === 'chrome') {
      console.info(
        `${LOG_PREFIX} Enable chrome://flags/#prompt-api-for-gemini-nano, then restart Chrome.`
      );
    }
    if (browser === 'firefox' || browser === 'edge') {
      injectSidebarFallbackButton(browser);
    }
    return;
  }

  // Step 3 – query model availability
  let availability;
  try {
    availability = await self.ai.languageModel.availability();
    console.info(`${LOG_PREFIX} languageModel.availability() returned: "${availability}"`);
  } catch (err) {
    console.info(`${LOG_PREFIX} languageModel.availability() threw an error:`, err);
    return;
  }

  if (availability === 'after-download') {
    console.info(
      `${LOG_PREFIX} Model is available but not yet downloaded.\n` +
      '  Visit chrome://on-device-internals and wait for the download to complete,\n' +
      '  then reload this page.'
    );
    return;
  }

  if (availability !== 'readily') {
    console.info(
      `${LOG_PREFIX} Model not ready (status: "${availability}").\n` +
      '  Check chrome://on-device-internals for model download status.'
    );
    return;
  }

  // All checks passed – inject the AI processing button
  console.info(`${LOG_PREFIX} Model is ready. Injecting "Copy LLM Improved List" button.`);
  injectLocalAIButton();
}

/** Inject the on-device AI processing button next to the existing prompt button. */
function injectLocalAIButton() {
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
      session = await self.ai.languageModel.create({
        systemPrompt:
          "You are a UX researcher specializing in Gerry McGovern's Top Tasks methodology. Clean, deduplicate, and professionally format the following task list.",
      });

      const response = await session.prompt(rawPrompt);
      await navigator.clipboard.writeText(response);
      aiBtn.textContent = '✅ Copied!';
    } catch (err) {
      console.error(`${LOG_PREFIX} Processing error:`, err);
      aiBtn.textContent = '❌ Error';
    } finally {
      if (session) {
        session.destroy();
      }
      setTimeout(() => {
        aiBtn.textContent = originalText;
        aiBtn.disabled = false;
      }, 3000);
    }
  });

  existingBtn.after(aiBtn);
}

/**
 * Inject a sidebar-fallback button for browsers (Firefox, Edge) that have an
 * AI chatbot sidebar but no JavaScript API.  The button copies the full WCAG-EM
 * prompt to the clipboard and shows instructions for pasting into the sidebar.
 */
function injectSidebarFallbackButton(browser) {
  const existingBtn = document.getElementById('copy-prompt');
  if (!existingBtn) return;

  const isEdge = browser === 'edge';
  const btnLabel = isEdge ? 'Copy Prompt for Edge Copilot' : 'Copy Prompt for Firefox AI';
  const successMsg = isEdge
    ? 'Prompt copied! Open the Edge Copilot sidebar (Ctrl+Shift+.) and paste with Ctrl+V.'
    : 'Prompt copied! Open the Firefox AI Chatbot sidebar and paste with Ctrl+V.';

  const sidebarBtn = document.createElement('button');
  sidebarBtn.id = `copy-for-${browser}-ai`;
  sidebarBtn.type = 'button';
  sidebarBtn.textContent = btnLabel;

  sidebarBtn.addEventListener('click', async () => {
    const llmPromptArea = document.getElementById('llmPrompt');
    const rawPrompt = llmPromptArea ? llmPromptArea.value.trim() : '';
    if (!rawPrompt) {
      showLocalAINotification('Generate the task list first!');
      return;
    }

    try {
      await navigator.clipboard.writeText(rawPrompt);
      showLocalAINotification(successMsg);
    } catch (err) {
      console.error(`${LOG_PREFIX} Clipboard error:`, err);
      showLocalAINotification('Could not copy to clipboard. Please copy the prompt manually.');
    }
  });

  existingBtn.after(sidebarBtn);
}

setupLocalAIIntegration();

