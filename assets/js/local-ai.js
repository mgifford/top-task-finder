/**
 * Local LLM Integration for Top Task Finder
 * Targets Chrome's built-in Prompt API (Gemini Nano).
 * The button is only injected when the API is available and ready.
 */
async function setupLocalAIIntegration() {
  // 1. Feature Detection: Check if the Prompt API exists
  if (!('ai' in self) || !('languageModel' in self.ai)) {
    console.info('Local AI Prompt API not supported in this browser.');
    return;
  }

  // 2. Availability Check: Ensure the model is actually downloaded/ready
  let availability;
  try {
    availability = await self.ai.languageModel.availability();
  } catch (err) {
    console.info('Local AI availability check failed:', err);
    return;
  }
  if (availability !== 'readily') {
    return;
  }

  // 3. UI Injection: Locate the existing "Copy Prompt for LLM" button
  const existingBtn = document.getElementById('copy-prompt');
  if (!existingBtn) {
    return;
  }

  // Create the "Improved" button with styling consistent with the existing actions
  const aiBtn = document.createElement('button');
  aiBtn.id = 'copy-ai-improved';
  aiBtn.type = 'button';
  aiBtn.textContent = 'Copy LLM Improved List';

  // 4. Wire up the click handler
  aiBtn.addEventListener('click', async () => {
    const llmPromptArea = document.getElementById('llmPrompt');
    const rawPrompt = llmPromptArea ? llmPromptArea.value.trim() : '';
    if (!rawPrompt) {
      // eslint-disable-next-line no-alert
      window.alert('Generate the task list first!');
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
      console.error('Local LLM Error:', err);
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

  // Insert the new button immediately after the existing prompt button
  existingBtn.after(aiBtn);
}

setupLocalAIIntegration();
