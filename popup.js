// popup.js
let domContentLoadedFiredPopup = false;

function showPopupStatus(message, type = "info") {
  const statusDiv = document.getElementById('status');
  if (statusDiv) {
    statusDiv.textContent = message;
    statusDiv.className = 'status-message';
    statusDiv.classList.add(type);
    statusDiv.style.display = 'block';
    if (type !== 'error' && type !== 'warning') { // Keep error and warning messages displayed longer or until next action
      setTimeout(() => {
        if (statusDiv.textContent === message) {
            statusDiv.style.display = 'none';
        }
      }, type === 'success' ? 5000 : 3000);
    }
  } else {
     console.warn("popup.js: 'status' div not found. Message:", message);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  if (domContentLoadedFiredPopup) return;
  domContentLoadedFiredPopup = true;
  console.log("popup.js: DOMContentLoaded - Initializing popup (Simplified Mode).");

  initializePopupUI();
  setupEventListeners(); 

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updatePopupStatus') {
      showPopupStatus(request.message, request.type || 'info');
    }
    // Return true if you intend to send a response asynchronously, otherwise false or undefined.
    // For this listener, we are only receiving, so false is fine.
    return false; 
  });
});

function initializePopupUI() {
  const dataCollectionControls = document.getElementById('dataCollectionControls');
  if (dataCollectionControls) dataCollectionControls.style.display = 'block';
  showPopupStatus("Ready. Use floating button or options here.", "info");
}

function getCurrentLinkedInSectionFromUrlPopup(url) {
  if (!url || !url.toLowerCase().includes("linkedin.com")) return null;
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('/recent-activity/all/') || lowerUrl.includes('/detail/recent-activity/shares/')) return 'posts';
  if (lowerUrl.includes('/recent-activity/comments/')) return 'comments';
  if (lowerUrl.includes('/recent-activity/reactions/')) return 'reactions';
  if (lowerUrl.includes('/in/')) return 'profile';
  return null;
}

function getBaseProfileUrlFromUrlPopup(url) {
    if (!url) return null;
    const profileUrlMatch = url.match(/https:\/\/www\.linkedin\.com\/in\/[^/]+\/?/);
    return profileUrlMatch ? profileUrlMatch[0] : null;
}

function setupEventListeners() {
  const startNewSessionBtn = document.getElementById('startNewSessionBtnPopup');
  const collectCurrentPageBtn = document.getElementById('collectCurrentPageBtnPopup');
  const downloadCollectedBtn = document.getElementById('downloadCollectedBtnPopup');
  const refineAllDataBtnPopup = document.getElementById('refineAllDataBtnPopup'); // New button

  if (startNewSessionBtn) {
    startNewSessionBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'startNewCollectionSession' }, (response) => {
        if (chrome.runtime.lastError) {
            showPopupStatus(chrome.runtime.lastError.message || "Failed to start new session due to runtime error.", "error");
        } else if (response && !response.success) {
            showPopupStatus(response.error || "Failed to start new session.", "error");
        }
        // Success message handled by background.js via 'updatePopupStatus'
      });
    });
  }

  if (collectCurrentPageBtn) {
    collectCurrentPageBtn.addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (!tabs || tabs.length === 0 || !tabs[0]?.id || !tabs[0]?.url) {
          showPopupStatus('Cannot get active tab info.', 'error'); return;
        }
        const activeTab = tabs[0];
        const currentUrl = activeTab.url;
        const baseProfileUrl = getBaseProfileUrlFromUrlPopup(currentUrl);
        const pathKey = getCurrentLinkedInSectionFromUrlPopup(currentUrl);

        if (!baseProfileUrl) {
          showPopupStatus('Not on a recognized LinkedIn profile page (/in/...).', 'error'); return;
        }
        if (!pathKey) {
          showPopupStatus('Could not determine current LinkedIn section from URL.', 'error'); return;
        }
        showPopupStatus(`Requesting collection for ${pathKey}...`, 'info');
        chrome.runtime.sendMessage({
          action: 'initiateCurrentPageTextCollection',
          profileUrl: baseProfileUrl,
          pathKey: pathKey,
          tabId: activeTab.id 
        }, response => {
            if (chrome.runtime.lastError) {
                 showPopupStatus(chrome.runtime.lastError.message || "Failed to collect current page text due to runtime error.", "error");
            } else if (response && !response.success) {
                 showPopupStatus(response.error || "Failed to collect current page text.", "error");
            }
            // Success/detailed status handled by background.js via 'updatePopupStatus'
        });
      });
    });
  }

  if (refineAllDataBtnPopup) { // New event listener
    refineAllDataBtnPopup.addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (!tabs || tabs.length === 0 || !tabs[0]?.id || !tabs[0]?.url) {
          showPopupStatus('Cannot get active tab info to identify profile for refinement.', 'error');
          return;
        }
        const activeTab = tabs[0];
        const currentUrl = activeTab.url;
        const baseProfileUrl = getBaseProfileUrlFromUrlPopup(currentUrl);

        if (!baseProfileUrl) {
          showPopupStatus('Not on a recognized LinkedIn profile page (/in/...) to refine data.', 'error');
          return;
        }

        showPopupStatus('Initiating AI refinement for all collected sections of this profile...', 'info');
        chrome.runtime.sendMessage({
          action: 'refineAllDataWithDify',
          profileUrl: baseProfileUrl,
          tabId: activeTab.id // Pass tabId for UI updates
        }, response => {
          if (chrome.runtime.lastError) {
            showPopupStatus(chrome.runtime.lastError.message || "Refinement request failed to send.", "error");
          } else if (response && !response.success) {
            showPopupStatus(response.error || "Refinement process encountered an error.", "error");
          } else if (response && response.success) {
            // More detailed success/status updates will come from background via updatePopupStatus
            showPopupStatus(response.message || "Refinement process initiated. See floating UI for progress.", "success");
          }
        });
      });
    });
  }

  if (downloadCollectedBtn) {
    downloadCollectedBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'downloadCollectedDataFile' }, response => {
         if (chrome.runtime.lastError) {
            showPopupStatus(chrome.runtime.lastError.message || "Download request failed due to runtime error.", "error");
         } else if (response && !response.success) {
            showPopupStatus(response.error || "Download request failed.", "error");
         }
          // Success message handled by background.js via 'updatePopupStatus'
      });
    });
  }
}