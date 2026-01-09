// Background service worker for VeriFire extension

const DEFAULT_CONFIG = {
  backendBaseUrl: 'http://localhost:7310/api',
  activeBucketIds: [],
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['verifireConfig'], (data) => {
    if (!data.verifireConfig) {
      chrome.storage.local.set({ verifireConfig: DEFAULT_CONFIG });
    }
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message && message.type === 'ANALYZE_RESPONSE') {
      try {
        const result = await handleAnalyzeRequest(message.payload);
        sendResponse({ ok: true, result });
      } catch (err) {
        console.error('[VeriFire] analyze error from background', err);
        sendResponse({ ok: false, error: err && err.message ? err.message : 'unknown_error' });
      }
      return;
    }
    
    if (message && message.type === 'CHAT_SWITCHED') {
      console.log('[VeriFire] Chat switched in background:', message.payload.chatId);
      // For now, just log the chat switch. Backend conversation management is handled automatically.
      sendResponse({ ok: true });
      return;
    }
    
    if (message && message.type === 'GET_AI_STATUS') {
      // Return the current AI status
      const data = await new Promise(resolve => {
        chrome.storage.local.get(['verifireConfig'], resolve);
      });
      const cfg = data.verifireConfig || {};
      const aiEnabled = cfg.aiIntentEnabled === true;
      sendResponse({ ok: true, aiEnabled });
      return;
    }
  })();
  
  // Return true to indicate async response
  return true;
});

async function handleAnalyzeRequest(payload) {
  const config = await getConfig();
  const res = await fetch(`${config.backendBaseUrl}/backend-api/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      promptText: payload.promptText,
      responseText: payload.responseText,
      bucketIds: config.activeBucketIds,
      chatId: payload.chatId, // Add chatId for conversation-aware analysis
    }),
  });

  if (!res.ok) {
    throw new Error(`Backend responded with status ${res.status}`);
  }

  return res.json();
}

function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['verifireConfig'], (data) => {
      resolve(data.verifireConfig || DEFAULT_CONFIG);
    });
  });
}
