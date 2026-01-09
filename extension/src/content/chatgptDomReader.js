// Content script: reads ChatGPT DOM and renders VeriFire overlay

(function () {
  const OVERLAY_ID = 'verifire-overlay-panel';

  // Track current chat ID and last processed messages
  let currentChatId = null;
  let lastProcessedAssistantMessage = null;
  
  // Log that content script is loaded
  console.log('[VeriFire] Content script loaded on:', window.location.href);
  
  // Generate deterministic chat ID from URL
  function getChatId() {
    // Extract chatId from location pathname
    const pathname = window.location.pathname;
    const pathParts = pathname.split('/c/');
    if (pathParts.length > 1 && pathParts[1]) {
      const chatId = pathParts[1].split('/')[0].split('?')[0];
      if (chatId) {
        return chatId;
      }
    }
    
    // Fallback to URL matching
    const url = window.location.href;
    const match = url.match(/\/c\/([a-f0-9\-]+)/);
    if (match && match[1]) {
      return match[1];
    }
    
    // Additional check for different URL patterns
    const uuidMatch = url.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (uuidMatch && uuidMatch[0]) {
      return uuidMatch[0];
    }
    
    return 'default-chat'; // fallback for new chats
  }

  function getLatestMessageText(role) {
    // Try multiple selector strategies for ChatGPT's evolving DOM
    const selectors = [
      `[data-message-author-role="${role}"]`,
      `article[data-testid="conversation-turn"] [data-message-author-role]`,
      `.group [data-message-author-role="${role}"]`
    ];
    
    for (const selector of selectors) {
      const all = document.querySelectorAll(selector);
      let last = null;
      all.forEach((el) => {
        if (el.getAttribute('data-message-author-role') === role) {
          last = el;
        }
      });
      if (last) return last.innerText;
    }
    
    return '';
  }

  // Get all assistant messages (for conversation context)
  function getAllAssistantMessages() {
    // Try multiple selector strategies for ChatGPT's evolving DOM
    const selectors = [
      '[data-message-author-role="assistant"]',
      'article[data-testid="conversation-turn"] [data-message-author-role="assistant"]',
      '.group [data-message-author-role="assistant"]'
    ];
    
    for (const selector of selectors) {
      const all = document.querySelectorAll(selector);
      if (all.length > 0) {
        return Array.from(all).map(el => el.innerText);
      }
    }
    
    return [];
  }

  function extractPromptAndResponse() {
    const promptText = getLatestMessageText('user');
    const responseText = getLatestMessageText('assistant');
    return { promptText, responseText };
  }

  function ensureOverlay() {
    let overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = OVERLAY_ID;
      overlay.style.position = 'fixed';
      overlay.style.right = '16px';
      overlay.style.top = '16px';
      overlay.style.zIndex = '9999';
      overlay.style.background = '#111';
      overlay.style.color = '#fff';
      overlay.style.padding = '12px';
      overlay.style.borderRadius = '4px';
      overlay.style.maxWidth = '360px';
      overlay.style.fontSize = '12px';
      overlay.style.fontFamily = 'system-ui, sans-serif';
      overlay.style.boxShadow = '0 0 0 1px rgba(255,255,255,0.1)';
      overlay.style.opacity = '0.95';
      overlay.style.pointerEvents = 'auto';

      const title = document.createElement('div');
      title.textContent = 'VeriFire Lint Report';
      title.style.fontWeight = '600';
      title.style.marginBottom = '8px';
      overlay.appendChild(title);

      const status = document.createElement('div');
      status.id = `${OVERLAY_ID}-status`;
      overlay.appendChild(status);

      const list = document.createElement('div');
      list.id = `${OVERLAY_ID}-rules`;
      list.style.marginTop = '8px';
      list.style.maxHeight = '260px';
      list.style.overflowY = 'auto';
      overlay.appendChild(list);

      document.body.appendChild(overlay);
    }
    return overlay;
  }

  async function renderAnalysis(analysis) {
    console.log('[VeriFire] rendering overlay');
    
    if (!analysis) {
      console.warn('[VeriFire] overlay skipped', 'No analysis data');
      return;
    }
    
    const overlay = ensureOverlay();
    const status = document.getElementById(`${OVERLAY_ID}-status`);
    const list = document.getElementById(`${OVERLAY_ID}-rules`);
    if (!status || !list) {
      console.warn('[VeriFire] overlay skipped', 'Missing DOM elements');
      return;
    }
    
    const risk = analysis && analysis.risk ? analysis.risk.label : 'LOW';
    
    // Get AI status from storage to show the badge
    const data = await new Promise(resolve => {
      chrome.storage.local.get(['verifireConfig'], resolve);
    });
    
    const cfg = data.verifireConfig || {};
    const aiEnabled = cfg.aiIntentEnabled === true;
    
    // Update status with AI badge
    status.innerHTML = `<span>Overall risk: ${risk}</span>`;
    
    const aiBadge = document.createElement('span');
    aiBadge.className = 'ai-badge';
    aiBadge.textContent = aiEnabled ? '🧠 AI: ON' : '⚙️ AI: OFF';
    aiBadge.style.float = 'right';
    aiBadge.style.fontSize = '10px';
    aiBadge.style.padding = '2px 6px';
    aiBadge.style.borderRadius = '4px';
    aiBadge.style.backgroundColor = aiEnabled ? 'rgba(106, 90, 205, 0.2)' : 'rgba(100, 100, 100, 0.2)';
    aiBadge.style.color = aiEnabled ? '#b19cd9' : '#aaa';
    
    status.appendChild(aiBadge);

    list.innerHTML = '';

    if (!analysis || !Array.isArray(analysis.ruleResults) || analysis.ruleResults.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'No rules evaluated.';
      list.appendChild(empty);
      return;
    }

    analysis.ruleResults.forEach((r) => {
      const item = document.createElement('div');
      item.style.borderTop = '1px solid rgba(255,255,255,0.1)';
      item.style.paddingTop = '4px';
      item.style.marginTop = '4px';

      const header = document.createElement('div');
      header.textContent = `${r.status} [${r.confidence}] (${r.ruleType})`;
      header.style.fontWeight = '500';
      list.appendChild(item);
      item.appendChild(header);

      const source = document.createElement('div');
      source.textContent = r.ruleSourceText;
      source.style.opacity = '0.8';
      source.style.marginTop = '2px';
      item.appendChild(source);

      if (r.reason) {
        const reason = document.createElement('div');
        reason.textContent = r.reason;
        reason.style.fontSize = '11px';
        reason.style.opacity = '0.7';
        item.appendChild(reason);
      }
    });
  }

  async function analyzeLatest() {
    // Check for chat switch
    const newChatId = getChatId();
    if (newChatId !== currentChatId) {
      console.log('[VeriFire] Chat switched to:', newChatId);
      currentChatId = newChatId;
      lastProcessedAssistantMessage = null; // Reset on chat switch
      
      // Initialize conversation on backend
      try {
        // Get config to get backend URL
        const config = await new Promise(resolve => {
          chrome.storage.local.get(['verifireConfig'], resolve);
        });
        
        const backendUrl = config.verifireConfig?.backendBaseUrl || 'http://localhost:7310/api';
        
        // Call conversation init endpoint
        const response = await fetch(`${backendUrl}/backend-api/conversation/init`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ chatId: newChatId }),
        });
        
        if (!response.ok) {
          console.error('[VeriFire] Failed to initialize conversation', response.status);
        } else {
          console.log('[VeriFire] Conversation initialized for chat:', newChatId);
        }
      } catch (error) {
        console.error('[VeriFire] Error initializing conversation:', error);
      }
      
      // Notify backend of chat switch
      chrome.runtime.sendMessage({
        type: 'CHAT_SWITCHED',
        payload: { chatId: newChatId }
      });
    }
    
    const { promptText, responseText } = extractPromptAndResponse();
    if (!promptText || !responseText) {
      return;
    }
    
    // Get the latest assistant message to see if it's new
    const allAssistantMessages = getAllAssistantMessages();
    const latestAssistantMessage = allAssistantMessages.length > 0 ? allAssistantMessages[allAssistantMessages.length - 1] : '';
    
    // Only analyze if this is a new assistant message
    if (latestAssistantMessage && latestAssistantMessage !== lastProcessedAssistantMessage) {
      console.log('[VeriFire] New assistant message detected, analyzing...');
      console.log('[VeriFire] Chat ID:', currentChatId);
      console.log('[VeriFire] Analyzing prompt:', promptText.substring(0, 100) + '...');
      console.log('[VeriFire] Analyzing response:', responseText.substring(0, 100) + '...');
      lastProcessedAssistantMessage = latestAssistantMessage;
      
      console.log('[VeriFire] sending analyze request', {
        chatId: currentChatId,
        textLength: responseText.length
      });
      
      chrome.runtime.sendMessage(
        {
          type: 'ANALYZE_RESPONSE',
          payload: { 
            promptText, 
            responseText,
            chatId: currentChatId
          },
        },
        async (response) => {
          console.log('[VeriFire] analyze response received', response);
          if (!response || !response.ok || !response.result) {
            console.warn('[VeriFire] analysis invalid', response);
            return;
          }
          
          // Verify result structure before rendering
          if (!response.result.ruleResults) {
            console.warn('[VeriFire] analysis result missing ruleResults', response.result);
            return;
          }
          
          await renderAnalysis(response.result);
        }
      );
    }
  }

  const observer = new MutationObserver((mutations) => {
    let hasAssistantChange = false;
    
    mutations.forEach((mutation) => {
      if (mutation.addedNodes && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if this node itself is an assistant message
            if (node.hasAttribute && node.getAttribute('data-message-author-role') === 'assistant') {
              if (!node.hasAttribute('data-verifire-processed')) {
                node.setAttribute('data-verifire-processed', 'true');
                hasAssistantChange = true;
                console.log('[VeriFire] mutation detected');
                console.log('[VeriFire] assistant message detected', node.innerText.slice(0, 80));
              }
            }
            
            // Check child nodes for assistant messages
            const assistantMessages = node.querySelectorAll && node.querySelectorAll('[data-message-author-role="assistant"]');
            if (assistantMessages) {
              for (const msg of assistantMessages) {
                if (!msg.hasAttribute('data-verifire-processed')) {
                  msg.setAttribute('data-verifire-processed', 'true');
                  hasAssistantChange = true;
                  console.log('[VeriFire] mutation detected');
                  console.log('[VeriFire] assistant message detected', msg.innerText.slice(0, 80));
                }
              }
            }
          }
        }
      }
    });
    
    if (hasAssistantChange) {
      setTimeout(analyzeLatest, 400);
    }
  });

  window.addEventListener('load', () => {
    const root = document.querySelector('main') || document.body;
    observer.observe(root, { childList: true, subtree: true });
  });
})();
