// floating-ui.js (v4-fully-rewritten)

(function() {
  const SCRIPT_NAME = "FloatingUI_v4";
  if (window.linkedInExtractorFloatingUIMarker_v4) {
    console.log(`${SCRIPT_NAME}: Already initialized. Aborting to prevent duplicates.`);
    return;
  }
  window.linkedInExtractorFloatingUIMarker_v4 = true;
  console.log(`${SCRIPT_NAME}: Initializing...`);

  let isMenuOpen = false;
  let isProcessingAction = false;

  let floatingButton, menu, toastContainer;
  const sfx = "_floatV4"; // Suffix for CSS classes and IDs to ensure uniqueness

  function createStyles() {
    const stylesId = `le-styles${sfx}`;
    if (document.getElementById(stylesId)) return;
    const styles = document.createElement('style');
    styles.id = stylesId;
    styles.textContent = `
      .le-float-btn${sfx} { position: fixed; bottom: 20px; right: 20px; width: 56px; height: 56px; background-color: #006097; color: white; border-radius: 50%; border: 2px solid white; cursor: pointer; box-shadow: 0 5px 15px rgba(0,0,0,0.25); z-index: 2147483640; transition: all 0.25s ease-out; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold; font-family: Arial, sans-serif; }
      .le-float-btn${sfx}:hover { transform: scale(1.1); box-shadow: 0 8px 20px rgba(0,0,0,0.3); background-color: #0073b1; }
      .le-float-btn${sfx} .icon-default${sfx} { display: inline-block; line-height:1; }
      .le-float-btn${sfx} .icon-processing${sfx} { display: none; animation: le-rotate${sfx} 1.2s linear infinite; line-height:1; }
      .le-float-btn${sfx}.processing${sfx} .icon-default${sfx} { display: none; }
      .le-float-btn${sfx}.processing${sfx} .icon-processing${sfx} { display: inline-block; }
      .le-toast-container${sfx} { position: fixed; bottom: 85px; right: 20px; z-index: 2147483639; display: flex; flex-direction: column; gap: 10px; max-width: 320px; }
      .le-toast${sfx} { background-color: #333; color: white; padding: 12px 18px; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); opacity: 0; transform: translateX(110%); transition: all 0.4s cubic-bezier(0.21,0.95,0.53,1); font-family: Arial, sans-serif; font-size: 13px; line-height: 1.45; word-wrap: break-word; }
      .le-toast${sfx}.show${sfx} { opacity: 1; transform: translateX(0); }
      .le-toast${sfx}.info${sfx} { background-color: #2779bd; }
      .le-toast${sfx}.success${sfx} { background-color: #4CAF50; }
      .le-toast${sfx}.error${sfx} { background-color: #D32F2F; }
      .le-toast${sfx}.warning${sfx} { background-color: #FFA000; }
      .le-menu${sfx} { position: fixed; bottom: 85px; right: 20px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); padding: 8px; display: none; z-index: 2147483638; min-width: 270px; border: 1px solid #ddd; }
      .le-menu${sfx}.show${sfx} { display: block; animation: le-fadeInScaleUp${sfx} 0.25s ease-out forwards; }
      @keyframes le-fadeInScaleUp${sfx} { from { opacity: 0.5; transform: translateY(8px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
      .le-menu-item${sfx} { padding: 10px 15px; cursor: pointer; border-radius: 5px; transition: background-color 0.1s ease-in-out; font-size: 13.5px; color: #222; border: none; width: 100%; text-align: left; background: none; font-family: Arial, sans-serif; display: block; margin-bottom: 3px; }
      .le-menu-item${sfx}:hover { background-color: #f1f5f8; color: #005689; }
      .le-menu-item${sfx}:active { background-color: #e9eef1; }
      .le-menu-divider${sfx} { height: 1px; background-color: #e8e8e8; margin: 7px 0; }
      .le-menu-title${sfx} { padding: 6px 15px 8px; font-size: 11px; color: #777; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
      @keyframes le-rotate${sfx} { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(styles);
    console.log(`${SCRIPT_NAME}: Styles injected.`);
  }

  function createBaseUI() {
    const floatingButtonId = `le-float-btn-id${sfx}`;
    if (document.getElementById(floatingButtonId)) {
      console.warn(`${SCRIPT_NAME}: Floating button UI (id: ${floatingButtonId}) already exists. Skipping UI creation.`);
      floatingButton = document.getElementById(floatingButtonId); // Re-assign existing
      menu = document.getElementById(`le-menu-id${sfx}`);
      toastContainer = document.getElementById(`le-toast-container-id${sfx}`);
      return;
    }

    toastContainer = document.createElement('div');
    toastContainer.className = `le-toast-container${sfx}`;
    toastContainer.id = `le-toast-container-id${sfx}`;
    document.body.appendChild(toastContainer);

    floatingButton = document.createElement('button');
    floatingButton.className = `le-float-btn${sfx}`;
    floatingButton.id = floatingButtonId;
    floatingButton.innerHTML = `<span class="icon-default${sfx}">LD</span><span class="icon-processing${sfx}">⚙️</span>`;
    floatingButton.title = 'LinkedIn Data Collector';
    document.body.appendChild(floatingButton);

    menu = document.createElement('div');
    menu.className = `le-menu${sfx}`;
    menu.id = `le-menu-id${sfx}`;
    document.body.appendChild(menu);

    floatingButton.addEventListener('click', toggleMenu);
    document.addEventListener('click', (e) => {
      if (isMenuOpen && menu && floatingButton && !menu.contains(e.target) && !floatingButton.contains(e.target)) {
        toggleMenu(false);
      }
    });
    console.log(`${SCRIPT_NAME}: Base UI elements created and event listeners attached.`);
  }

  function populateMenu() {
    if (!menu) { console.error(`${SCRIPT_NAME}: Menu element not found during populateMenu.`); return; }
    menu.innerHTML = '';
    // Using camelCase for data-action to match background.js expectations
    menu.insertAdjacentHTML('beforeend', `
      <div class="le-menu-title${sfx}">Data Collection</div>
      <button class="le-menu-item${sfx}" data-action="startNewCollectionSession">Start New Session</button>
      <div class="le-menu-divider${sfx}"></div>
      <button class="le-menu-item${sfx}" data-action="initiateCurrentPageTextCollection">Collect Current Page Text</button>
      <div class="le-menu-divider${sfx}"></div>
      <button class="le-menu-item${sfx}" data-action="downloadCollectedDataFile">Download Collected Data</button>
    `);
    menu.querySelectorAll(`.le-menu-item${sfx}`).forEach(item => {
      item.addEventListener('click', handleMenuAction);
    });
    console.log(`${SCRIPT_NAME}: Menu populated with actions.`);
  }

  function showToast(message, type = 'info', duration = 4500) {
    if (!toastContainer) { console.warn(`${SCRIPT_NAME}: Toast container not found, cannot show toast: "${message}"`); return; }
    console.log(`${SCRIPT_NAME}: Toast - Type: ${type}, Message: "${message.substring(0,100)}"`);
    const toast = document.createElement('div');
    toast.className = `le-toast${sfx} ${type}${sfx}`; // Use suffixed type class
    toast.textContent = message;
    toastContainer.appendChild(toast);
    requestAnimationFrame(() => { // Ensure element is in DOM for transition
        toast.classList.add(`show${sfx}`);
    });
    setTimeout(() => {
      toast.classList.remove(`show${sfx}`);
      setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 500);
    }, duration);
  }

 function setButtonState(newState) {
    if (!floatingButton) { console.error(`${SCRIPT_NAME}: Floating button is null in setButtonState.`); return; }
    console.log(`${SCRIPT_NAME}: Setting button state to: ${newState}. Was processing: ${isProcessingAction}`);

    isProcessingAction = (newState === 'processing');

    floatingButton.classList.remove(`processing${sfx}`, `success${sfx}`, `error${sfx}`);
    
    if (!floatingButton.querySelector(`.icon-default${sfx}`) || !floatingButton.querySelector(`.icon-processing${sfx}`)) {
        floatingButton.innerHTML = `<span class="icon-default${sfx}">LD</span><span class="icon-processing${sfx}">⚙️</span>`;
    }
    const iconDefault = floatingButton.querySelector(`.icon-default${sfx}`);
    const iconProcessing = floatingButton.querySelector(`.icon-processing${sfx}`);

    if (!iconDefault || !iconProcessing) { console.error(`${SCRIPT_NAME}: Icons not found after ensuring innerHTML.`); return;}

    switch(newState) {
      case 'processing':
        floatingButton.classList.add(`processing${sfx}`);
        break;
      case 'success':
        iconDefault.textContent = '✅';
        // floatingButton.classList.add(`success${sfx}`); // Optional specific class for styling
        break;
      case 'error':
        iconDefault.textContent = '❌';
        // floatingButton.classList.add(`error${sfx}`); // Optional specific class for styling
        break;
      default: // 'default'
        iconDefault.textContent = 'LD';
        break;
    }
    console.log(`${SCRIPT_NAME}: Button state set. ClassList: ${floatingButton.classList}, isProcessingAction: ${isProcessingAction}`);

    if (newState === 'success' || newState === 'error') {
        setTimeout(() => {
            if (!isProcessingAction && (iconDefault.textContent === '✅' || iconDefault.textContent === '❌')) {
                console.log(`${SCRIPT_NAME}: Reverting icon from temporary state '${newState}' to default.`);
                setButtonState('default');
            } else {
                console.log(`${SCRIPT_NAME}: Not reverting icon; isProcessingAction is ${isProcessingAction} or icon changed.`);
            }
        }, 3000);
    }
  }

  function toggleMenu(forceState) {
    if (!menu) { console.error(`${SCRIPT_NAME}: Menu not available in toggleMenu.`); return;}
    if (typeof forceState === 'boolean') { isMenuOpen = forceState; }
    else {
        if (isProcessingAction && isMenuOpen) { isMenuOpen = false; }
        else if (isProcessingAction) { showToast('Action in progress. Please wait.', 'warning'); return; }
        else { isMenuOpen = !isMenuOpen; }
    }
    menu.classList.toggle(`show${sfx}`, isMenuOpen);
    console.log(`${SCRIPT_NAME}: Menu toggled. Is open: ${isMenuOpen}`);
  }

  const getCurrentPageInfoForCollection = () => {
      const url = window.location.href;
      if (!url.toLowerCase().includes("linkedin.com")) return { error: "Not a LinkedIn page." };
      const lowerUrl = url.toLowerCase();
      let pathKey = null;
      if (lowerUrl.includes('/recent-activity/all/') || lowerUrl.includes('/detail/recent-activity/shares/')) pathKey = 'posts';
      else if (lowerUrl.includes('/recent-activity/comments/')) pathKey = 'comments';
      else if (lowerUrl.includes('/recent-activity/reactions/')) pathKey = 'reactions';
      else if (lowerUrl.includes('/in/')) pathKey = 'profile';
      const profileUrlMatch = url.match(/https:\/\/www\.linkedin\.com\/in\/[^/]+\/?/);
      const baseProfileUrl = profileUrlMatch ? profileUrlMatch[0] : null;
      if (!baseProfileUrl) return { error: "Could not determine base profile URL (/in/...)."};
      if (!pathKey) return { baseProfileUrl: baseProfileUrl, error: "Could not determine page section (profile, posts, etc.)."};
      return { baseProfileUrl, pathKey, currentUrl: url, error: null };
  };

  function handleMenuAction(e) {
    const targetButton = e.currentTarget;
    if (isProcessingAction) {
        showToast('Previous action still in progress.', 'warning');
        console.warn(`${SCRIPT_NAME}: Menu action blocked, isProcessingAction is true.`);
        return;
    }
    const action = targetButton.dataset.action; // This should now be camelCase
    console.log(`${SCRIPT_NAME}: Menu action initiated: ${action}`);
    toggleMenu(false);
    setButtonState('processing');

    let messagePayload = { action: action };
    let initialToastMessage = 'Processing...';

    if (action === 'initiateCurrentPageTextCollection') {
        const pageInfo = getCurrentPageInfoForCollection();
        if (pageInfo.error) {
          showToast(pageInfo.error, 'error');
          setButtonState('error'); return;
        }
        initialToastMessage = `Collecting text for current '${pageInfo.pathKey}' page...`;
        messagePayload.profileUrl = pageInfo.baseProfileUrl;
        messagePayload.pathKey = pageInfo.pathKey;
    } else if (action === 'startNewCollectionSession') {
        initialToastMessage = 'Starting new data collection session...';
    } else if (action === 'downloadCollectedDataFile') {
        initialToastMessage = 'Preparing collected data for download...';
    } else {
        console.error(`${SCRIPT_NAME}: Unknown action defined in menu item: ${action}`);
        showToast(`Error: Unknown action '${action}'`, "error");
        setButtonState('default'); return; // Revert to default if action is truly unknown
    }

    showToast(initialToastMessage, 'info');
    console.log(`${SCRIPT_NAME}: Sending message to background:`, messagePayload);

    chrome.runtime.sendMessage(messagePayload, (response) => {
        console.log(`${SCRIPT_NAME}: Direct response from background for action '${action}':`, response);
        if (chrome.runtime.lastError) {
            const errorMsg = `Runtime Error from background: ${chrome.runtime.lastError.message}`;
            console.error(`${SCRIPT_NAME}: ${errorMsg}`);
            showToast(errorMsg, 'error');
            setButtonState('error'); // Critical error from extension system
            return;
        }
        if (response) {
            if (!response.success && response.error) {
                console.error(`${SCRIPT_NAME}: Background reported immediate error for ${action}: ${response.error}`);
                showToast(`Error: ${response.error}`, 'error');
                setButtonState('error'); // Action failed as per background's direct response
            } else if (response.success) {
                // Most UI updates (like icon changes from spinning to success)
                // should come from a subsequent 'updateFloatingUIStatus' message.
                // This direct response is more of an acknowledgement.
                console.log(`${SCRIPT_NAME}: Background acknowledged ${action}. Message: ${response.message || '(No message)'}`);
            }
        } else {
             console.warn(`${SCRIPT_NAME}: No direct response object from background for ${action}. This might be normal if background uses async sendResponse later, but unusual for these actions.`);
             // If background doesn't sendResponse, floating UI will wait for updateFloatingUIStatus.
        }
    });
  }

  function initialize() {
    console.log(`${SCRIPT_NAME}: DOM ready, running initialize().`);
    try {
        createStyles();
        createBaseUI(); // This will re-assign global vars if UI already exists
        populateMenu();
        setButtonState('default');

        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
          console.log(`${SCRIPT_NAME}: General message listener received:`, request);
          if (request.action === 'updateFloatingUIStatus') {
            console.log(`${SCRIPT_NAME}: Processing 'updateFloatingUIStatus' - Type: ${request.type}, Msg: "${request.message ? request.message.substring(0,100) : 'N/A'}"`);
            showToast(request.message || 'Status update', request.type || 'info');

            if (request.type === 'success') {
                setButtonState('success');
            } else if (request.type === 'error') {
                setButtonState('error');
            } else if (request.type === 'info' || request.type === 'warning') {
                // Typically, 'info' or 'warning' updates from background don't change the button from 'processing'
                // unless the message text itself implies a final state.
                const msgLower = request.message ? request.message.toLowerCase() : "";
                if (isProcessingAction && (msgLower.includes("complete") || msgLower.includes("finished") || msgLower.includes("saved") || msgLower.includes("cleared") || msgLower.includes("initiated"))) {
                    console.log(`${SCRIPT_NAME}: Info/warning message implies completion while processing, setting to default.`);
                    setButtonState('default');
                } else if (isProcessingAction) {
                    console.log(`${SCRIPT_NAME}: Info/warning update received while processing, button state remains 'processing'.`);
                } else {
                    // If not processing, just show the toast, button state remains default.
                }
            }
          }
          return false; // Not using sendResponse from this listener
        });
        console.log(`${SCRIPT_NAME}: Initialization complete. Floating UI is active.`);
    } catch (e) {
        console.error(`${SCRIPT_NAME}: CRITICAL ERROR during initialization:`, e);
        showToast("Error initializing Floating UI. Check console.", "error", 10000);
    }
  }

  if (window.location.host.includes("linkedin.com")) {
      if (document.readyState === "complete" || document.readyState === "interactive") {
          initialize();
      } else {
          document.addEventListener("DOMContentLoaded", initialize);
      }
  } else {
      console.log(`${SCRIPT_NAME}: Not a LinkedIn page. UI will not load.`);
  }
})();