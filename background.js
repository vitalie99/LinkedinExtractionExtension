// background.js (v5-robust-parsing) - Updated version with all fixes & enhanced error handling

import { CONFIG } from './config.js';
// Import the ROBUST parser functions
import { parseProfileInfo } from './profileParser.js';
import { parsePosts, parseComments, parseReactions } from './activityParser.js';
import { cleanDuplicateContent, calculateSimilarity, extractHeadlineFromProfile, cleanProfileName } from './parserUtils.js';

// Import existing prompts
import { MASTER_INSTRUCTIONS_TEXT, PROFILE_PROMPT_TEXT, POSTS_PROMPT_TEXT, COMMENTS_PROMPT_TEXT, REACTIONS_PROMPT_TEXT } from './prompts.js';

const SCRIPT_VERSION = "background_v5_robust_parsing_FIXED"; // Indicate this is a revised version
console.log(`${SCRIPT_VERSION}: Script loaded with robust parsing algorithms and enhanced error handling.`);

const SECTION_KEYS = {
  PROFILE: 'profile', POSTS: 'posts', COMMENTS: 'comments', REACTIONS: 'reactions'
};
const PARSED_DATA_STORAGE_KEY = 'sessionParsedLinkedInData_v2';

async function getStoredParsedData() {
  return new Promise((resolve) => {
    chrome.storage.local.get([PARSED_DATA_STORAGE_KEY], (result) => {
      resolve(result[PARSED_DATA_STORAGE_KEY] || {});
    });
  });
}

async function setStoredParsedData(data) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [PARSED_DATA_STORAGE_KEY]: data }, () => {
      if (chrome.runtime.lastError) {
        console.error(`${SCRIPT_VERSION}: Error setting stored parsed data:`, chrome.runtime.lastError.message);
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        console.log(`${SCRIPT_VERSION}: Parsed data successfully set in storage.`);
        resolve();
      }
    });
  });
}

// Enhanced profile name extraction with better validation (from original file)
function extractProfileNameFromText(text) {
    if (!text) return "Unknown Profile";
    const lines = text.split('\n');
    for (let i = 0; i < Math.min(10, lines.length); i++) {
        const line = lines[i].trim();
        if (line.length < 3 || line.length > 100) continue;
        if (line.includes('{:badgeType}') || line.includes('account')) continue;
        if (/linkedin|feed|posts|comments|reactions|activity|search|people|messaging|home|network|jobs|notifications|contact info|followers|connections|degree connection/i.test(line)) continue;
        if (/^\d+|see all|view full|mutual connections?$|pending|message|connect|follow|more|view|profile|shared|ago|company|university|Premium|Verified/i.test(line)) continue;
        if (!/^[A-Za-z\s'-]+$/.test(line)) continue;
        if (i + 1 < lines.length) {
            const nextLine = lines[i + 1].trim();
            if (nextLine.match(/He\/Him|She\/Her|They\/Them/i) ||
                (i + 2 < lines.length && lines[i + 2].trim().match(/(?:1st|2nd|3rd)/))) {
                return cleanProfileName(line); // Clean it immediately
            }
        }
        const words = line.split(/\s+/);
        const capitalizedWords = words.filter(w => w.length > 1 && w[0] === w[0].toUpperCase()).length;
        if (words.length === 1 && capitalizedWords === 1 && words[0].length > 2) {
            return cleanProfileName(line);
        }
        if (words.length > 1 && words.length <= 6 && capitalizedWords >= 1) {
            return cleanProfileName(line);
        }
    }
    const pronounPattern = /^([A-Za-z\s'-]+)\s*\n\s*(?:He\/Him|She\/Her|They\/Them)/m;
    const pronounMatch = text.match(pronounPattern);
    if (pronounMatch && pronounMatch[1] && !pronounMatch[1].includes('{:')) {
        return cleanProfileName(pronounMatch[1].trim());
    }
    // Fallback: try using the headline extractor if name is not found early.
    // This is less ideal as headline can be long.
    const extractedHeadline = extractHeadlineFromProfile(text, "Unknown Profile"); // parserUtils version
    if (extractedHeadline && extractedHeadline.split(/\s+/).length <= 6 && /^[A-Za-z\s'-]+$/.test(extractedHeadline) && !extractedHeadline.toLowerCase().includes(' at ')) {
        // If headline looks like a name and not a typical job title with "at"
        // This is a heuristic and might not be perfect.
        // return cleanProfileName(extractedHeadline);
    }

    return "Unknown Profile";
}


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const senderIdentifier = sender.tab ? `Tab ${sender.tab.id}` : 'Popup/OtherExtensionUI';
  console.log(`${SCRIPT_VERSION}: Message received - Action: ${request.action}, From: ${senderIdentifier}, Payload:`, request);

  switch (request.action) {
    case 'startNewCollectionSession':
      setStoredParsedData({})
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
      return true; // Indicates async response

    case 'initiateCurrentPageTextCollection':
      handleInitiateCurrentPageTextCollection(request, sender)
        .then(response => {
          // The response from handleInitiateCurrentPageTextCollection will be {success: boolean, message?: string, error?: string}
          sendResponse(response);
        })
        .catch(error => { // This catch is for unexpected errors from handleInitiateCurrentPageTextCollection itself
          const errorMsg = error.message || "Unknown error in initiateCurrentPageTextCollection promise chain.";
          console.error(`${SCRIPT_VERSION}: ${request.action} - Outer promise ERROR: ${errorMsg}`, error);
          updateUIs(`Collection Error: ${errorMsg.substring(0, 150)}`, "error", sender.tab?.id);
          sendResponse({ success: false, error: errorMsg });
        });
      return true; // Indicates async response

    case 'downloadCollectedDataFile':
      handleDownloadCollectedDataFile(sender.tab?.id)
        .then(response => sendResponse(response))
        .catch(error => {
          const errorMsg = error.message || "Unknown download error.";
          console.error(`${SCRIPT_VERSION}: ${request.action} - Overall ERROR: ${errorMsg}`);
          updateUIs(`Download failed: ${errorMsg.substring(0, 150)}`, "error", sender.tab?.id);
          sendResponse({ success: false, error: errorMsg });
        });
      return true; // Indicates async response

    default:
      const unknownActionMsg = `Unknown action received: ${request.action}`;
      console.warn(`${SCRIPT_VERSION}: ${unknownActionMsg}`);
      sendResponse({ success: false, error: unknownActionMsg });
      return false; // No async response
  }
});

// ENHANCED parsing with robust algorithms and detailed error handling
async function handleSaveCapturedTextAndParse(profileUrl, sectionKey, rawText) {
    if (!profileUrl || !sectionKey || typeof rawText !== 'string') {
      const errorMsg = "Invalid data for saving captured text (profileUrl, sectionKey, or text missing/invalid).";
      console.error(`${SCRIPT_VERSION}: handleSaveCapturedTextAndParse - ERROR: ${errorMsg}`);
      // This function is called by another async function, so throwing here is okay if the caller handles it.
      // Or return an error status. For consistency with other parts, let's return a message.
      return `⚠️ ${sectionKey} save failed: ${errorMsg}`;
    }

    const allProfilesData = await getStoredParsedData();
    const currentProfileHolder = allProfilesData[profileUrl] || {
        profileName: "Unknown Profile", // Initial default
        parsingResults: {},
        rawTexts: {},
        parsingMetadata: {
            lastUpdated: new Date().toISOString(),
            textLengths: {},
            parsingAttempts: {}
        }
    };

    let rawTextKey = sectionKey.toLowerCase() + "Text";
    if (sectionKey.toLowerCase() === SECTION_KEYS.PROFILE) rawTextKey = "mainProfileText";
    currentProfileHolder.rawTexts[rawTextKey] = rawText;
    currentProfileHolder.parsingMetadata.textLengths[rawTextKey] = rawText.length;
    currentProfileHolder.parsingMetadata.lastUpdated = new Date().toISOString();

    const attemptKey = sectionKey.toLowerCase();
    currentProfileHolder.parsingMetadata.parsingAttempts[attemptKey] = (currentProfileHolder.parsingMetadata.parsingAttempts[attemptKey] || 0) + 1;

    let profileNameToUse = currentProfileHolder.profileName;
    if (sectionKey.toLowerCase() === SECTION_KEYS.PROFILE || profileNameToUse === "Unknown Profile") {
        const extractedNameFromRaw = extractProfileNameFromText(rawText); // Uses the function in background.js
        if (extractedNameFromRaw !== "Unknown Profile") {
            profileNameToUse = extractedNameFromRaw;
            currentProfileHolder.profileName = profileNameToUse; // Update the stored profile name
        }
    }
    // Ensure profileNameToUse is always cleaned for use with parsers
    profileNameToUse = cleanProfileName(profileNameToUse || "Unknown Profile"); // from parserUtils

    console.log(`${SCRIPT_VERSION}: Starting robust parsing for ${sectionKey} section, profile: ${profileNameToUse}`);
    console.log(`${SCRIPT_VERSION}: Raw text length: ${rawText.length} characters`);

    let parsedResult = null;
    let parseSuccess = false;
    let parseErrorObject = null; // Changed from parseError to avoid conflict
    let parseWarnings = [];
    const startTime = Date.now();

    try {
        if (sectionKey.toLowerCase() === SECTION_KEYS.PROFILE) {
            parsedResult = parseProfileInfo(rawText, profileNameToUse); // Pass cleaned name
            if (parsedResult) {
                if (!parsedResult.name || parsedResult.name === "Unknown Profile") parseWarnings.push("Name not extracted by parser");
                if (parsedResult.name && parsedResult.name !== "Unknown Profile" && profileNameToUse === "Unknown Profile") {
                    currentProfileHolder.profileName = cleanProfileName(parsedResult.name); // Update with parser's extracted name if better
                } else if (parsedResult.name && parsedResult.name === "Unknown Profile" && profileNameToUse !== "Unknown Profile") {
                    parsedResult.name = profileNameToUse; // Ensure parser result uses the better name we found
                } else if (parsedResult.name && parsedResult.name !== "Unknown Profile") {
                     currentProfileHolder.profileName = cleanProfileName(parsedResult.name); // Default to parser's name if both are good
                }


                if (!parsedResult.headline) parseWarnings.push("Headline not extracted");
                // Add more validation warnings as needed based on schema
                currentProfileHolder.parsingResults.profileInfo = parsedResult;
                parseSuccess = true;
            }
        } else if (sectionKey.toLowerCase() === SECTION_KEYS.POSTS) {
            parsedResult = parsePosts(rawText, profileNameToUse);
            if (parsedResult && parsedResult.postsAndRepostsByProfilePerson) {
                if (parsedResult.postsAndRepostsByProfilePerson.length === 0) parseWarnings.push("No posts/reposts extracted");
                currentProfileHolder.parsingResults.posts = parsedResult;
                parseSuccess = true;
            }
        } else if (sectionKey.toLowerCase() === SECTION_KEYS.COMMENTS) {
            parsedResult = parseComments(rawText, profileNameToUse);
            if (parsedResult && parsedResult.commentsMadeByProfilePerson) {
                if (parsedResult.commentsMadeByProfilePerson.length === 0) parseWarnings.push("No comments extracted");
                currentProfileHolder.parsingResults.comments = parsedResult;
                parseSuccess = true;
            }
        } else if (sectionKey.toLowerCase() === SECTION_KEYS.REACTIONS) {
            parsedResult = parseReactions(rawText, profileNameToUse);
            if (parsedResult && parsedResult.reactionsMadeByProfilePerson) {
                if (parsedResult.reactionsMadeByProfilePerson.length === 0) parseWarnings.push("No reactions extracted");
                currentProfileHolder.parsingResults.reactions = parsedResult;
                parseSuccess = true;
            }
        }
        const parseTime = Date.now() - startTime;
        console.log(`${SCRIPT_VERSION}: Parsing for ${sectionKey} completed in ${parseTime}ms. Success: ${parseSuccess}`);
        if (parseWarnings.length > 0) {
            console.warn(`${SCRIPT_VERSION}: Parsing warnings for ${sectionKey}:`, parseWarnings);
        }
    } catch (error) {
        parseErrorObject = error;
        parseSuccess = false;
        console.error(`${SCRIPT_VERSION}: CRITICAL Error during ${sectionKey} parsing for profile ${profileNameToUse}:`, error);
        const errorInfo = {
            parseError: error.message,
            errorStack: error.stack, // Good for debugging
            attemptTime: new Date().toISOString(),
            rawTextLength: rawText.length
        };
        // Store minimal structure on parse failure
        if (sectionKey.toLowerCase() === SECTION_KEYS.PROFILE) currentProfileHolder.parsingResults.profileInfo = { name: profileNameToUse, ...errorInfo };
        else if (sectionKey.toLowerCase() === SECTION_KEYS.POSTS) currentProfileHolder.parsingResults.posts = { postsAndRepostsByProfilePerson: [], ...errorInfo };
        else if (sectionKey.toLowerCase() === SECTION_KEYS.COMMENTS) currentProfileHolder.parsingResults.comments = { commentsMadeByProfilePerson: [], ...errorInfo };
        else if (sectionKey.toLowerCase() === SECTION_KEYS.REACTIONS) currentProfileHolder.parsingResults.reactions = { reactionsMadeByProfilePerson: [], ...errorInfo };
    }

    currentProfileHolder.parsingMetadata[`${attemptKey}ParseSuccess`] = parseSuccess;
    currentProfileHolder.parsingMetadata[`${attemptKey}ParseWarnings`] = parseWarnings;
    if (parseErrorObject) {
        currentProfileHolder.parsingMetadata[`${attemptKey}ParseError`] = parseErrorObject.message;
    }

    allProfilesData[profileUrl] = currentProfileHolder;
    try {
        await setStoredParsedData(allProfilesData);
    } catch (storageError) {
        console.error(`${SCRIPT_VERSION}: Failed to save data to storage after parsing ${sectionKey}:`, storageError);
        return `⚠️ ${sectionKey} parsed but FAILED TO SAVE to storage. Error: ${storageError.message}. Raw: ${rawText.length} chars.`;
    }
    
    // Generate detailed success/failure message to be returned
    let resultMessage;
    const finalProfileNameForMessage = currentProfileHolder.profileName || profileNameToUse; // Use the most up-to-date name

    if (parseSuccess) {
        let itemDetails = '';
        // Populate itemDetails based on parsedResult, similar to original logic
        if (parsedResult) {
           if (sectionKey.toLowerCase() === SECTION_KEYS.POSTS) itemDetails = ` (${parsedResult.postsAndRepostsByProfilePerson?.length || 0} posts/reposts)`;
           else if (sectionKey.toLowerCase() === SECTION_KEYS.COMMENTS) itemDetails = ` (${parsedResult.commentsMadeByProfilePerson?.length || 0} comments)`;
           else if (sectionKey.toLowerCase() === SECTION_KEYS.REACTIONS) itemDetails = ` (${parsedResult.reactionsMadeByProfilePerson?.length || 0} reactions)`;
           else if (sectionKey.toLowerCase() === SECTION_KEYS.PROFILE) {
               const expCount = parsedResult.experience?.length || 0;
               const eduCount = parsedResult.education?.length || 0;
               const skillsCount = parsedResult.skills?.length || 0;
               itemDetails = ` (${expCount} exp, ${eduCount} edu, ${skillsCount} skills)`;
           }
       }
        const warningText = parseWarnings.length > 0 ? ` Warnings: ${parseWarnings.length}` : '';
        resultMessage = `✅ ${sectionKey} successfully parsed for ${finalProfileNameForMessage}${itemDetails}.${warningText} Raw: ${rawText.length} chars.`;
        console.log(`${SCRIPT_VERSION}: ${resultMessage}`);
    } else {
        resultMessage = `⚠️ ${sectionKey} raw text saved but PARSING FAILED for ${finalProfileNameForMessage}. Error: ${parseErrorObject?.message || 'unknown error during parse'}. Raw: ${rawText.length} chars.`;
        console.warn(`${SCRIPT_VERSION}: ${resultMessage}`);
    }
    return resultMessage;
}


async function handleInitiateCurrentPageTextCollection(request, sender) {
   const { profileUrl, pathKey } = request;
   const tabId = request.tabId || sender.tab?.id;

   if (!profileUrl || !pathKey) {
       const errorMsg = "URL or pathKey missing for current page text collection.";
       console.error(`${SCRIPT_VERSION}: handleInitiateCurrentPageTextCollection - ERROR: ${errorMsg}`);
       if(tabId) updateUIs(errorMsg, "error", tabId); // Update UI if tabId is available
       return { success: false, error: errorMsg }; // Return error object
   }
   if (!tabId) {
       const errorMsg = "No tab ID available for current page text collection.";
       console.error(`${SCRIPT_VERSION}: handleInitiateCurrentPageTextCollection - ERROR: No Tab ID.`);
       // Cannot update specific tab UI, but error will be sent back to popup/caller
       return { success: false, error: errorMsg }; // Return error object
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
           // Call handleSaveCapturedTextAndParse and get its result message
           const saveParseMessage = await handleSaveCapturedTextAndParse(responseFromContent.profileUrl, responseFromContent.pathKey, responseFromContent.text);
           
           // Determine overall status based on the message from save/parse
           let overallStatusType = "success";
           if (saveParseMessage.toLowerCase().startsWith('⚠️') || saveParseMessage.toLowerCase().includes('failed')) {
               overallStatusType = "error"; // Or "warning" if only minor issues
           }
           const UIMessage = `${pathKey} page processed. Result: ${saveParseMessage}`;
           updateUIs(UIMessage, overallStatusType, tabId);
           // Even if parsing failed, collection of raw text was a "success" from message passing POV
           // The details of parsing are in the message.
           return { success: true, message: UIMessage, details: saveParseMessage };
       } else {
           const contentError = responseFromContent?.error || 'Content script failed to return valid text or success flag.';
           console.error(`${SCRIPT_VERSION}: handleInitiateCurrentPageTextCollection - Content script ERROR: ${contentError}`);
           updateUIs(`Content script error: ${contentError.substring(0,150)}`, "error", tabId);
           return { success: false, error: contentError }; // Return error object
       }
   } catch (e) {
       // This catches errors from chrome.tabs.sendMessage or unhandled errors in handleSaveCapturedTextAndParse
       console.error(`${SCRIPT_VERSION}: CRITICAL Error during 'handleInitiateCurrentPageTextCollection' for ${pathKey} on tab ${tabId}:`, e);
       const errorMessage = e.message || "Unknown error in text collection process.";
       updateUIs(`Error collecting page data: ${errorMessage.substring(0, 150)}`, "error", tabId);
       return { success: false, error: errorMessage }; // Return error object
   }
}

async function handleDownloadCollectedDataFile(sourceTabId) {
   console.log(`${SCRIPT_VERSION}: handleDownloadCollectedDataFile initiated.`);
   const allProfilesData = await getStoredParsedData();
   if (Object.keys(allProfilesData).length === 0) {
       const msg = "No data collected to download.";
       updateUIs(msg, "warning", sourceTabId);
       // This function is expected to return a promise that resolves to an object for sendResponse
       // So, instead of throwing, return a failure object.
       return { success: false, error: msg };
   }
   
   const downloadableFileContent = {
     version: "v2-robust-parsing-FIXED", // Updated version
     generatedAt: new Date().toISOString(),
     masterInstructions: MASTER_INSTRUCTIONS_TEXT,
     prompts: { profile: PROFILE_PROMPT_TEXT, posts: POSTS_PROMPT_TEXT, comments: COMMENTS_PROMPT_TEXT, reactions: REACTIONS_PROMPT_TEXT },
     collectedData: allProfilesData,
     parsingStats: generateDetailedParsingStats(allProfilesData)
   };
   
   const fileContentString = JSON.stringify(downloadableFileContent, null, 2);
   const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(fileContentString);
   const currentDate = new Date().toISOString().split('T')[0];
   const filename = `linkedin_collected_data_robust_fixed_${currentDate}.json`;

   console.log(`${SCRIPT_VERSION}: Preparing download of '${filename}'. Data URL length: ${dataUrl.length}.`);

   // Return a promise that resolves or rejects for the .then/.catch in the message listener
   return new Promise((resolve, reject) => {
       chrome.downloads.download({
         url: dataUrl,
         filename: filename,
         saveAs: true
       }, (downloadId) => {
         if (chrome.runtime.lastError) {
           const errorMsg = `Download API error: ${chrome.runtime.lastError.message}`;
           console.error(`${SCRIPT_VERSION}: ${errorMsg}`);
           // Instead of rejecting, we ensure the caller gets a structured error.
           // The outer .catch in the listener will handle this if we reject.
           // For consistency, we can resolve with a failure object or reject. Let's try resolving.
           resolve({ success: false, error: errorMsg });
         } else if (typeof downloadId === 'undefined') {
            const errorMsg = "Download did not start (downloadId is undefined).";
            console.error(`${SCRIPT_VERSION}: ${errorMsg}`);
            resolve({ success: false, error: errorMsg });
         } else {
           const successMsg = "Enhanced data file download initiated!";
           console.log(`${SCRIPT_VERSION}: ${successMsg} ID: ${downloadId}`);
           updateUIs(successMsg, "success", sourceTabId);
           resolve({ success: true, message: successMsg, downloadId: downloadId });
         }
       });
   });
}

// generateDetailedParsingStats function remains the same...
function generateDetailedParsingStats(allProfilesData) {
   const stats = {
       totalProfiles: Object.keys(allProfilesData).length,
       sectionsProcessed: 0,
       parseResults: {
           successful: 0,
           failed: 0,
           withWarnings: 0,
           details: {}
       },
       dataQuality: {
           avgTextLength: 0,
           totalTextLength: 0,
           sectionCoverage: {},
           extractionRates: {}
       }
   };
   let totalTextLength = 0;
   const sectionCounts = { profile: 0, posts: 0, comments: 0, reactions: 0 };
   const extractionSuccess = { profile: 0, posts: 0, comments: 0, reactions: 0 };

   for (const [profileUrl, profileData] of Object.entries(allProfilesData)) {
       const profileStats = {
           profileName: profileData.profileName || "Unknown Profile", // Include profile name in stats detail
           sections: {},
           totalSections: 0,
           warnings: 0,
           textLengths: profileData.parsingMetadata?.textLengths || {},
           lastUpdated: profileData.parsingMetadata?.lastUpdated,
           parseErrors: {} // To store specific parse errors
       };

       if (profileData.rawTexts) {
           for (const [textKey, text] of Object.entries(profileData.rawTexts)) {
               if (typeof text === 'string') totalTextLength += text.length;
           }
       }

       if (profileData.parsingResults) {
           for (const [section, result] of Object.entries(profileData.parsingResults)) {
               profileStats.totalSections++;
               stats.sectionsProcessed++;
               const sectionKeyOriginal = section === 'profileInfo' ? 'profile' : section;
               // Ensure sectionKeyOriginal is a valid key for sectionCounts and extractionSuccess
               const sectionKey = SECTION_KEYS[sectionKeyOriginal.toUpperCase()] || sectionKeyOriginal;


               if (!sectionCounts.hasOwnProperty(sectionKey)) { // Initialize if not present
                   sectionCounts[sectionKey] = 0;
                   extractionSuccess[sectionKey] = 0;
               }
               sectionCounts[sectionKey]++;

               const metadataKey = sectionKeyOriginal === 'profileInfo' ? 'profile' : sectionKeyOriginal;

               if (result && !result.parseError && profileData.parsingMetadata?.[`${metadataKey}ParseSuccess`]) { // Check success flag from metadata
                   stats.parseResults.successful++;
                   extractionSuccess[sectionKey]++;
                   profileStats.sections[sectionKeyOriginal] = 'success';
                   
                   const warningKey = `${metadataKey}ParseWarnings`;
                   if (profileData.parsingMetadata?.[warningKey]?.length > 0) {
                       stats.parseResults.withWarnings++;
                       profileStats.warnings += profileData.parsingMetadata[warningKey].length;
                       profileStats.sections[sectionKeyOriginal] += ` (${profileData.parsingMetadata[warningKey].length} warnings)`;
                   }
                   // Count parsed items (remains same)
                   if (section === 'posts' && result.postsAndRepostsByProfilePerson) profileStats.sections[sectionKeyOriginal] += ` (${result.postsAndRepostsByProfilePerson.length} items)`;
                   else if (section === 'comments' && result.commentsMadeByProfilePerson) profileStats.sections[sectionKeyOriginal] += ` (${result.commentsMadeByProfilePerson.length} items)`;
                   else if (section === 'reactions' && result.reactionsMadeByProfilePerson) profileStats.sections[sectionKeyOriginal] += ` (${result.reactionsMadeByProfilePerson.length} items)`;
                   else if (section === 'profileInfo') {
                       const expCount = result.experience?.length || 0;
                       const eduCount = result.education?.length || 0;
                       const skillsCount = result.skills?.length || 0;
                       profileStats.sections[sectionKeyOriginal] += ` (${expCount} exp, ${eduCount} edu, ${skillsCount} skills)`;
                   }

               } else {
                   stats.parseResults.failed++;
                   const errorMsg = result?.parseError || profileData.parsingMetadata?.[`${metadataKey}ParseError`] || 'unknown error';
                   profileStats.sections[sectionKeyOriginal] = `failed: ${errorMsg}`;
                   profileStats.parseErrors[sectionKeyOriginal] = errorMsg;
               }
           }
       }
       stats.parseResults.details[profileUrl] = profileStats;
   }

   stats.dataQuality.totalTextLength = totalTextLength;
   stats.dataQuality.avgTextLength = Math.round(totalTextLength / Math.max(stats.sectionsProcessed, 1));
   
   for (const [section, count] of Object.entries(sectionCounts)) {
       if (count > 0) { // Only calculate if section was processed
          stats.dataQuality.sectionCoverage[section] = count;
          stats.dataQuality.extractionRates[section] = Math.round((extractionSuccess[section] / count) * 100);
       } else {
          stats.dataQuality.sectionCoverage[section] = 0;
          stats.dataQuality.extractionRates[section] = 0;
       }
   }
   return stats;
}


// updateUIs function remains largely the same, ensure it's robust
function updateUIs(message, type = "info", specificTabId = null) {
 console.log(`${SCRIPT_VERSION}: Updating UIs - Type: ${type.toUpperCase()}, Message: "${message ? message.substring(0,100) : 'N/A'}", Specific Tab: ${specificTabId || 'N/A'}`);

 // Try to send to popup, catch error if it's closed
 chrome.runtime.sendMessage({ action: 'updatePopupStatus', message: message, type: type })
   .catch(e => {
     // console.warn(`${SCRIPT_VERSION}: Could not send status to popup (normal if closed): ${e.message}`);
   });

 const sendMessageToTab = (tabIdToUpdate, isPrimaryTarget) => {
   if (typeof tabIdToUpdate !== 'number') { // Check if tabId is a valid number
       // console.warn(`${SCRIPT_VERSION}: sendMessageToTab called with invalid tabId: ${tabIdToUpdate}.`);
       return;
   }
   // console.log(`${SCRIPT_VERSION}: Attempting to send 'updateFloatingUIStatus' to Tab ${tabIdToUpdate} (${isPrimaryTarget ? 'primary' : 'secondary'}).`);
   chrome.tabs.sendMessage(tabIdToUpdate, { action: 'updateFloatingUIStatus', message: message, type: type })
     .then(() => {
       // console.log(`${SCRIPT_VERSION}: Successfully sent 'updateFloatingUIStatus' to Tab ${tabIdToUpdate}.`);
     })
     .catch(e => {
       // This error is common if the content script isn't on the page or tab is closed.
       // Avoid excessive logging for secondary targets unless debugging.
       // const logFn = isPrimaryTarget ? console.error : console.warn;
       // logFn(`${SCRIPT_VERSION}: ${isPrimaryTarget ? 'CRITICAL FAILURE' : 'Note'}: Could not send 'updateFloatingUIStatus' to Tab ${tabIdToUpdate}. Error: ${e.message}. Primary Target: ${isPrimaryTarget}`);
     });
 };

 if (specificTabId) {
   sendMessageToTab(specificTabId, true);
 }

 // Update other LinkedIn tabs (secondary)
 chrome.tabs.query({ url: "*://*.linkedin.com/*" }, (tabs) => {
   if (chrome.runtime.lastError) {
     // console.error(`${SCRIPT_VERSION}: Error querying tabs for floating UI update: ${chrome.runtime.lastError.message}`);
     return;
   }
   // console.log(`${SCRIPT_VERSION}: Found ${tabs.length} LinkedIn tabs for potential secondary UI update.`);
   tabs.forEach(tab => {
     if (tab.id && tab.id !== specificTabId) {
       sendMessageToTab(tab.id, false);
     }
   });
 });
}

chrome.runtime.onInstalled.addListener((details) => {
 console.log(`${SCRIPT_VERSION}: Extension event - ${details.reason}.`);
 if (details.reason === "install" || details.reason === "update") {
   chrome.storage.local.get([PARSED_DATA_STORAGE_KEY], (result) => {
     if (chrome.runtime.lastError) {
        console.error(`${SCRIPT_VERSION}: Error checking storage on install/update: ${chrome.runtime.lastError.message}`);
        return;
     }
     if (typeof result[PARSED_DATA_STORAGE_KEY] === 'undefined') {
       setStoredParsedData({}).then(() => console.log(`${SCRIPT_VERSION}: Initialized robust parsed data storage.`))
                             .catch(e => console.error(`${SCRIPT_VERSION}: Failed to initialize storage: ${e.message}`));
     }
   });
 }
});

console.log(`${SCRIPT_VERSION}: Service worker event listeners attached with robust parsing and error handling capabilities.`);