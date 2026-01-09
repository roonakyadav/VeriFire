document.addEventListener('DOMContentLoaded', () => {
  const backendUrlInput = document.getElementById('backendUrl');
  const instructionsInput = document.getElementById('instructions');
  const bucketNameInput = document.getElementById('bucketName');
  const createBtn = document.getElementById('createBucketBtn');
  const statusEl = document.getElementById('status');
  const bucketIdContainer = document.getElementById('bucketIdContainer');
  const bucketIdDisplay = document.getElementById('bucketIdDisplay');
  const copyBucketIdBtn = document.getElementById('copyBucketIdBtn');
  const copyStatus = document.getElementById('copyStatus');

  chrome.storage.local.get(['verifireConfig'], (data) => {
    const cfg = data.verifireConfig || {};
    backendUrlInput.value = cfg.backendBaseUrl || 'http://localhost:7310/api';
  });

  backendUrlInput.addEventListener('change', () => {
    const url = backendUrlInput.value || 'http://localhost:7310/api';
    chrome.storage.local.get(['verifireConfig'], (data) => {
      const cfg = data.verifireConfig || {};
      const updated = {
        backendBaseUrl: url,
        activeBucketIds: cfg.activeBucketIds || [],
      };
      chrome.storage.local.set({ verifireConfig: updated }, () => {
        showStatus('Backend URL saved.', 'success');
      });
    });
  });

  createBtn.addEventListener('click', async () => {
    const instructions = (instructionsInput.value || '').trim();
    const name = bucketNameInput.value || 'Untitled bucket';
    if (!instructions) {
      showStatus('Please enter instructions for the bucket.', 'error');
      return;
    }

    try {
      chrome.storage.local.get(['verifireConfig'], async (data) => {
        const cfg = data.verifireConfig || {};
        const baseUrl = cfg.backendBaseUrl || 'http://localhost:7310/api';
        
        // Show loading state
        createBtn.disabled = true;
        createBtn.textContent = 'Creating...';
        
        const response = await fetch(`${baseUrl}/buckets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, instructions }),
        });
        
        if (!response.ok) {
          throw new Error(`Status ${response.status}`);
        }
        
        const bucket = await response.json();
        showStatus(`Bucket saved with id ${bucket.id}.`, 'success');
        
        // Display the bucket ID persistently
        displayBucketId(bucket.id);
        
        // Clear inputs after successful creation
        instructionsInput.value = '';
        bucketNameInput.value = '';
      });
    } catch (err) {
      console.error('[VeriFire] bucket save error', err);
      showStatus('Error saving bucket. Check backend is running.', 'error');
    } finally {
      // Reset button state
      createBtn.disabled = false;
      createBtn.textContent = 'Create / Update Bucket';
    }
  });
  
  // Helper function to show status messages
  function showStatus(text, type = 'info') {
    statusEl.textContent = text;
    statusEl.className = `status ${type}`;
    
    // Auto-clear after 3 seconds
    setTimeout(() => {
      statusEl.textContent = '';
      statusEl.className = 'status';
    }, 3000);
  }
  
  // Function to display the bucket ID persistently
  function displayBucketId(bucketId) {
    bucketIdDisplay.textContent = bucketId;
    bucketIdContainer.style.display = 'block';
  }
  
  // Function to show copy status
  function showCopyStatus(text, type = 'info') {
    copyStatus.textContent = text;
    copyStatus.style.display = 'block';
    
    // Auto-clear after 2 seconds
    setTimeout(() => {
      copyStatus.style.display = 'none';
    }, 2000);
  }
  
  // Add event listener for the copy button
  copyBucketIdBtn.addEventListener('click', () => {
    const bucketId = bucketIdDisplay.textContent;
    
    if (bucketId) {
      navigator.clipboard.writeText(bucketId).then(() => {
        showCopyStatus('Bucket ID copied to clipboard', 'success');
      }).catch(err => {
        console.error('Failed to copy bucket ID: ', err);
        showCopyStatus('Failed to copy ID', 'error');
      });
    }
  });
});
