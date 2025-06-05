// floating-ui.js
// Version: FloatingUI_v4_FinalDebug_SyntaxFixed (incorporates previous fixes and ensures syntax)

(function() {
  const SCRIPT_NAME = "FloatingUI_v4_FinalDebug_SyntaxFixed";
  if (window.linkedInExtractorFloatingUIMarker_v4_FinalDebug_SyntaxFixed) {
    console.log(`${SCRIPT_NAME}: Already initialized.`);
    return;
  }
  window.linkedInExtractorFloatingUIMarker_v4_FinalDebug_SyntaxFixed = true;
  console.log(`${SCRIPT_NAME}: Initializing...`);

  let isMenuOpen = false;
  let isProcessingAction = false; 

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
  }

  function createBaseUI() {
    const floatingButtonId = `le-float-btn-id${sfx}`;
    if (document.getElementById(floatingButtonId)) {
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
  }

  function populateMenu() {
    if (!menu) { return; }
    menu.innerHTML = ''; 
    menu.insertAdjacentHTML('beforeend', `
      <div class="le-menu-title${sfx}">Data Collection</div>
      <button class="le-menu-item${sfx}" data-action="startNewCollectionSession">Start New Session</button>
      <div class="le-menu-divider${sfx}"></div>
      <button class="le-menu-item${sfx}" data-action="initiateCurrentPageTextCollection">Collect Current Page Text</button>
      <div class="le-menu-divider${sfx}"></div>
      <button class="le-menu-item${sfx}" data-action="refineAllDataWithDify">Refine All Sections with AI</button>
      <div class="le-menu-divider${sfx}"></div>
      <button class="le-menu-item${sfx}" data-action="downloadCollectedDataFile">Download Collected Data</button>
    `);
    menu.querySelectorAll(`.le-menu-item${sfx}`).forEach(item => {
      item.removeEventListener('click', handleMenuAction); // Ensure no duplicate listeners
      item.addEventListener('click', handleMenuAction);
    });
  }

  function showToast(message, type = 'info', duration = 4500) {
    if (!toastContainer) { return; }
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
    if (!floatingButton) { return; }
    
    floatingButton.classList.remove(`processing${sfx}`);

    if (window.buttonStateTimeout) {
        clearTimeout(window.buttonStateTimeout);
        window.buttonStateTimeout = null;
    }
    
    isProcessingAction = (newState === 'processing');
    
    console.log(`${SCRIPT_NAME}: Button state changing from ${floatingButton.dataset.currentState || 'unknown'} to ${newState}. isProcessingAction: ${isProcessingAction}`);
    floatingButton.dataset.currentState = newState;

    let iconDefault = floatingButton.querySelector(`.icon-default${sfx}`);
    if (!iconDefault) { 
        floatingButton.innerHTML = `<span class="icon-default${sfx}">LD</span><span class="icon-processing${sfx}">⚙️</span>`;
        iconDefault = floatingButton.querySelector(`.icon-default${sfx}`);
    }
    
    switch(newState) {
      case 'processing':
        floatingButton.classList.add(`processing${sfx}`); 
        if (iconDefault) iconDefault.textContent = 'LD'; 
        
        window.buttonStateTimeout = setTimeout(() => {
            console.warn(`${SCRIPT_NAME}: Processing timeout reached (30s for simple, longer for Dify externally). Resetting button state if not externally managed.`);
            if (isProcessingAction && floatingButton.classList.contains(`processing${sfx}`)) { 
                showToast('Operation timed out or background is still working. If stuck, try manual reset or check data.', 'warning', 6000);
                setButtonState('default'); 
            }
        }, 30000); // This timeout is a fallback; Dify might take longer, its updates should reset the button via messages.
        break;
        
      case 'success':
        if (iconDefault) iconDefault.textContent = '✅'; 
        break;
        
      case 'error':
        if (iconDefault) iconDefault.textContent = '❌'; 
        break;
        
      default: 
        if (iconDefault) iconDefault.textContent = 'LD'; 
        break;
    }

    if (newState === 'success' || newState === 'error') {
        window.buttonStateTimeout = setTimeout(() => {
            const currentIconDefault = floatingButton.querySelector(`.icon-default${sfx}`); 
            if (!isProcessingAction && currentIconDefault &&
                (currentIconDefault.textContent === '✅' || currentIconDefault.textContent === '❌')) {
                console.log(`${SCRIPT_NAME}: Auto-reverting ${newState} state to default after 3s`);
                setButtonState('default');
            }
        }, 3000);
    }
    console.log(`${SCRIPT_NAME}: setButtonState END. New state: ${newState}. Button classes: ${floatingButton.className}`);
  }

  function toggleMenu(forceState) {
    if (!menu) { return; }
    const shouldBeOpen = (typeof forceState === 'boolean') ? forceState : !isMenuOpen;

    if (shouldBeOpen && isProcessingAction) {
        showToast('Action in progress. Please wait.', 'warning');
        return;
    }

    isMenuOpen = shouldBeOpen;
    menu.classList.toggle(`show${sfx}`, isMenuOpen);
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
      if (!baseProfileUrl && pathKey === 'profile') { // if it's a profile page, we really need the baseProfileUrl
          return { error: "Could not determine base profile URL (/in/...) for profile page."};
      }
      // For activity pages, baseProfileUrl might still be relevant if we can derive it for context.
      // If not, some actions (like refinement by profileURL) might be restricted if baseProfileUrl is null.
      // For now, we pass what we have.
      if (!pathKey && url.includes('/in/')) { // If on a profile but no specific activity sub-page
          pathKey = 'profile'; // Default to profile section
      }
      if (!pathKey && !baseProfileUrl) { // If we have neither, it's problematic for some actions
          return {error: "Could not determine a valid LinkedIn section or profile URL from the current page."};
      }
      
      return { baseProfileUrl, pathKey, currentUrl: url, error: null };
  };

  function handleMenuAction(e) {
    const targetButton = e.currentTarget;
    const action = targetButton.dataset.action;

    if (isProcessingAction && (action === 'initiateCurrentPageTextCollection' || action === 'refineAllDataWithDify')) {
        showToast('Previous page collection or AI refinement still in progress. If stuck, try "Start New Session".', 'warning', 5000);
        console.warn(`${SCRIPT_NAME}: Menu action '${action}' blocked, isProcessingAction is true.`);
        return;
    }

    console.log(`${SCRIPT_NAME}: Menu action initiated: ${action}`);
    toggleMenu(false); 

    if (action === 'initiateCurrentPageTextCollection' || action === 'startNewCollectionSession' || action === 'downloadCollectedDataFile' || action === 'refineAllDataWithDify') {
        setButtonState('processing'); 
    }

    let messagePayload = { action: action };
    let initialToastMessage = 'Processing...';

    if (action === 'initiateCurrentPageTextCollection') {
        const pageInfo = getCurrentPageInfoForCollection();
        if (pageInfo.error || !pageInfo.pathKey || !pageInfo.baseProfileUrl) { // Ensure pathKey and baseProfileUrl are present for collection
          showToast(pageInfo.error || "Cannot determine page details for collection.", 'error');
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
    } else if (action === 'refineAllDataWithDify') { // New action handling
        const pageInfo = getCurrentPageInfoForCollection();
        if (pageInfo.error || !pageInfo.baseProfileUrl) { // baseProfileUrl is essential for refinement
            showToast(pageInfo.error || 'Could not determine profile URL for refinement.', 'error');
            setButtonState('error');
            return;
        }
        initialToastMessage = `Starting AI refinement for all data on current profile...`;
        messagePayload.profileUrl = pageInfo.baseProfileUrl;
        // tabId will be passed by background script using sender.tab.id for UI updates.
    } else {
        console.error(`${SCRIPT_NAME}: Unknown action in menu: ${action}`);
        showToast(`Error: Unknown action '${action}'`, "error");
        setButtonState('default'); 
        return;
    }

    showToast(initialToastMessage, 'info');

    if (!chrome.runtime?.id) {
      console.error(`${SCRIPT_NAME}: Extension context invalidated before sending message for action '${action}'.`);
      showToast('Extension context lost. Please reload page and extension.', 'error', 7000);
      setButtonState('error');
      return;
    }

    try {
      chrome.runtime.sendMessage(messagePayload, (response) => {
        if (!chrome.runtime?.id) {
          console.warn(`${SCRIPT_NAME}: Context invalidated before/during response for '${action}'. Button state may rely on separate update.`);
          if (isProcessingAction && (action === 'initiateCurrentPageTextCollection' || action === 'startNewCollectionSession' || action === 'refineAllDataWithDify')) {
              setButtonState('error'); 
          }
          return;
        }

        if (chrome.runtime.lastError) {
          const errorMsgBase = `Runtime Error for ${action}`;
          let specificError = chrome.runtime.lastError.message || "Unknown runtime error";
          console.error(`${SCRIPT_NAME}: ${errorMsgBase}: ${specificError}`);
          showToast(`${errorMsgBase}: ${specificError.substring(0,100)}`, 'error');
          setButtonState('error');
          return;
        }

        if (response == null) {
            console.warn(`${SCRIPT_NAME}: No response object from background for ${action}.`);
            if (isProcessingAction) { 
                showToast(`No response from background for ${action}. Check logs.`, 'error');
                setButtonState('error');
            }
            return;
        }
        
        // For most actions, including refineAllDataWithDify, the final button state (success/error/default)
        // should be primarily managed by updateFloatingUIStatus messages from background.js,
        // as these operations can be multi-step or take time.
        // The direct response here might only confirm receipt or immediate validation failure.
        if (!response.success) {
            // If processing was started, and an immediate failure is returned.
            if (isProcessingAction) {
                showToast(response.error || `Action ${action} failed.`, 'error');
                setButtonState('error');
            }
        } else { 
             // For quick actions or initial success acknowledgement
            if ((action === 'startNewCollectionSession' || action === 'downloadCollectedDataFile') && isProcessingAction) {
                setButtonState('success'); 
            }
            // For initiateCurrentPageTextCollection and refineAllDataWithDify, 
            // we rely on background script's updateFloatingUIStatus messages for more granular updates.
            // The 'processing' state will remain until such a message updates it.
        }
      });
    } catch (e) {
      console.error(`${SCRIPT_NAME}: Synchronous error on sendMessage for '${action}':`, e);
      showToast(`Error sending command: ${e.message}. Reload page/extension.`, 'error', 7000);
      setButtonState('error');
    }
  }

  function initialize() {
    try {
        console.log(`${SCRIPT_NAME}: Starting initialization...`);
        
        createStyles();
        createBaseUI();
        populateMenu();
        setButtonState('default');
        
        if (!floatingButton || !menu || !toastContainer) {
            throw new Error('Failed to create one or more UI components');
        }
        if (!chrome.runtime?.id) {
            throw new Error('Chrome runtime not available during initialization');
        }
        
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            try {
                if (!chrome.runtime?.id) {
                    console.warn(`${SCRIPT_NAME}: Extension context invalidated during onMessage. Ignoring message:`, request.action);
                    return false;
                }

                if (request.action === 'updateFloatingUIStatus') {
                    console.log(`${SCRIPT_NAME}: Received 'updateFloatingUIStatus' - Type: ${request.type}, Msg: "${request.message ? request.message.substring(0,100) : 'N/A'}"`);
                    showToast(request.message || 'Status update', request.type || 'info');
                    
                    let newButtonStateToSet = null;

                    if (request.type === 'success') {
                        newButtonStateToSet = 'success';
                    } else if (request.type === 'error') {
                        newButtonStateToSet = 'error';   
                    } else if (request.type === 'warning') {
                        const msgLower = request.message ? request.message.toLowerCase() : "";
                        if (msgLower.includes("failed") || msgLower.includes("error") || msgLower.includes("⚠️")) {
                            newButtonStateToSet = 'error';
                        } else {
                            // For warnings that aren't errors, keep processing or revert to default if processing seems done.
                            // If isProcessingAction is true and message implies completion, set to default.
                            if (isProcessingAction && (msgLower.includes("completed") || msgLower.includes("finished") || msgLower.includes("issues"))) {
                                newButtonStateToSet = 'default';
                            } else if (!isProcessingAction) {
                                newButtonStateToSet = 'default'; // Or let it timeout to default
                            }
                            // Otherwise, let spinner continue if it's a non-critical warning during a process.
                        }
                    } else if (request.type === 'info') {
                        const message = request.message || "";
                        const msgLower = message.toLowerCase();
                        
                        // Keywords indicating a process has finished or reached a final state for the button
                        const completionKeywords = [
                            "page processed. result:", "successfully parsed for", "raw text saved but parsing failed",
                            "✅", "⚠️", // These symbols often indicate a final status from HSCTAP
                            "ai refinement process completed", "refinement process initiated", // Dify specific
                            "session started", "data cleared", "download initiated"
                        ];
                        
                        const isProcessingComplete = completionKeywords.some(keyword => msgLower.includes(keyword.toLowerCase()));
                        
                        if (isProcessingAction && isProcessingComplete) {
                             // If message indicates failure/warning despite being 'info' type, reflect that in button
                            if (msgLower.includes("failed") || msgLower.includes("error") || msgLower.includes("⚠️")) {
                                newButtonStateToSet = 'error';
                            } else if (msgLower.includes("success") || msgLower.includes("✅") || msgLower.includes("completed")) {
                                newButtonStateToSet = 'success'; // Could be success that then reverts to default
                            } else {
                                newButtonStateToSet = 'default';
                            }
                        } else if (isProcessingAction) {
                            // Info message received while processing, but no clear completion detected. Spinner remains.
                        } else {
                            // Info message received while NOT processing. No button state change from this path.
                        }
                    }

                    if (newButtonStateToSet) {
                        setButtonState(newButtonStateToSet);
                    }
                }
                return false; 
            } catch (listenerError) {
                console.error(`${SCRIPT_NAME}: Error in message listener:`, listenerError);
                if (typeof showToast === 'function') {
                    showToast('Extension error processing message. Please reload.', 'error');
                }
                return false;
            }
        });
        
        console.log(`${SCRIPT_NAME}: Initialization complete. Floating UI is active.`);
        showToast('LinkedIn Data Extractor UI active.', 'info', 2000);
        
    } catch (e) {
        console.error(`${SCRIPT_NAME}: CRITICAL ERROR during initialization:`, e);
        if (typeof alert === 'function') { 
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
  }
})();