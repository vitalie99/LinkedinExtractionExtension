// background.js (v4-fully-rewritten)
import { CONFIG } from './config.js';
import { MASTER_INSTRUCTIONS_TEXT, PROFILE_PROMPT_TEXT, POSTS_PROMPT_TEXT, COMMENTS_PROMPT_TEXT, REACTIONS_PROMPT_TEXT } from './prompts.js';

const SCRIPT_VERSION = "background_v4";
console.log(`${SCRIPT_VERSION}: Script loaded.`);

const SECTION_KEYS = {
  PROFILE: 'profile', POSTS: 'posts', COMMENTS: 'comments', REACTIONS: 'reactions'
};
const RAW_DATA_STORAGE_KEY = 'sessionRawLinkedInData_v3'; // Keep consistent if data exists

async function getStoredRawData() {
  return new Promise((resolve) => {
    chrome.storage.local.get([RAW_DATA_STORAGE_KEY], (result) => {
      resolve(result[RAW_DATA_STORAGE_KEY] || {});
    });
  });
}

async function setStoredRawData(data) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [RAW_DATA_STORAGE_KEY]: data }, () => {
      if (chrome.runtime.lastError) {
        console.error(`${SCRIPT_VERSION}: Error setting stored raw data:`, chrome.runtime.lastError.message);
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        console.log(`${SCRIPT_VERSION}: Raw data successfully set in storage.`);
        resolve();
      }
    });
  });
}

function extractProfileNameFromText(text) {
    if (!text) return "Unknown Profile";
    const lines = text.split('\n');
    for (let line of lines.slice(0, 10)) {
        const trimmedLine = line.trim();
        if (trimmedLine.length > 3 && trimmedLine.length < 80) {
            if (!/linkedin|feed|posts|comments|reactions|activity|search|people|messaging|home|network|jobs|notifications|me\s*$|see all|view full|^\d+ (mutual )?connections?$/i.test(trimmedLine) &&
                trimmedLine.split(' ').length >= 1 && trimmedLine.split(' ').length <= 5 &&
                /[\p{L}\p{M}'-]+/u.test(trimmedLine) &&
                !/[\d@#\$%\^&\*\(\)_=\+\[\]\{\};:"\\<>\?\/~`]{3,}/.test(trimmedLine)) {
                if (!/pending|message|connect|follow|more|view|profile|mutual|shared|ago|company|university/i.test(trimmedLine)) {
                    const words = trimmedLine.split(/\s+/);
                    const capitalizedWords = words.filter(w => w.length > 1 && w[0] === w[0].toUpperCase()).length;
                    if (words.length === 1 && capitalizedWords === 1 && words[0].length > 2) return trimmedLine;
                    if (words.length > 1 && capitalizedWords >= 1) return trimmedLine;
                }
            }
        }
    }
    const firstChunk = text.substring(0, 250);
    const titleMatch = firstChunk.match(/^([^\n\-|–—LinkedIn]{3,80})(?=\s*[\-|–—|LinkedIn]|\s*\n|$)/);
     if (titleMatch && titleMatch[1]) {
        const potentialName = titleMatch[1].trim();
        if (potentialName.length > 3 && !/linkedin|feed|posts|comments|reactions|activity|search|people|messaging|home|network|jobs|notifications|experience|education|about/i.test(potentialName) && potentialName.split(' ').length <= 5) {
            return potentialName;
        }
    }
    return "Unknown Profile";
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const senderIdentifier = sender.tab ? `Tab ${sender.tab.id}` : 'Popup/OtherExtensionUI';
  console.log(`${SCRIPT_VERSION}: Message received - Action: ${request.action}, From: ${senderIdentifier}, Payload:`, request);

  switch (request.action) {
    case 'startNewCollectionSession':
      setStoredRawData({})
        .then(() => {
          const msg = "New data collection session started. Previous data cleared.";
          console.log(`${SCRIPT_VERSION}: ${request.action} - SUCCESS: ${msg}`);
          updateUIs(msg, "success", sender.tab?.id);
          sendResponse({ success: true, message: msg });
        })
        .catch(error => {
          const errorMsg = `Failed to start new session: ${error.message}`;
          console.error(`${SCRIPT_VERSION}: ${request.action} - ERROR: ${errorMsg}`);
          updateUIs(errorMsg, "error", sender.tab?.id);
          sendResponse({ success: false, error: errorMsg });
        });
      return true;

    case 'initiateCurrentPageTextCollection':
      handleInitiateCurrentPageTextCollection(request, sender)
        .then(response => sendResponse(response)) // Response already contains success/message
        .catch(error => {
          const errorMsg = error.message || "Unknown error collecting page text.";
          console.error(`${SCRIPT_VERSION}: ${request.action} - Overall ERROR: ${errorMsg}`);
          updateUIs(`Error collecting page: ${errorMsg.substring(0, 150)}`, "error", sender.tab?.id);
          sendResponse({ success: false, error: errorMsg });
        });
      return true;

    case 'downloadCollectedDataFile':
      handleDownloadCollectedDataFile(sender.tab?.id)
        .then(response => sendResponse(response))
        .catch(error => {
          const errorMsg = error.message || "Unknown download error.";
          console.error(`${SCRIPT_VERSION}: ${request.action} - Overall ERROR: ${errorMsg}`);
          updateUIs(`Download failed: ${errorMsg.substring(0, 150)}`, "error", sender.tab?.id);
          sendResponse({ success: false, error: errorMsg });
        });
      return true;

    default:
      const unknownActionMsg = `Unknown action received: ${request.action}`;
      console.warn(`${SCRIPT_VERSION}: ${unknownActionMsg}`);
      sendResponse({ success: false, error: unknownActionMsg });
      return false; // Synchronous response for unhandled actions
  }
});

async function handleSaveCapturedText(profileUrl, sectionKey, text) {
    if (!profileUrl || !sectionKey || typeof text !== 'string') { // text must be a string
      const errorMsg = "Invalid data for saving captured text (profileUrl, sectionKey, or text missing/invalid).";
      console.error(`${SCRIPT_VERSION}: handleSaveCapturedText - ERROR: ${errorMsg}`, {profileUrl, sectionKey, textType: typeof text});
      throw new Error(errorMsg);
    }
    const allProfilesData = await getStoredRawData();
    const currentProfileData = allProfilesData[profileUrl] || { profileName: "Unknown Profile" };
    let textKey = sectionKey.toLowerCase() + "Text";
    if (sectionKey.toLowerCase() === SECTION_KEYS.PROFILE) {
        textKey = "mainProfileText";
        const extractedName = extractProfileNameFromText(text);
        if(extractedName !== "Unknown Profile" || currentProfileData.profileName === "Unknown Profile") {
            currentProfileData.profileName = extractedName;
        }
    }
    currentProfileData[textKey] = text;
    allProfilesData[profileUrl] = currentProfileData;
    await setStoredRawData(allProfilesData);
    const successMessage = `${sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1)} text saved for ${currentProfileData.profileName}. Length: ${text.length} chars.`;
    console.log(`${SCRIPT_VERSION}: handleSaveCapturedText - SUCCESS: ${successMessage}`);
    return successMessage;
}

async function handleInitiateCurrentPageTextCollection(request, sender) {
    const { profileUrl, pathKey } = request;
    const tabId = request.tabId || sender.tab?.id;

    if (!profileUrl || !pathKey) {
        console.error(`${SCRIPT_VERSION}: handleInitiateCurrentPageTextCollection - ERROR: URL or pathKey missing.`);
        throw new Error("URL or pathKey missing for current page text collection.");
    }
    if (!tabId) {
        console.error(`${SCRIPT_VERSION}: handleInitiateCurrentPageTextCollection - ERROR: No Tab ID.`);
        throw new Error("No tab ID available for current page text collection.");
    }

    updateUIs(`Extracting text from current ${pathKey} page...`, "info", tabId);
    try {
        console.log(`${SCRIPT_VERSION}: Sending 'extractRawTextForSection' to tab ${tabId} for pathKey '${pathKey}'.`);
        const responseFromContent = await chrome.tabs.sendMessage(tabId, {
            action: 'extractRawTextForSection',
            pathKey: pathKey,
            profileUrl: profileUrl
        });
        console.log(`${SCRIPT_VERSION}: Response from content script for 'extractRawTextForSection':`, responseFromContent);

        if (responseFromContent && responseFromContent.success && typeof responseFromContent.text === 'string') {
            const saveMessage = await handleSaveCapturedText(responseFromContent.profileUrl, responseFromContent.pathKey, responseFromContent.text);
            const successMsg = `Current page text captured. ${saveMessage}`;
            updateUIs(successMsg, "success", tabId);
            return { success: true, message: successMsg };
        } else {
            const contentError = responseFromContent?.error || 'Content script failed to return valid text or success flag.';
            console.error(`${SCRIPT_VERSION}: handleInitiateCurrentPageTextCollection - Content script ERROR: ${contentError}`);
            throw new Error(contentError);
        }
    } catch (e) {
        // Catch errors from sendMessage (e.g., no receiving end) or from subsequent processing.
        console.error(`${SCRIPT_VERSION}: Error during 'handleInitiateCurrentPageTextCollection' for ${pathKey} on tab ${tabId}:`, e);
        throw e; // Re-throw to be handled by the main listener's .catch, which will update UI.
    }
}

async function handleDownloadCollectedDataFile(sourceTabId) {
    console.log(`${SCRIPT_VERSION}: handleDownloadCollectedDataFile initiated.`);
    const allProfilesData = await getStoredRawData();
    if (Object.keys(allProfilesData).length === 0) {
        const msg = "No data collected to download.";
        updateUIs(msg, "warning", sourceTabId);
        throw new Error(msg);
    }
    const downloadableFileContent = {
      masterInstructions: MASTER_INSTRUCTIONS_TEXT,
      prompts: { profile: PROFILE_PROMPT_TEXT, posts: POSTS_PROMPT_TEXT, comments: COMMENTS_PROMPT_TEXT, reactions: REACTIONS_PROMPT_TEXT },
      collectedData: allProfilesData
    };
    const fileContentString = JSON.stringify(downloadableFileContent, null, 2);
    const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(fileContentString);
    const currentDate = new Date().toISOString().split('T')[0];
    const filename = `linkedin_collected_data_${currentDate}.json`;

    console.log(`${SCRIPT_VERSION}: Preparing download of '${filename}'. Data URL length: ${dataUrl.length}.`);

    return new Promise((resolve, reject) => {
        chrome.downloads.download({
          url: dataUrl,
          filename: filename,
          saveAs: true
        }, (downloadId) => {
          if (chrome.runtime.lastError) {
            const errorMsg = `Download API error: ${chrome.runtime.lastError.message}`;
            console.error(`${SCRIPT_VERSION}: ${errorMsg}`);
            reject(new Error(errorMsg));
          } else if (typeof downloadId === 'undefined') { // Stricter check
             const errorMsg = "Download did not start (downloadId is undefined). This can happen if another download dialog is already open or due to browser restrictions.";
             console.error(`${SCRIPT_VERSION}: ${errorMsg}`);
             reject(new Error(errorMsg));
          } else {
            const successMsg = "Data file download initiated!";
            console.log(`${SCRIPT_VERSION}: ${successMsg} ID: ${downloadId}`);
            updateUIs(successMsg, "success", sourceTabId);
            resolve({ success: true, message: successMsg, downloadId: downloadId });
          }
        });
    });
}

function updateUIs(message, type = "info", specificTabId = null) {
  console.log(`${SCRIPT_VERSION}: Updating UIs - Type: ${type.toUpperCase()}, Message: "${message.substring(0,100)}", Specific Tab: ${specificTabId || 'N/A'}`);

  // Update Popup
  chrome.runtime.sendMessage({ action: 'updatePopupStatus', message: message, type: type })
    .catch(e => console.warn(`${SCRIPT_VERSION}: Could not send status to popup (normal if closed): ${e.message}`));

  // Update Floating UI
  const sendMessageToTab = (tabIdToUpdate, isPrimaryTarget) => {
    if (!tabIdToUpdate) {
        console.warn(`${SCRIPT_VERSION}: sendMessageToTab called with no tabIdToUpdate.`);
        return;
    }
    console.log(`${SCRIPT_VERSION}: Attempting to send 'updateFloatingUIStatus' to Tab ${tabIdToUpdate} (${isPrimaryTarget ? 'primary' : 'secondary'}).`);
    chrome.tabs.sendMessage(tabIdToUpdate, { action: 'updateFloatingUIStatus', message: message, type: type })
      .then(() => {
        console.log(`${SCRIPT_VERSION}: Successfully sent 'updateFloatingUIStatus' to Tab ${tabIdToUpdate}.`);
      })
      .catch(e => {
        const logFn = isPrimaryTarget ? console.error : console.warn; // Be more prominent for primary target failures
        logFn(`${SCRIPT_VERSION}: ${isPrimaryTarget ? 'CRITICAL FAILURE' : 'Note'}: Could not send 'updateFloatingUIStatus' to Tab ${tabIdToUpdate}. Error: ${e.message}. Primary Target: ${isPrimaryTarget}`);
      });
  };

  if (specificTabId) {
    sendMessageToTab(specificTabId, true);
  }

  chrome.tabs.query({ url: "*://*.linkedin.com/*" }, (tabs) => {
    if (chrome.runtime.lastError) {
      console.error(`${SCRIPT_VERSION}: Error querying tabs for floating UI update: ${chrome.runtime.lastError.message}`);
      return;
    }
    console.log(`${SCRIPT_VERSION}: Found ${tabs.length} LinkedIn tabs for potential secondary UI update.`);
    tabs.forEach(tab => {
      if (tab.id && tab.id !== specificTabId) { // Don't resend to the primary target if it was already sent
        sendMessageToTab(tab.id, false);
      }
    });
  });
}

chrome.runtime.onInstalled.addListener((details) => {
  console.log(`${SCRIPT_VERSION}: Extension event - ${details.reason}.`);
  if (details.reason === "install" || details.reason === "update") {
    chrome.storage.local.get([RAW_DATA_STORAGE_KEY], (result) => {
      if (typeof result[RAW_DATA_STORAGE_KEY] === 'undefined') {
        setStoredRawData({}).then(() => console.log(`${SCRIPT_VERSION}: Initialized raw data storage.`));
      }
    });
  }
});

console.log(`${SCRIPT_VERSION}: Service worker event listeners attached.`);