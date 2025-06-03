// popup.js
let domContentLoadedFiredPopup = false;

function showPopupStatus(message, type = "info") {
  const statusDiv = document.getElementById('status');
  if (statusDiv) {
    statusDiv.textContent = message;
    statusDiv.className = 'status-message';
    statusDiv.classList.add(type);
    statusDiv.style.display = 'block';
    if (type !== 'error') {
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
  setupEventListeners(); // Renamed from setupNewModeListenersForPopup

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updatePopupStatus') {
      showPopupStatus(request.message, request.type || 'info');
    }
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

  if (startNewSessionBtn) {
    startNewSessionBtn.addEventListener('click', () => {
      // Status updated by background.js via 'updatePopupStatus'
      chrome.runtime.sendMessage({ action: 'startNewCollectionSession' }, (response) => {
        if (chrome.runtime.lastError || (response && !response.success)) {
            showPopupStatus(chrome.runtime.lastError?.message || response?.error || "Failed to start new session.", "error");
        }
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
        // Status updated by background.js
        chrome.runtime.sendMessage({
          action: 'initiateCurrentPageTextCollection',
          profileUrl: baseProfileUrl,
          pathKey: pathKey,
          tabId: activeTab.id // Explicitly pass tabId for popup-initiated actions
        }, response => {
            if (chrome.runtime.lastError || (response && !response.success)) {
                 showPopupStatus(chrome.runtime.lastError?.message || response?.error || "Failed to collect current page text.", "error");
            }
        });
      });
    });
  }

  if (downloadCollectedBtn) {
    downloadCollectedBtn.addEventListener('click', () => {
      // Status updated by background.js
      chrome.runtime.sendMessage({ action: 'downloadCollectedDataFile' }, response => {
         if (chrome.runtime.lastError || (response && !response.success)) {
            showPopupStatus(chrome.runtime.lastError?.message || response?.error || "Download request failed.", "error");
         }
      });
    });
  }
}