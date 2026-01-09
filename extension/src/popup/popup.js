document.addEventListener('DOMContentLoaded', () => {
  const bucketIdsInput = document.getElementById('bucketIds');
  const saveBtn = document.getElementById('saveBtn');
  const statusEl = document.getElementById('status');
  const aiToggle = document.getElementById('aiToggle');
  const aiStatus = document.getElementById('aiStatus');

  // Load initial settings
  chrome.storage.local.get(['verifireConfig'], (data) => {
    const cfg = data.verifireConfig || {};
    if (Array.isArray(cfg.activeBucketIds)) {
      bucketIdsInput.value = cfg.activeBucketIds.join(',');
    }
    
    // Load AI toggle state (default to false)
    const aiEnabled = cfg.aiIntentEnabled === true;
    aiToggle.checked = aiEnabled;
    updateAiStatus(aiEnabled);
  });

  // Handle AI toggle change
  aiToggle.addEventListener('change', async () => {
    const isEnabled = aiToggle.checked;
    
    try {
      // Update local config
      chrome.storage.local.get(['verifireConfig'], async (data) => {
        const cfg = data.verifireConfig || {};
        const updated = {
          ...cfg,
          aiIntentEnabled: isEnabled,
        };
        
        chrome.storage.local.set({ verifireConfig: updated }, async () => {
          // Notify backend to update AI state
          try {
            const response = await fetch(`${cfg.backendBaseUrl || 'http://localhost:7310/api'}/ai-config`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ aiEnabled: isEnabled }),
            });
            
            if (!response.ok) {
              console.error('Failed to update backend AI config:', response.status);
              // Revert toggle if backend update fails
              aiToggle.checked = !isEnabled;
              updateAiStatus(!isEnabled);
              showStatus('Failed to update AI setting on backend', 'error');
            } else {
              updateAiStatus(isEnabled);
              showStatus('AI setting updated', 'success');
            }
          } catch (error) {
            console.error('Error updating backend AI config:', error);
            // Revert toggle if there's an error
            aiToggle.checked = !isEnabled;
            updateAiStatus(!isEnabled);
            showStatus('Network error updating AI setting', 'error');
          }
        });
      });
    } catch (error) {
      console.error('Error updating AI toggle:', error);
      aiToggle.checked = !isEnabled; // Revert
      updateAiStatus(!isEnabled);
      showStatus('Error updating AI setting', 'error');
    }
  });

  // Save button functionality
  saveBtn.addEventListener('click', () => {
    const raw = bucketIdsInput.value || '';
    const ids = raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    chrome.storage.local.get(['verifireConfig'], (data) => {
      const cfg = data.verifireConfig || {};
      const updated = {
        ...cfg, // Preserve other settings like aiIntentEnabled
        backendBaseUrl: cfg.backendBaseUrl || 'http://localhost:7310/api',
        activeBucketIds: ids,
      };
      chrome.storage.local.set({ verifireConfig: updated }, () => {
        statusEl.textContent = 'Saved.';
        statusEl.className = 'status success';
        setTimeout(() => {
          statusEl.textContent = '';
          statusEl.className = 'status';
        }, 1500);
      });
    });
  });
  
  // Helper function to update AI status text
  function updateAiStatus(enabled) {
    if (enabled) {
      aiStatus.textContent = 'AI assistance enabled (advisory only)';
      aiStatus.style.display = 'block';
      aiStatus.className = 'status info';
    } else {
      aiStatus.textContent = 'AI assistance disabled (deterministic only)';
      aiStatus.style.display = 'block';
      aiStatus.className = 'status info';
    }
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      aiStatus.style.display = 'none';
    }, 3000);
  }
  
  // Helper function to show general status
  function showStatus(text, type = 'info') {
    statusEl.textContent = text;
    statusEl.className = `status ${type}`;
    setTimeout(() => {
      statusEl.textContent = '';
      statusEl.className = 'status';
    }, 1500);
  }
});
