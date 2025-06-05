// floating-ui.js - Full rewritten file with changes focused on the onMessage listener

(function() {
  const SCRIPT_NAME = "FloatingUI_v4_FinalDebug"; // New version for this fix
  if (window.linkedInExtractorFloatingUIMarker_v4_FinalDebug) {
    console.log(`${SCRIPT_NAME}: Already initialized.`);
    return;
  }
  window.linkedInExtractorFloatingUIMarker_v4_FinalDebug = true;
  console.log(`${SCRIPT_NAME}: Initializing...`);

  let isMenuOpen = false;
  let isProcessingAction = false; // This flag indicates if the UI *thinks* an action is ongoing

  let floatingButton, menu, toastContainer;
  const sfx = "_floatV4";

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
      .le-float-btn${sfx}.success_icon${sfx} .icon-default${sfx} { /* color: #4CAF50; */ } /* Style via icon content now */
      .le-float-btn${sfx}.error_icon${sfx} .icon-default${sfx} { /* color: #D32F2F; */ } /* Style via icon content now */

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
    // console.log(`${SCRIPT_NAME}: Styles injected.`);
  }

  function createBaseUI() {
    const floatingButtonId = `le-float-btn-id${sfx}`;
    if (document.getElementById(floatingButtonId)) {
      // console.warn(`${SCRIPT_NAME}: Floating button UI (id: ${floatingButtonId}) already exists.`);
      floatingButton = document.getElementById(floatingButtonId);
      menu = document.getElementById(`le-menu-id${sfx}`);
      toastContainer = document.getElementById(`le-toast-container-id${sfx}`);
      if (floatingButton && !floatingButton.dataset.listenerAttached) {
          floatingButton.addEventListener('click', toggleMenu);
          floatingButton.dataset.listenerAttached = 'true';
      }
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
    floatingButton.dataset.listenerAttached = 'true';
    document.addEventListener('click', (e) => {
      if (isMenuOpen && menu && floatingButton && !menu.contains(e.target) && !floatingButton.contains(e.target)) {
        toggleMenu(false);
      }
    });
    // console.log(`${SCRIPT_NAME}: Base UI elements created.`);
  }

  function populateMenu() {
    if (!menu) { /* console.error(`${SCRIPT_NAME}: Menu element not found during populateMenu.`); */ return; }
    menu.innerHTML = ''; // Clear previous items
    menu.insertAdjacentHTML('beforeend', `
      <div class="le-menu-title${sfx}">Data Collection</div>
      <button class="le-menu-item${sfx}" data-action="startNewCollectionSession">Start New Session</button>
      <div class="le-menu-divider${sfx}"></div>
      <button class="le-menu-item${sfx}" data-action="initiateCurrentPageTextCollection">Collect Current Page Text</button>
      <div class="le-menu-divider${sfx}"></div>
      <button class="le-menu-item${sfx}" data-action="downloadCollectedDataFile">Download Collected Data</button>
    `);
    menu.querySelectorAll(`.le-menu-item${sfx}`).forEach(item => {
      item.removeEventListener('click', handleMenuAction);
      item.addEventListener('click', handleMenuAction);
    });
    // console.log(`${SCRIPT_NAME}: Menu populated.`);
  }

  function showToast(message, type = 'info', duration = 4500) {
    if (!toastContainer) { /* console.warn(`${SCRIPT_NAME}: Toast container not found`); */ return; }
    const toast = document.createElement('div');
    toast.className = `le-toast${sfx} ${type}${sfx}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    requestAnimationFrame(() => { toast.classList.add(`show${sfx}`); });
    setTimeout(() => {
      toast.classList.remove(`show${sfx}`);
      setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 500);
    }, duration);
  }

 function setButtonState(newState) {
    if (!floatingButton) { /* console.error(`${SCRIPT_NAME}: Floating button is null in setButtonState.`); */ return; }
    isProcessingAction = (newState === 'processing'); // Update global flag based on intended state

    floatingButton.classList.remove(`processing${sfx}`, `success_icon${sfx}`, `error_icon${sfx}`);
    const iconDefault = floatingButton.querySelector(`.icon-default${sfx}`);
    if (!iconDefault) { // Ensure icons exist
        floatingButton.innerHTML = `<span class="icon-default${sfx}">LD</span><span class="icon-processing${sfx}">⚙️</span>`;
        iconDefault = floatingButton.querySelector(`.icon-default${sfx}`);
    }
    
    switch(newState) {
      case 'processing':
        floatingButton.classList.add(`processing${sfx}`);
        if (iconDefault) iconDefault.textContent = 'LD';
        break;
      case 'success':
        if (iconDefault) iconDefault.textContent = '✅';
        // floatingButton.classList.add(`success_icon${sfx}`); // Optional class for further styling
        break;
      case 'error':
        if (iconDefault) iconDefault.textContent = '❌';
        // floatingButton.classList.add(`error_icon${sfx}`); // Optional class
        break;
      default: // 'default'
        if (iconDefault) iconDefault.textContent = 'LD';
        break;
    }

    if (newState === 'success' || newState === 'error') {
        setTimeout(() => {
            if (!isProcessingAction && floatingButton.querySelector(`.icon-default${sfx}`) &&
                (floatingButton.querySelector(`.icon-default${sfx}`).textContent === '✅' || floatingButton.querySelector(`.icon-default${sfx}`).textContent === '❌') ) {
                setButtonState('default');
            }
        }, 3000);
    }
  }

  function toggleMenu(forceState) {
    if (!menu) { return; }
    const shouldBeOpen = (typeof forceState === 'boolean') ? forceState : !isMenuOpen;
    if (shouldBeOpen && isProcessingAction && action !== 'startNewCollectionSession' && action !== 'downloadCollectedDataFile') {
        showToast('Action in progress. Please wait.', 'warning');
        return;
    }
    isMenuOpen = shouldBeOpen;
    menu.classList.toggle(`show${sfx}`, isMenuOpen);
  }

  const getCurrentPageInfoForCollection = () => { /* ... (this function remains the same as your last full version) ... */
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
    const action = targetButton.dataset.action;

    // Allow some actions even if 'isProcessingAction' is true for another type of action
    if (isProcessingAction && action === 'initiateCurrentPageTextCollection') {
        showToast('Previous page collection still in progress. If stuck, try "Start New Session".', 'warning', 5000);
        console.warn(`${SCRIPT_NAME}: Menu action '${action}' blocked, isProcessingAction is true.`);
        return;
    }

    console.log(`${SCRIPT_NAME}: Menu action initiated: ${action}`);
    toggleMenu(false);

    if (action === 'initiateCurrentPageTextCollection' || action === 'startNewCollectionSession' || action === 'downloadCollectedDataFile') {
        setButtonState('processing'); // Set to processing *before* sending message
    }

    let messagePayload = { action: action };
    let initialToastMessage = 'Processing...';

    if (action === 'initiateCurrentPageTextCollection') {
        const pageInfo = getCurrentPageInfoForCollection();
        if (pageInfo.error) {
          showToast(pageInfo.error, 'error');
          setButtonState('error');
          return;
        }
        initialToastMessage = `Collecting text for current '${pageInfo.pathKey}' page...`;
        messagePayload.profileUrl = pageInfo.baseProfileUrl;
        messagePayload.pathKey = pageInfo.pathKey;
    } else if (action === 'startNewCollectionSession') {
        initialToastMessage = 'Starting new data collection session...';
    } else if (action === 'downloadCollectedDataFile') {
        initialToastMessage = 'Preparing collected data for download...';
    } else {
        console.error(`${SCRIPT_NAME}: Unknown action in menu: ${action}`);
        showToast(`Error: Unknown action '${action}'`, "error");
        setButtonState('default'); // Reset if action is unknown
        return;
    }

    showToast(initialToastMessage, 'info');
    // console.log(`${SCRIPT_NAME}: Sending message to background:`, messagePayload);

    if (!chrome.runtime?.id) {
      console.error(`${SCRIPT_NAME}: Extension context invalidated before sending message for action '${action}'.`);
      showToast('Extension context lost. Please reload page and extension.', 'error', 7000);
      setButtonState('error');
      return;
    }
      chrome.runtime.sendMessage(messagePayload, (response) => {
        if (!chrome.runtime?.id) {
          console.warn(`${SCRIPT_NAME}: Context invalidated before/during response for '${action}'. Button state may rely on separate update.`);
          // If we were processing, and context dies, we can't be sure of outcome.
          // The 'updateFloatingUIStatus' handler should ideally catch final state if background is still alive.
          // For now, if processing, assume it might have failed from UI perspective.
          if (isProcessingAction && (action === 'initiateCurrentPageTextCollection' || action === 'startNewCollectionSession')) {
              setButtonState('error'); // Cautious reset if context dies during these key ops
          }
          return;
        }

        // console.log(`${SCRIPT_NAME}: Direct response from background for '${action}':`, response);

        if (chrome.runtime.lastError) {
          const errorMsgBase = `Runtime Error for ${action}`;
          let specificError = chrome.runtime.lastError.message;
          console.error(`${SCRIPT_NAME}: ${errorMsgBase}: ${specificError}`);

          if (specificError.includes("Extension context invalidated")) {
             showToast('Extension context lost. Reload page/extension.', 'error', 7000);
          } else if (specificError.includes("Could not establish connection")) {
             showToast('Cannot connect to background. Reload extension & page.', 'error', 7000);
          } else {
            showToast(`${errorMsgBase}: ${specificError.substring(0,100)}`, 'error');
          }
          setButtonState('error');
          return;
        }

        if (response == null) {
            console.warn(`${SCRIPT_NAME}: No response object from background for ${action}.`);
            // This state should ideally be updated by a follow-up 'updateFloatingUIStatus' if processing was long
            // If not, it implies background didn't respond as expected.
            if (isProcessingAction) { // If we were waiting for this response to stop processing
                showToast(`No response from background for ${action}. Check logs.`, 'error');
                setButtonState('error');
            }
            return;
        }
        
        // Primary UI updates (toast, final button state) are driven by 'updateFloatingUIStatus' from background.js.
        // This direct callback can handle immediate success/failure that doesn't involve long background processing
        // or act as a final check if the button is still 'processing'.
        if (!response.success) {
            // console.error(`${SCRIPT_NAME}: Background reported failure for ${action}: ${response.error || 'Unknown error'}`);
            // Toast and button state should have been set by 'updateFloatingUIStatus type:error'
            // But if we get here and it's still processing, force error state.
            if (isProcessingAction) {
                showToast(response.error || `Action ${action} failed.`, 'error');
                setButtonState('error');
            }
        } else { // response.success is true
            // For actions like 'startNewSession' or successful 'downloadInitiated',
            // where background.js might send success quickly.
            if ((action === 'startNewCollectionSession' || action === 'downloadCollectedDataFile') && isProcessingAction) {
                // Toast for these specific actions might have already been shown by updateUIs from background.
                // But ensure button state is updated if it was a quick success.
                setButtonState('success'); // This will revert to default after timeout
            }
            // If it's 'initiateCurrentPageTextCollection' and response.success is true,
            // the 'updateFloatingUIStatus' with type 'success' or 'warning' from background.js is the main driver.
            // If still 'processing' here, it means the final status update from background hasn't arrived or wasn't 'success'/'error'.
            // We don't want to prematurely set to 'default' if background is still working.
        }
      });
    } catch (e) {
  function initialize() {
    // console.log(`${SCRIPT_NAME}: DOM ready, running initialize().`);
    try {
        createStyles();
        createBaseUI();
        populateMenu();
        setButtonState('default');

        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
          if (!chrome.runtime?.id) {
            console.warn(`${SCRIPT_NAME}: Extension context invalidated. Ignoring message:`, request.action);
            return false; // Must return false or nothing if not sending a response
          }

          // Check if the sender's tab is still open before processing the message
          if (sender.tab && (!sender.tab.id || !sender.tab.windowId)) {
            console.warn(`${SCRIPT_NAME}: Sender tab is no longer valid. Ignoring message:`, request.action);
            return false; // Must return false or nothing if not sending a response
          }

          if (request.action === 'updateFloatingUIStatus') {
            // console.log(`${SCRIPT_NAME}: Processing 'updateFloatingUIStatus' - Type: ${request.type}, Msg: "${request.message ? request.message.substring(0,100) : 'N/A'}"`);
            showToast(request.message || 'Status update', request.type || 'info');

            // THIS IS THE PRIMARY PLACE TO UPDATE BUTTON STATE FROM BACKGROUND MESSAGES
            if (request.type === 'success') {
                setButtonState('success'); // Will show success icon, then revert to default
            } else if (request.type === 'error') {
                setButtonState('error');   // Will show error icon, then revert to default
            } else if (request.type === 'warning') {
                // For warnings, decide if it implies processing stopped.
                // If it's a warning but the process completed, show 'default' or 'error' based on msg.
                const msgLower = request.message ? request.message.toLowerCase() : "";
                if (msgLower.includes("failed") || msgLower.includes("error") || msgLower.includes("⚠️")) {
                    setButtonState('error');
                } else {
                    // A warning might still mean processing finished.
                    setButtonState('default'); // Revert to default, temporary icon will fade.
                }
            } else if (request.type === 'info') {
                // If it's an 'info' message and we were 'processing',
                // and the message implies completion, reset the button.
                const msgLower = request.message ? request.message.toLowerCase() : "";
                if (isProcessingAction && (msgLower.includes("complete") || msgLower.includes("finished") || msgLower.includes("saved") || msgLower.includes("cleared") || msgLower.includes("initiated"))) {
                     setButtonState('default');
                }
                // Otherwise, if 'info' and still processing, leave button as 'processing'.
            }
          }
          return false; // Indicate that we are not sending an async response from this listener
        });
        console.log(`${SCRIPT_NAME}: Initialization complete. Floating UI is active.`);
        showToast('LinkedIn Data Extractor UI active.', 'info', 2000);
    } catch (e) {
        console.error(`${SCRIPT_NAME}: CRITICAL ERROR during initialization:`, e);
        if (typeof alert === 'function') { // Check if alert is available (might not be in all contexts)
            alert("Error initializing LinkedIn Data Extractor UI. Check browser console (F12) for details and try reloading the page/extension.");
        }
    }
  }

  if (window.location.host.includes("linkedin.com")) {
      if (document.readyState === "complete" || document.readyState === "interactive") {
          initialize();
      } else {
          document.addEventListener("DOMContentLoaded", initialize);
      }
  } else {
      // console.log(`${SCRIPT_NAME}: Not a LinkedIn page. UI will not load.`);
  }
})();
