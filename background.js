// background.js (v6_dify_integration) - Merged version with Dify AI refinement and robust parsing.

import { CONFIG } from './config.js';
// Import the ROBUST parser functions
import { parseProfileInfo } from './profileParser.js';
import { parsePosts, parseComments, parseReactions } from './activityParser.js';
import { cleanDuplicateContent, calculateSimilarity, extractHeadlineFromProfile, cleanProfileName as importedCleanProfileName } from './parserUtils.js';

// Import existing prompts
import { MASTER_INSTRUCTIONS_TEXT, PROFILE_PROMPT_TEXT, POSTS_PROMPT_TEXT, COMMENTS_PROMPT_TEXT, REACTIONS_PROMPT_TEXT } from './prompts.js';

const SCRIPT_VERSION = "background_v6_dify_integration_profileName_fix"; // Updated version
console.log(`${SCRIPT_VERSION}: Script loaded with Dify AI refinement capabilities.`);

// --- SNIPPET: Import Validation ---
console.log(`${SCRIPT_VERSION}: Validating imports...`);
const requiredFunctions = [
    { name: 'parseProfileInfo', obj: typeof parseProfileInfo !== 'undefined' ? parseProfileInfo : null },
    { name: 'parsePosts', obj: typeof parsePosts !== 'undefined' ? parsePosts : null },
    { name: 'parseComments', obj: typeof parseComments !== 'undefined' ? parseComments : null },
    { name: 'parseReactions', obj: typeof parseReactions !== 'undefined' ? parseReactions : null },
    { name: 'importedCleanProfileName', obj: typeof importedCleanProfileName !== 'undefined' ? importedCleanProfileName : null },
    { name: 'calculateSimilarity', obj: typeof calculateSimilarity !== 'undefined' ? calculateSimilarity : null },
    { name: 'extractHeadlineFromProfile', obj: typeof extractHeadlineFromProfile !== 'undefined' ? extractHeadlineFromProfile : null }
];

let importErrors = false;
requiredFunctions.forEach(({ name, obj }) => {
    if (typeof obj !== 'function') {
        console.error(`${SCRIPT_VERSION}: Required function '${name}' is not properly imported!`);
        importErrors = true;
    }
});

if (importErrors) {
    console.error(`${SCRIPT_VERSION}: Critical import errors detected! Extension may not function properly.`);
} else {
    console.log(`${SCRIPT_VERSION}: All required functions imported successfully.`);
}
// --- END SNIPPET: Import Validation ---

// --- SNIPPET: Effective cleanProfileName ---
let cleanProfileName;
if (typeof importedCleanProfileName === 'function') {
    cleanProfileName = importedCleanProfileName;
    console.log(`${SCRIPT_VERSION}: Using imported cleanProfileName.`);
} else {
    console.warn(`${SCRIPT_VERSION}: importedCleanProfileName not found, using fallback implementation.`);
    cleanProfileName = function(name) { // Fallback definition
        if (!name || typeof name !== 'string') return name || "Unknown Profile";
        return name
            .replace(/\s*{:badgeType}\s*/g, '')
            .replace(/\s+account\s*$/i, '')
            .replace(/\s+has\s+a\s*/i, '')
            .replace(/^(?:Mr\.? |Ms\.? |Mrs\.? |Dr\.? )/i, '')
            .replace(/\s*(?:,|PhD|MBA|MD|Esq\.?)$/i, '')
            .trim();
    };
}
// --- END SNIPPET: Effective cleanProfileName ---

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
        resolve();
      }
    });
  });
}

function extractProfileNameFromText(text) {
    if (!text) return "Unknown Profile";
    const lines = text.split('\n');
    // Use the globally defined cleanProfileName
    const effectiveCleanProfileName = cleanProfileName;

    for (let i = 0; i < Math.min(10, lines.length); i++) {
        const line = lines[i].trim();
        if (line.length < 3 || line.length > 100) continue;
        if (line.includes('{:badgeType}') || line.includes('account')) continue;
        if (/linkedin|feed|posts|comments|reactions|activity|search|people|messaging|home|network|jobs|notifications|contact info|followers|connections|degree connection/i.test(line)) continue;
        if (/^\d+|see all|view full|mutual connections?$|pending|message|connect|follow|more|view|profile|shared|ago|company|university|Premium|Verified/i.test(line)) continue;
        if (!/^[A-Za-z\s'-]+$/.test(line)) continue; // Allow apostrophes and hyphens in names
        if (i + 1 < lines.length) {
            const nextLine = lines[i + 1].trim();
            if (nextLine.match(/He\/Him|She\/Her|They\/Them/i) ||
                (i + 2 < lines.length && lines[i + 2].trim().match(/(?:1st|2nd|3rd)/))) {
                return effectiveCleanProfileName(line);
            }
        }
        const words = line.split(/\s+/);
        const capitalizedWords = words.filter(w => w.length > 1 && w[0] === w[0].toUpperCase()).length;
        if (words.length === 1 && capitalizedWords === 1 && words[0].length > 2) {
            return effectiveCleanProfileName(line);
        }
        if (words.length > 1 && words.length <= 6 && capitalizedWords >= 1) {
            return effectiveCleanProfileName(line);
        }
    }
    const pronounPattern = /^([A-Za-z\s'-]+)\s*\n\s*(?:He\/Him|She\/Her|They\/Them)/m;
    const pronounMatch = text.match(pronounPattern);
    if (pronounMatch && pronounMatch[1] && !pronounMatch[1].includes('{:')) {
        return effectiveCleanProfileName(pronounMatch[1].trim());
    }
    const extractedHeadlineFn = typeof extractHeadlineFromProfile === 'function' ? extractHeadlineFromProfile : () => "Unknown Profile";
    const extractedHeadline = extractedHeadlineFn(text, "Unknown Profile");
    if (extractedHeadline && extractedHeadline !== "Unknown Profile" && extractedHeadline.split(/\s+/).length <= 6 && /^[A-Za-z\s'-]+$/.test(extractedHeadline) && !extractedHeadline.toLowerCase().includes(' at ')) {
        // return effectiveCleanProfileName(extractedHeadline); // Commented out as per original
    }
    return "Unknown Profile";
}


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const senderIdentifier = sender.tab ? `Tab ${sender.tab.id}` : 'Popup/OtherExtensionUI';
  console.log(`${SCRIPT_VERSION}: BG Received Msg - Action: ${request.action}, From: ${senderIdentifier}, Payload Snippet:`, JSON.stringify(request)?.substring(0, 200));

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
      return true;

    case 'initiateCurrentPageTextCollection':
      handleInitiateCurrentPageTextCollection(request, sender)
        .then(response => {
          sendResponse(response);
        })
        .catch(error => {
          const errorMsg = error.message || "Unknown error in initiateCurrentPageTextCollection promise chain.";
          console.error(`${SCRIPT_VERSION}: BG ${request.action} - handleInitiateCurrentPageTextCollection FAILED. Error: ${errorMsg}`, error);
          updateUIs(`Collection Error: ${errorMsg.substring(0, 150)}`, "error", sender.tab?.id);
          sendResponse({ success: false, error: errorMsg });
        });
      return true;

    case 'downloadCollectedDataFile':
      handleDownloadCollectedDataFile(sender.tab?.id)
        .then(response => {
            sendResponse(response);
        })
        .catch(error => {
          const errorMsg = error.message || "Unknown download error.";
          console.error(`${SCRIPT_VERSION}: ${request.action} - Overall ERROR: ${errorMsg}`);
          updateUIs(`Download failed: ${errorMsg.substring(0, 150)}`, "error", sender.tab?.id);
          sendResponse({ success: false, error: errorMsg });
        });
      return true;

    case 'refineAllDataWithDify':
      const { profileUrl: refineProfileUrl } = request;
      const tabIdForRefinement = request.tabId || sender.tab?.id;

      console.log(`${SCRIPT_VERSION}: Received refineAllDataWithDify for ${refineProfileUrl}`);
      if (!refineProfileUrl) {
        const errorMsg = "Profile URL missing for Dify refinement.";
        console.error(`${SCRIPT_VERSION}: ${request.action} - ERROR: ${errorMsg}`);
        updateUIs(errorMsg, "error", tabIdForRefinement);
        sendResponse({ success: false, error: errorMsg });
        return true; 
      }

      handleRefineAllDataWithDify(refineProfileUrl, tabIdForRefinement)
        .then(response => {
          console.log(`${SCRIPT_VERSION}: ${request.action} - handleRefineAllDataWithDify completed. Calling sendResponse.`);
          sendResponse(response);
        })
        .catch(error => {
          const errorMsg = `Error in Dify refinement process: ${error.message}`;
          console.error(`${SCRIPT_VERSION}: ${request.action} - TOP LEVEL CATCH ERROR: ${errorMsg}`, error);
          updateUIs(errorMsg.substring(0,150), "error", tabIdForRefinement);
          sendResponse({ success: false, error: errorMsg });
        });
      return true;

    default:
      const unknownActionMsg = `Unknown action received: ${request.action}`;
      console.warn(`${SCRIPT_VERSION}: ${unknownActionMsg}`);
      sendResponse({ success: false, error: unknownActionMsg });
      return false;
  }
});

// --- Dify Helper Functions ---
function getRawTextKeyForSection(sectionKey) {
  const lowerSectionKey = sectionKey.toLowerCase();
  if (lowerSectionKey === SECTION_KEYS.PROFILE) return 'mainProfileText';
  if (lowerSectionKey === SECTION_KEYS.POSTS) return 'postsText';
  if (lowerSectionKey === SECTION_KEYS.COMMENTS) return 'commentsText';
  if (lowerSectionKey === SECTION_KEYS.REACTIONS) return 'reactionsText';
  console.warn(`${SCRIPT_VERSION}: Unknown sectionKey '${sectionKey}' for getRawTextKeyForSection`);
  return null;
}

function getParsedResultKeyForSection(sectionKey) {
  const lowerSectionKey = sectionKey.toLowerCase();
  if (lowerSectionKey === SECTION_KEYS.PROFILE) return 'profileInfo';
  if ([SECTION_KEYS.POSTS, SECTION_KEYS.COMMENTS, SECTION_KEYS.REACTIONS].includes(lowerSectionKey)) return lowerSectionKey;
  console.warn(`${SCRIPT_VERSION}: Unknown sectionKey '${sectionKey}' for getParsedResultKeyForSection`);
  return null;
}

async function callDifyWorkflowForRefinement(sectionType, profilePersonName, rawSectionText, initialParsedJsonString) {
  const DIFY_API_KEY = 'app-7HGSEfSYnQqeMyKNMDOzVdtJ';
  const DIFY_API_BASE_URL = 'https://api.dify.ai/v1';

  const endpoint = `${DIFY_API_BASE_URL}/workflows/run`;
  const uniqueUserId = `linkedin_ext_user_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

  const body = {
    inputs: {
      section_type: sectionType,
      profile_person_name: profilePersonName,
      raw_section_text: rawSectionText,
      initial_parsed_json: initialParsedJsonString
    },
    response_mode: "blocking",
    user: uniqueUserId
  };

  console.log(`${SCRIPT_VERSION}: Calling Dify Workflow for Refinement. Endpoint: ${endpoint}, Section: ${sectionType}, User: ${uniqueUserId}`);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
        console.error(`${SCRIPT_VERSION}: Dify API HTTP Error Response Body:`, errorData);
      } catch (e) {
        const responseText = await response.text();
        console.error(`${SCRIPT_VERSION}: Dify API HTTP Error - Non-JSON response:`, responseText);
        errorData = { message: response.statusText || 'Failed to fetch', details: responseText };
      }
      console.error(`${SCRIPT_VERSION}: Dify API HTTP Error: ${response.status}`, errorData);
      return {
        success: false,
        error: `Dify API error (${response.status}): ${errorData.message || 'Unknown Dify API error'}`,
        details: errorData,
        workflow_run_id: errorData?.task_id || errorData?.workflow_run_id || null // Attempt to get run ID even from error
      };
    }

    const result = await response.json();
    // Log more of the response to help debug structure issues if they re-occur
    console.log(`${SCRIPT_VERSION}: Dify Workflow response for ${sectionType}:`, JSON.stringify(result).substring(0, 1000));


    // Check new Dify response structure: result.data.outputs.final_refined_json
    if (result && result.data && result.data.outputs && typeof result.data.outputs.final_refined_json === 'string') {
      console.log(`${SCRIPT_VERSION}: Dify Workflow succeeded for ${sectionType}. Refined JSON (string) received.`);
      try {
        const refinedJson = JSON.parse(result.data.outputs.final_refined_json);
        console.log(`${SCRIPT_VERSION}: Refined JSON for ${sectionType} parsed successfully.`);
        return {
          success: true,
          data: refinedJson, // This is the object like {"answer": {...}} or {"commentsMadeByProfilePerson": ...}
          workflow_run_id: result.data.id || result.workflow_run_id // Use data.id as primary
        };
      } catch (e) {
        console.error(`${SCRIPT_VERSION}: Failed to parse refined JSON string from Dify for ${sectionType}:`, e);
        console.error(`${SCRIPT_VERSION}: Raw string from Dify for ${sectionType} was:`, result.data.outputs.final_refined_json);
        return {
          success: false,
          error: 'Failed to parse refined JSON from Dify. Output was not valid JSON.',
          raw_output: result.data.outputs.final_refined_json,
          workflow_run_id: result.data.id || result.workflow_run_id
        };
      }
    } else {
       if (result && result.data && result.data.status === 'failed') {
          console.error(`${SCRIPT_VERSION}: Dify Workflow execution explicitly failed for ${sectionType}:`, result.data.error || result.data);
          return {
            success: false,
            error: `Dify workflow execution failed for ${sectionType}: ${result.data.error || 'Unknown workflow error'}`,
            workflow_run_id: result.data.id || result.workflow_run_id,
            details: result.data
          };
       }
      console.error(`${SCRIPT_VERSION}: Dify Workflow response unexpected structure for ${sectionType} or missing final_refined_json string. Received:`, result);
      return {
        success: false,
        error: 'Unexpected response structure from Dify workflow or missing refined JSON string.',
        details: result,
        workflow_run_id: result.data?.id || result.workflow_run_id || result.task_id // Get any available ID
      };
    }

  } catch (error) {
    console.error(`${SCRIPT_VERSION}: Network or other error calling Dify API for ${sectionType}:`, error);
    return {
      success: false,
      error: `Failed to call Dify API for ${sectionType}: ${error.message}`
    };
  }
}

async function handleRefineAllDataWithDify(profileUrl, tabId) {
  console.log(`${SCRIPT_VERSION}: Starting AI refinement for all sections of ${profileUrl}`);
  updateUIs("Starting AI refinement for all sections... This may take some time.", "info", tabId);

  const allProfilesData = await getStoredParsedData();
  const currentProfileData = allProfilesData[profileUrl];

  if (!currentProfileData) {
    const msg = `No data found for profile ${profileUrl} to refine. Please collect some data first.`;
    console.warn(`${SCRIPT_VERSION}: ${msg}`);
    updateUIs(msg, "warning", tabId);
    return { success: false, error: msg };
  }

  const initialProfilePersonNameForDify = currentProfileData.profileName || "Unknown Profile";
  let overallSuccess = true;
  let refinementMessages = [];
  const sectionsToProcess = [SECTION_KEYS.PROFILE, SECTION_KEYS.POSTS, SECTION_KEYS.COMMENTS, SECTION_KEYS.REACTIONS];

  for (const sectionKey of sectionsToProcess) {
    const rawTextKey = getRawTextKeyForSection(sectionKey);
    const parsedResultKey = getParsedResultKeyForSection(sectionKey);

    if (!rawTextKey || !parsedResultKey) {
        console.warn(`${SCRIPT_VERSION}: Invalid section key '${sectionKey}' during refinement. Skipping.`);
        refinementMessages.push(`Skipped invalid section key: ${sectionKey}.`);
        continue;
    }

    if (!currentProfileData.parsingMetadata) {
        currentProfileData.parsingMetadata = {};
    }
    if (typeof currentProfileData.parsingMetadata[`${sectionKey}DifyRefined`] === 'undefined') {
        currentProfileData.parsingMetadata[`${sectionKey}DifyRefined`] = false;
    }

    const rawSectionText = currentProfileData.rawTexts?.[rawTextKey];
    const initialParsedData = currentProfileData.parsingResults?.[parsedResultKey];

    if (rawSectionText && initialParsedData && Object.keys(initialParsedData).length > 0 && !initialParsedData.parseError) {
      updateUIs(`Refining ${sectionKey} data with AI...`, "info", tabId);
      let initialParsedJsonString;
      try {
        initialParsedJsonString = JSON.stringify(initialParsedData);
      } catch (e) {
        console.error(`${SCRIPT_VERSION}: Could not stringify initial parsed data for ${sectionKey} of ${profileUrl}`, e);
        updateUIs(`⚠️ Error preparing ${sectionKey} data for AI. Skipping.`, "error", tabId);
        refinementMessages.push(`Error preparing ${sectionKey} for AI: ${e.message}`);
        currentProfileData.parsingMetadata[`${sectionKey}DifyRefined`] = false;
        currentProfileData.parsingMetadata[`${sectionKey}DifyRefinementError`] = `Serialization error: ${e.message}`;
        overallSuccess = false;
        continue;
      }

      // Use the most current known name for this profile for Dify's context.
      // This name is updated if the 'profile' section itself is successfully refined.
      const nameForDifyContext = currentProfileData.profileName || initialProfilePersonNameForDify;

      const refinementResult = await callDifyWorkflowForRefinement(
        sectionKey,
        nameForDifyContext,
        rawSectionText,
        initialParsedJsonString
      );

      if (refinementResult.success && refinementResult.data) {
        // *** START: Unwrapping logic for Dify's {"answer": ...} structure ***
        if (refinementResult.data && typeof refinementResult.data.answer !== 'undefined') {
            currentProfileData.parsingResults[parsedResultKey] = refinementResult.data.answer;
        } else {
            currentProfileData.parsingResults[parsedResultKey] = refinementResult.data;
            if (sectionKey !== SECTION_KEYS.COMMENTS) {
                 console.warn(`${SCRIPT_VERSION}: Dify refined data for ${sectionKey} did not have the 'answer' wrapper as typically expected. Storing raw Dify output for this section.`);
            }
        }
        // *** END: Unwrapping logic ***

        currentProfileData.parsingMetadata[`${sectionKey}DifyRefined`] = true;
        currentProfileData.parsingMetadata[`${sectionKey}DifyRefinementError`] = null;
        currentProfileData.parsingMetadata[`${sectionKey}DifyWorkflowRunId`] = refinementResult.workflow_run_id;

        // *** START: Update profileName if PROFILE section was refined ***
        if (sectionKey === SECTION_KEYS.PROFILE && currentProfileData.parsingResults.profileInfo) {
            const refinedNameFromDify = currentProfileData.parsingResults.profileInfo.name;
            // Use the globally effective cleanProfileName
            const effectiveCleanProfileNameFn = cleanProfileName;

            if (refinedNameFromDify &&
                typeof refinedNameFromDify === 'string' &&
                refinedNameFromDify.trim() !== "" &&
                refinedNameFromDify !== "Unknown Profile" &&
                refinedNameFromDify !== "See Featured Section") {

                const cleanedDifyName = effectiveCleanProfileNameFn(refinedNameFromDify);
                const currentCleanedProfileName = effectiveCleanProfileNameFn(currentProfileData.profileName);

                if (cleanedDifyName !== currentCleanedProfileName) {
                    console.log(`${SCRIPT_VERSION}: Updating profileName for ${profileUrl} from "${currentProfileData.profileName}" to Dify-refined name "${cleanedDifyName}".`);
                    currentProfileData.profileName = cleanedDifyName;
                }
            }
        }
        // *** END: Update profileName ***

        const successMsg = `✅ ${sectionKey} data refined successfully by AI.`;
        console.log(`${SCRIPT_VERSION}: ${successMsg} (Run ID: ${refinementResult.workflow_run_id || 'N/A'})`);
        updateUIs(successMsg, "success", tabId);
        refinementMessages.push(successMsg);
      } else {
        currentProfileData.parsingMetadata[`${sectionKey}DifyRefined`] = false;
        currentProfileData.parsingMetadata[`${sectionKey}DifyRefinementError`] = refinementResult.error || 'Unknown Dify error';
        currentProfileData.parsingMetadata[`${sectionKey}DifyWorkflowRunId`] = refinementResult.workflow_run_id;
         if (refinementResult.raw_output) {
            currentProfileData.parsingMetadata[`${sectionKey}DifyRawOutput`] = refinementResult.raw_output.substring(0, 1000);
        }
        const errorMsg = `⚠️ ${sectionKey} AI refinement failed: ${(refinementResult.error || 'Unknown Dify error').substring(0,100)}`;
        console.warn(`${SCRIPT_VERSION}: ${errorMsg} (Run ID: ${refinementResult.workflow_run_id || 'N/A'})`, refinementResult.details || '');
        updateUIs(errorMsg, "error", tabId);
        refinementMessages.push(errorMsg);
        overallSuccess = false;
      }
    } else {
      let skipReason = "missing raw text or initial valid parsed data.";
      if (initialParsedData && initialParsedData.parseError) {
          skipReason = "initial parsing resulted in an error.";
      } else if (!rawSectionText) {
          skipReason = "no raw text collected.";
      } else if (!initialParsedData || Object.keys(initialParsedData).length === 0) {
          skipReason = "no initial parsed data available.";
      }
      const skipMsg = `Skipping AI refinement for ${sectionKey}: ${skipReason}`;
      console.log(`${SCRIPT_VERSION}: ${skipMsg}`);
      refinementMessages.push(`Skipped ${sectionKey} (${skipReason.substring(0,30)}).`);
      if (typeof currentProfileData.parsingMetadata[`${sectionKey}DifyRefined`] === 'undefined' || !currentProfileData.parsingMetadata[`${sectionKey}DifyRefined`]){
          currentProfileData.parsingMetadata[`${sectionKey}DifyRefined`] = false;
      }
    }
  }

  allProfilesData[profileUrl] = currentProfileData;

  try {
    await setStoredParsedData(allProfilesData);
  } catch(storageError) {
      console.error(`${SCRIPT_VERSION}: Failed to save Dify refined data to storage for ${profileUrl}:`, storageError);
      const storageErrorMsg = `CRITICAL: Failed to save refined data to storage! ${storageError.message.substring(0,100)}`;
      updateUIs(storageErrorMsg, "error", tabId);
      refinementMessages.push(storageErrorMsg);
      return { success: false, message: storageErrorMsg, details: refinementMessages };
  }

  const finalMessage = overallSuccess ?
    "AI refinement process completed for all applicable sections." :
    "AI refinement process completed with some issues. Check logs and downloaded data for details.";

  console.log(`${SCRIPT_VERSION}: ${finalMessage} Profile: ${profileUrl}. Summary: ${refinementMessages.join('; ')}`);
  updateUIs(finalMessage, overallSuccess ? "success" : "warning", tabId);
  return { success: overallSuccess, message: finalMessage, details: refinementMessages };
}
// --- End Dify Helper Functions ---


function withTimeout(promise, timeoutMs, timeoutMessage) {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
        )
    ]);
}

async function parseWithTimeout(parserFunction, rawText, profileNameContext, sectionKey, timeoutMs = 5000) { // Renamed profileName to profileNameContext
    console.log(`${SCRIPT_VERSION}: parseWithTimeout starting for ${sectionKey} using ${parserFunction.name}, timeout: ${timeoutMs}ms`);

    return new Promise((resolve, reject) => {
        let completed = false;

        const timeoutId = setTimeout(() => {
            if (!completed) {
                completed = true;
                console.error(`${SCRIPT_VERSION}: Parser TIMEOUT for ${sectionKey} via ${parserFunction.name} after ${timeoutMs}ms`);
                reject(new Error(`Parser timeout for ${sectionKey} (${parserFunction.name}) after ${timeoutMs}ms`));
            }
        }, timeoutMs);

        Promise.resolve().then(async () => {
            if (completed) return;
            try {
                // Pass profileNameContext to the parser function
                const result = await parserFunction(rawText, profileNameContext);
                if (!completed) {
                    completed = true;
                    clearTimeout(timeoutId);
                    resolve(result);
                }
            } catch (error) {
                if (!completed) {
                    completed = true;
                    clearTimeout(timeoutId);
                    reject(error);
                }
            }
        }).catch(error => { // Catch for the Promise.resolve().then() chain
            if (!completed) {
                completed = true;
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    });
}


function safeParseProfileInfo(rawText, profileNameContext) {
    try {
        return parseProfileInfo(rawText, profileNameContext);
    } catch (error) {
        console.error(`${SCRIPT_VERSION}: safeParseProfileInfo: parseProfileInfo threw an error:`, error);
        throw error; 
    }
}

function safeParsePosts(rawText, profileNameContext) {
    try {
        return parsePosts(rawText, profileNameContext);
    } catch (error) {
        console.error(`${SCRIPT_VERSION}: safeParsePosts: parsePosts threw an error:`, error);
        throw error;
    }
}

function safeParseComments(rawText, profileNameContext) {
    try {
        return parseComments(rawText, profileNameContext);
    } catch (error) {
        console.error(`${SCRIPT_VERSION}: safeParseComments: parseComments threw an error:`, error);
        throw error;
    }
}

function safeParseReactions(rawText, profileNameContext) {
    try {
        return parseReactions(rawText, profileNameContext);
    } catch (error) {
        console.error(`${SCRIPT_VERSION}: safeParseReactions: parseReactions threw an error:`, error);
        throw error;
    }
}


async function handleSaveCapturedTextAndParse(profileUrl, sectionKey, rawText) {
    console.log(`${SCRIPT_VERSION}: HSCTAP started - section: ${sectionKey}, for Profile URL (ID): ${profileUrl}, text length: ${rawText?.length || 0}`);

    if (!profileUrl || !sectionKey || typeof rawText !== 'string') {
      const errorMsg = "Invalid data for HSCTAP (profileUrl, sectionKey, or text missing/invalid).";
      console.error(`${SCRIPT_VERSION}: HSCTAP - ERROR: ${errorMsg}`);
      return `⚠️ ${sectionKey} save failed: ${errorMsg}`;
    }

    const effectiveCleanProfileNameFn = cleanProfileName; // Use the globally defined cleanProfileName

    try {
        const allProfilesData = await getStoredParsedData();
        const currentProfileHolder = allProfilesData[profileUrl] || {
            profileName: "Unknown Profile",
            parsingResults: {},
            rawTexts: {},
            parsingMetadata: { lastUpdated: new Date().toISOString(), textLengths: {}, parsingAttempts: {} }
        };

        if (!currentProfileHolder.parsingMetadata) {
            currentProfileHolder.parsingMetadata = { lastUpdated: new Date().toISOString(), textLengths: {}, parsingAttempts: {} };
        }
        if (!currentProfileHolder.rawTexts) {
            currentProfileHolder.rawTexts = {};
        }
        if (!currentProfileHolder.parsingResults) {
             currentProfileHolder.parsingResults = {};
        }

        let rawTextStorageKey = getRawTextKeyForSection(sectionKey);
        if (!rawTextStorageKey) { // Fallback if sectionKey is not one of the main ones (e.g. from older versions or custom)
            rawTextStorageKey = sectionKey.toLowerCase() + "Text";
            if (sectionKey.toLowerCase() === SECTION_KEYS.PROFILE) rawTextStorageKey = "mainProfileText"; // Ensure consistency
        }

        currentProfileHolder.rawTexts[rawTextStorageKey] = rawText;
        currentProfileHolder.parsingMetadata.textLengths[rawTextStorageKey] = rawText.length;
        currentProfileHolder.parsingMetadata.lastUpdated = new Date().toISOString();

        const attemptKey = sectionKey.toLowerCase();
        currentProfileHolder.parsingMetadata.parsingAttempts[attemptKey] = (currentProfileHolder.parsingMetadata.parsingAttempts[attemptKey] || 0) + 1;
        currentProfileHolder.parsingMetadata[`${attemptKey}DifyRefined`] = false;
        currentProfileHolder.parsingMetadata[`${attemptKey}DifyRefinementError`] = null;
        currentProfileHolder.parsingMetadata[`${attemptKey}DifyWorkflowRunId`] = null;

        let profileNameForParserContext = currentProfileHolder.profileName;

        if (sectionKey.toLowerCase() === SECTION_KEYS.PROFILE) {
            const extractedNameFromProfilePageText = extractProfileNameFromText(rawText);
            if (extractedNameFromProfilePageText !== "Unknown Profile") {
                const cleanedExtractedName = effectiveCleanProfileNameFn(extractedNameFromProfilePageText);
                if (profileNameForParserContext === "Unknown Profile" || profileNameForParserContext !== cleanedExtractedName) {
                    profileNameForParserContext = cleanedExtractedName;
                    currentProfileHolder.profileName = profileNameForParserContext;
                    console.log(`${SCRIPT_VERSION}: HSCTAP - Profile name for ${profileUrl} tentatively set to "${currentProfileHolder.profileName}" by text extraction.`);
                }
            }
        }
        // Ensure profileNameForParserContext is always the cleaned version of the current best guess for the profile name
        profileNameForParserContext = effectiveCleanProfileNameFn(currentProfileHolder.profileName || "Unknown Profile");


        let parsedResult = null;
        let parseSuccess = false;
        let parseErrorObject = null;
        let parseWarnings = [];
        const startTime = Date.now();
        const PARSING_TIMEOUT_MS = 10000; // Increased timeout
        const parsedResultStorageKey = getParsedResultKeyForSection(sectionKey);

        console.log(`${SCRIPT_VERSION}: HSCTAP: Parsing ${sectionKey}. Profile Name (for Parser Context): "${profileNameForParserContext}" for Profile URL: ${profileUrl}`);
        try {
            const lowerSectionKey = sectionKey.toLowerCase();
            let parserFunctionWrapper;

            if (lowerSectionKey === SECTION_KEYS.PROFILE) parserFunctionWrapper = safeParseProfileInfo;
            else if (lowerSectionKey === SECTION_KEYS.POSTS) parserFunctionWrapper = safeParsePosts;
            else if (lowerSectionKey === SECTION_KEYS.COMMENTS) parserFunctionWrapper = safeParseComments;
            else if (lowerSectionKey === SECTION_KEYS.REACTIONS) parserFunctionWrapper = safeParseReactions;
            else {
                throw new Error(`Unknown sectionKey '${sectionKey}' for parsing.`);
            }

            try {
                 parsedResult = await parseWithTimeout(parserFunctionWrapper, rawText, profileNameForParserContext, sectionKey.toUpperCase(), PARSING_TIMEOUT_MS);
            } catch (errorFromTimeout) {
                parseErrorObject = errorFromTimeout;
                parsedResult = null; // Ensure parsedResult is null on timeout
            }


            if (parsedResult) { // If parser ran and returned something (even if it's an empty structure)
                if (lowerSectionKey === SECTION_KEYS.PROFILE) {
                    if (parsedResult.name && parsedResult.name !== "Unknown Profile" && parsedResult.name !== "See Featured Section") {
                        const parserExtractedName = effectiveCleanProfileNameFn(parsedResult.name);
                        if (currentProfileHolder.profileName === "Unknown Profile" ||
                            currentProfileHolder.profileName === "See Featured Section" ||
                            currentProfileHolder.profileName !== parserExtractedName) {
                            currentProfileHolder.profileName = parserExtractedName;
                            profileNameForParserContext = parserExtractedName; // Update context for subsequent steps if any within this fn
                            console.log(`${SCRIPT_VERSION}: HSCTAP - Profile name for ${profileUrl} confirmed/updated to "${currentProfileHolder.profileName}" by profile parser.`);
                        }
                    }
                     // If parser didn't find a name, but we had one from text extraction, use that in the result.
                    if ((!parsedResult.name || parsedResult.name === "Unknown Profile" || parsedResult.name === "See Featured Section") &&
                        (profileNameForParserContext !== "Unknown Profile" && profileNameForParserContext !== "See Featured Section")) {
                        parsedResult.name = profileNameForParserContext;
                    }

                    if (!parsedResult.headline) parseWarnings.push("Headline not identified in profile text.");
                    if (!parsedResult.experience || parsedResult.experience.length === 0) parseWarnings.push("No experience entries identified.");
                    if (!parsedResult.education || parsedResult.education.length === 0) parseWarnings.push("No education entries identified.");
                } else if (lowerSectionKey === SECTION_KEYS.POSTS) {
                    if (!parsedResult.postsAndRepostsByProfilePerson || parsedResult.postsAndRepostsByProfilePerson.length === 0) {
                         parseWarnings.push(`No posts/reposts identified in ${sectionKey} text.`);
                    }
                } else if (lowerSectionKey === SECTION_KEYS.COMMENTS) {
                     if (!parsedResult.commentsMadeByProfilePerson || parsedResult.commentsMadeByProfilePerson.length === 0) {
                         parseWarnings.push(`No comments identified in ${sectionKey} text.`);
                    }
                } else if (lowerSectionKey === SECTION_KEYS.REACTIONS) {
                     if (!parsedResult.reactionsMadeByProfilePerson || parsedResult.reactionsMadeByProfilePerson.length === 0) {
                         parseWarnings.push(`No reactions identified in ${sectionKey} text.`);
                    }
                }
                if(parsedResultStorageKey) currentProfileHolder.parsingResults[parsedResultStorageKey] = parsedResult;
                parseSuccess = true; // Considered success if parser ran without throwing and returned a structure
            } else if (parseErrorObject) { // If parseWithTimeout threw or resulted in null due to timeout/error
                 parseSuccess = false;
            } else { // Parser returned null/undefined without an explicit error object (should be rare with current setup)
                parseSuccess = false;
                parseWarnings.push(`Parser for ${sectionKey} returned no result without explicit error.`);
            }

            const parseTime = Date.now() - startTime;
            console.log(`${SCRIPT_VERSION}: HSCTAP: Parsing phase for ${sectionKey} (Profile URL: ${profileUrl}) completed in ${parseTime}ms. Success: ${parseSuccess}. Warnings: ${parseWarnings.join(", ")}`);
            if (parseWarnings.length > 0) console.warn(`${SCRIPT_VERSION}: HSCTAP: Parsing warnings for ${sectionKey} (Profile URL: ${profileUrl}):`, parseWarnings);

        } catch (error) { // Catch errors from the main try block (e.g., unknown sectionKey)
            parseErrorObject = error; parseSuccess = false;
            console.error(`${SCRIPT_VERSION}: HSCTAP: Error during main parsing structure for ${sectionKey} (Profile URL: ${profileUrl}):`, error);
        }

        if (!parseSuccess && parsedResultStorageKey) {
            const errorMsgToStore = parseErrorObject ? parseErrorObject.message : `Parsing ${sectionKey} text was not successful.`;
            const errorInfo = {
                parseError: errorMsgToStore,
                parseErrorTimestamp: new Date().toISOString(),
                parseErrorStack: parseErrorObject?.stack?.substring(0, 500)
            };
            // Ensure a default structure exists even on error, especially for activity sections
            if (!currentProfileHolder.parsingResults[parsedResultStorageKey]) {
                const defaultNameForErrorObject = sectionKey.toLowerCase() === SECTION_KEYS.PROFILE ? profileNameForParserContext : "N/A for activity section";
                if (sectionKey.toLowerCase() === SECTION_KEYS.PROFILE) currentProfileHolder.parsingResults[parsedResultStorageKey] = { name: defaultNameForErrorObject, headline: null, ...errorInfo };
                else if (sectionKey.toLowerCase() === SECTION_KEYS.POSTS) currentProfileHolder.parsingResults[parsedResultStorageKey] = { postsAndRepostsByProfilePerson: [], ...errorInfo };
                else if (sectionKey.toLowerCase() === SECTION_KEYS.COMMENTS) currentProfileHolder.parsingResults[parsedResultStorageKey] = { commentsMadeByProfilePerson: [], ...errorInfo };
                else if (sectionKey.toLowerCase() === SECTION_KEYS.REACTIONS) currentProfileHolder.parsingResults[parsedResultStorageKey] = { reactionsMadeByProfilePerson: [], ...errorInfo };
                else currentProfileHolder.parsingResults[parsedResultStorageKey] = { ...errorInfo }; // Generic error object
            } else { // If some partial data was there, merge error info
                currentProfileHolder.parsingResults[parsedResultStorageKey] = { ...currentProfileHolder.parsingResults[parsedResultStorageKey], ...errorInfo};
            }
        }

        currentProfileHolder.parsingMetadata[`${attemptKey}ParseSuccess`] = parseSuccess;
        currentProfileHolder.parsingMetadata[`${attemptKey}ParseWarnings`] = parseWarnings;
        if (parseErrorObject) {
            currentProfileHolder.parsingMetadata[`${attemptKey}ParseError`] = parseErrorObject.message;
        } else if (!parseSuccess && parsedResultStorageKey && !currentProfileHolder.parsingResults[parsedResultStorageKey]?.parseError) {
            currentProfileHolder.parsingMetadata[`${attemptKey}ParseError`] = `Parsing ${sectionKey} completed, but result was not considered valid or successful.`;
        }


        allProfilesData[profileUrl] = currentProfileHolder;

        try {
            await setStoredParsedData(allProfilesData);
        } catch (storageError) {
            console.error(`${SCRIPT_VERSION}: HSCTAP: Failed to save data to storage for Profile URL ${profileUrl}, section ${sectionKey}:`, storageError);
            return `⚠️ ${sectionKey} parsed but FAILED TO SAVE to storage. Error: ${storageError.message}. Raw: ${rawText.length} chars.`;
        }

        let resultMessage;
        if (parseSuccess && parsedResultStorageKey) {
            let itemDetails = '';
            const currentResultsForSection = currentProfileHolder.parsingResults[parsedResultStorageKey];
            if (currentResultsForSection) {
               const lowerSectionKey = sectionKey.toLowerCase();
               if (lowerSectionKey === SECTION_KEYS.POSTS) itemDetails = ` Found: ${currentResultsForSection.postsAndRepostsByProfilePerson?.length || 0} potential posts/reposts.`;
               else if (lowerSectionKey === SECTION_KEYS.COMMENTS) itemDetails = ` Found: ${currentResultsForSection.commentsMadeByProfilePerson?.length || 0} potential comments.`;
               else if (lowerSectionKey === SECTION_KEYS.REACTIONS) itemDetails = ` Found: ${currentResultsForSection.reactionsMadeByProfilePerson?.length || 0} potential reactions.`;
               else if (lowerSectionKey === SECTION_KEYS.PROFILE && currentResultsForSection) {
                   const expCount = currentResultsForSection.experience?.length || 0;
                   const eduCount = currentResultsForSection.education?.length || 0;
                   const skillsCount = currentResultsForSection.skills?.length || 0;
                   const actualName = (currentResultsForSection.name && currentResultsForSection.name !== "Unknown Profile" && currentResultsForSection.name !== "See Featured Section") ? ` (Name: ${currentResultsForSection.name.substring(0,25)})` : "";
                   itemDetails = ` Profile details extracted${actualName}. Exp: ${expCount}, Edu: ${eduCount}, Skills: ${skillsCount}.`;
               }
           }
            const warningText = parseWarnings.length > 0 ? ` Warnings: ${parseWarnings.join("; ")}` : '';
            resultMessage = `✅ ${sectionKey} data processed.${itemDetails}${warningText} Raw: ${rawText.length} chars. (Profile ID: ${profileUrl.slice(-15)})`;
        } else {
            const finalErrorMsg = currentProfileHolder.parsingMetadata[`${attemptKey}ParseError`] || parseErrorObject?.message || 'unknown error during parse';
            resultMessage = `⚠️ ${sectionKey} raw text saved for Profile ID ${profileUrl.slice(-15)}, but PARSING FAILED. Error: ${finalErrorMsg}. Raw: ${rawText.length} chars.`;
        }

        console.log(`${SCRIPT_VERSION}: HSCTAP completed for Profile URL ${profileUrl}. Returning: ${resultMessage.substring(0,250)}`);
        return resultMessage;
    } catch (outerError) {
        console.error(`${SCRIPT_VERSION}: HSCTAP: FATAL outer error for Profile URL ${profileUrl}, section ${sectionKey}:`, outerError);
        return `⚠️ ${sectionKey} processing FAILED (outer): ${outerError.message}`;
    }
}

async function handleInitiateCurrentPageTextCollection(request, sender) {
    const { profileUrl, pathKey } = request;
    const tabId = request.tabId || sender.tab?.id;

    if (!profileUrl || !pathKey) {
        const errorMsg = "URL or pathKey missing for HICPTextCollection.";
        console.error(`${SCRIPT_VERSION}: HICPTextCollection - ERROR: ${errorMsg}`);
        if (tabId) updateUIs(errorMsg, "error", tabId);
        return { success: false, error: errorMsg };
    }
    if (!tabId) {
        const errorMsg = "No tab ID for HICPTextCollection.";
        console.error(`${SCRIPT_VERSION}: HICPTextCollection - ERROR: No Tab ID.`);
        return { success: false, error: errorMsg };
    }

    updateUIs(`Extracting text from current ${pathKey} page...`, "info", tabId);
    let responseForSendResponse;
    try {
        let responseFromContent;
        try {
            // Add a timeout for the message to content script
            responseFromContent = await withTimeout(
                chrome.tabs.sendMessage(tabId, { action: 'extractRawTextForSection', pathKey: pathKey, profileUrl: profileUrl }),
                15000, // 15 second timeout for content script to respond
                `Timeout waiting for content script on tab ${tabId} to extract text for ${pathKey}.`
            );
        } catch (sendMessageError) {
            console.error(`${SCRIPT_VERSION}: HICPTextCollection: chrome.tabs.sendMessage FAILED or TIMED OUT for tab ${tabId}, pathKey ${pathKey}. Error:`, sendMessageError);
            updateUIs(`Error communicating with content script: ${sendMessageError.message.substring(0,150)}`, "error", tabId);
            return { success: false, error: `Failed to send message to/receive from content script: ${sendMessageError.message}` };
        }

        if (responseFromContent && typeof responseFromContent === 'object') {
            if (responseFromContent.success && typeof responseFromContent.text === 'string') {
                let saveParseMessage;
                try {
                    saveParseMessage = await handleSaveCapturedTextAndParse(responseFromContent.profileUrl, responseFromContent.pathKey, responseFromContent.text);
                } catch (parseProcessingError) {
                    console.error(`${SCRIPT_VERSION}: HICPTextCollection: Error in HSCTAP call:`, parseProcessingError);
                    saveParseMessage = `⚠️ ${pathKey} processing error in HSCTAP: ${parseProcessingError.message}`;
                }

                let overallStatusType = "success"; // Default to success
                // Check message for failure/warning indicators
                const lowerSaveParseMessage = saveParseMessage.toLowerCase();
                if (lowerSaveParseMessage.includes('⚠️') || lowerSaveParseMessage.includes('failed')) overallStatusType = "error";
                else if (lowerSaveParseMessage.includes('warning')) overallStatusType = "warning";


                const UIMessage = `${pathKey} page processed. Result: ${saveParseMessage}`;
                updateUIs(UIMessage, overallStatusType, tabId);
                responseForSendResponse = { success: overallStatusType !== 'error', message: UIMessage, details: saveParseMessage };
            } else { // Content script reported failure or invalid response
                const contentError = responseFromContent.error || 'Content script failed to return valid text or success flag.';
                console.error(`${SCRIPT_VERSION}: HICPTextCollection - Content script execution ERROR: ${contentError}`);
                updateUIs(`Content script error: ${contentError.substring(0,150)}`, "error", tabId);
                responseForSendResponse = { success: false, error: contentError };
            }
        } else { // Invalid or empty response object from content script
            const commsError = 'Invalid or empty response from content script.';
            console.error(`${SCRIPT_VERSION}: HICPTextCollection - Content script communication ERROR: ${commsError}`, responseFromContent);
            updateUIs(`Content script communication error.`, "error", tabId);
            responseForSendResponse = { success: false, error: commsError };
        }

    } catch (e) { // Outer catch for handleInitiateCurrentPageTextCollection
        console.error(`${SCRIPT_VERSION}: HICPTextCollection: CRITICAL outer Error for ${pathKey} on tab ${tabId}:`, e);
        const errorMessage = e.message || "Unknown error in text collection process.";
        updateUIs(`Error collecting page data: ${errorMessage.substring(0, 150)}`, "error", tabId);
        responseForSendResponse = { success: false, error: errorMessage };
    }
    return responseForSendResponse;
}


async function handleDownloadCollectedDataFile(sourceTabId) {
   console.log(`${SCRIPT_VERSION}: handleDownloadCollectedDataFile initiated.`);
   const allProfilesData = await getStoredParsedData();
   if (Object.keys(allProfilesData).length === 0) {
       const msg = "No data collected to download.";
       if (sourceTabId) updateUIs(msg, "warning", sourceTabId);
       return { success: false, error: msg };
   }
   const downloadableFileContent = {
     version: SCRIPT_VERSION, // Use dynamic script version
     generatedAt: new Date().toISOString(),
     masterInstructions: MASTER_INSTRUCTIONS_TEXT,
     prompts: { profile: PROFILE_PROMPT_TEXT, posts: POSTS_PROMPT_TEXT, comments: COMMENTS_PROMPT_TEXT, reactions: REACTIONS_PROMPT_TEXT },
     collectedData: allProfilesData,
     parsingStats: generateDetailedParsingStats(allProfilesData)
   };
   const fileContentString = JSON.stringify(downloadableFileContent, null, 2);
   const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(fileContentString);
   const currentDate = new Date().toISOString().split('T')[0];
   const filename = `linkedin_collected_data_dify_${currentDate}.json`;
   console.log(`${SCRIPT_VERSION}: Preparing download of '${filename}'.`);

   return new Promise((resolve) => {
       chrome.downloads.download({ url: dataUrl, filename: filename, saveAs: true }, (downloadId) => {
         if (chrome.runtime.lastError) {
           const errorMsg = `Download API error: ${chrome.runtime.lastError.message}`;
           console.error(`${SCRIPT_VERSION}: ${errorMsg}`);
           resolve({ success: false, error: errorMsg });
         } else if (typeof downloadId === 'undefined') {
            const errorMsg = "Download did not start (downloadId is undefined). Check extension permissions and browser settings.";
            console.error(`${SCRIPT_VERSION}: ${errorMsg}`);
            resolve({ success: false, error: errorMsg });
         } else {
           const successMsg = "Enhanced data file (with Dify status) download initiated!";
           console.log(`${SCRIPT_VERSION}: ${successMsg} ID: ${downloadId}`);
           if (sourceTabId) updateUIs(successMsg, "success", sourceTabId);
           resolve({ success: true, message: successMsg, downloadId: downloadId });
         }
       });
   });
}

function generateDetailedParsingStats(allProfilesData) {
   const stats = {
       totalProfiles: Object.keys(allProfilesData).length,
       sectionsProcessed: 0,
       parseResults: { successful: 0, failed: 0, withWarnings: 0, details: {} },
       difyRefinement: { attempted: 0, successful: 0, failed: 0, skipped: 0, details: {} },
       dataQuality: { avgTextLength: 0, totalTextLength: 0, sectionCoverage: {}, extractionRates: {} }
   };
   let totalTextLengthOverall = 0;
   const sectionTypeCounts = { profile: 0, posts: 0, comments: 0, reactions: 0 };
   const successfulExtractionCounts = { profile: 0, posts: 0, comments: 0, reactions: 0 };

   for (const [profileUrl, profileData] of Object.entries(allProfilesData)) {
       const profileSpecificStats = {
           profileName: profileData.profileName || "Unknown Profile",
           sections: {}, totalSectionsOnProfile: 0, warningsOnProfile: 0,
           textLengthsPerSection: profileData.parsingMetadata?.textLengths || {},
           lastUpdatedOnProfile: profileData.parsingMetadata?.lastUpdated,
           parseErrorsPerSection: {},
           difyStatusPerSection: {}
       };
       stats.difyRefinement.details[profileUrl] = { sections: {} };

       if (profileData.rawTexts) {
           for (const text of Object.values(profileData.rawTexts)) {
               if (typeof text === 'string') totalTextLengthOverall += text.length;
           }
       }

       const allPossibleSectionKeys = Object.values(SECTION_KEYS);

       for (const sectionKey of allPossibleSectionKeys) {
            const parsedResultKey = getParsedResultKeyForSection(sectionKey);
            const result = profileData.parsingResults?.[parsedResultKey]; // This data is now unwrapped if Dify was used
            const metadata = profileData.parsingMetadata;
            const attemptKey = sectionKey.toLowerCase();

            let sectionStatusMessage = "not_processed";
            let itemsCountString = "";

            if (metadata?.parsingAttempts?.[attemptKey] > 0 || result) { // If parsing was attempted or a result exists
                profileSpecificStats.totalSectionsOnProfile++;
                stats.sectionsProcessed++;
                sectionTypeCounts[sectionKey]++;

                if (metadata?.[`${attemptKey}ParseSuccess`] && result && !result.parseError) {
                    stats.parseResults.successful++;
                    successfulExtractionCounts[sectionKey]++;
                    sectionStatusMessage = 'parsed_success';

                    // Add item counts based on unwrapped structure
                    if (sectionKey === SECTION_KEYS.PROFILE && result) {
                        itemsCountString = ` (${result.experience?.length || 0} exp, ${result.education?.length || 0} edu, ${result.skills?.length || 0} skills)`;
                    } else if (sectionKey === SECTION_KEYS.POSTS && result.postsAndRepostsByProfilePerson) {
                        itemsCountString = ` (${result.postsAndRepostsByProfilePerson.length} items)`;
                    } else if (sectionKey === SECTION_KEYS.COMMENTS && result.commentsMadeByProfilePerson) {
                        itemsCountString = ` (${result.commentsMadeByProfilePerson.length} items)`;
                    } else if (sectionKey === SECTION_KEYS.REACTIONS && result.reactionsMadeByProfilePerson) {
                        itemsCountString = ` (${result.reactionsMadeByProfilePerson.length} items)`;
                    }
                    sectionStatusMessage += itemsCountString;

                    const warningsArray = metadata?.[`${attemptKey}ParseWarnings`];
                    if (warningsArray && warningsArray.length > 0) {
                        stats.parseResults.withWarnings++;
                        profileSpecificStats.warningsOnProfile += warningsArray.length;
                        sectionStatusMessage += ` (${warningsArray.length} warnings)`;
                    }
                } else {
                    stats.parseResults.failed++;
                    const errorMsg = result?.parseError || metadata?.[`${attemptKey}ParseError`] || 'unknown parse error';
                    sectionStatusMessage = `parsed_failed: ${errorMsg.substring(0, 100)}`;
                    profileSpecificStats.parseErrorsPerSection[sectionKey] = errorMsg.substring(0, 200);
                }
            } else if (profileData.rawTexts?.[getRawTextKeyForSection(sectionKey)]) {
                 sectionStatusMessage = "raw_text_only (not parsed)";
                 // Not counted in sectionsProcessed or sectionTypeCounts if not parsed.
            }
            profileSpecificStats.sections[sectionKey] = sectionStatusMessage;

            // Dify Refinement Status for this section
            if (metadata) {
                const difyRefinedFlag = metadata[`${sectionKey}DifyRefined`];
                const difyError = metadata[`${sectionKey}DifyRefinementError`];
                const difyRunId = metadata[`${sectionKey}DifyWorkflowRunId`];

                let difyStatusForProfile = 'N/A';
                if (typeof difyRefinedFlag !== 'undefined') {
                    stats.difyRefinement.attempted++;
                    if (difyRefinedFlag === true) {
                        stats.difyRefinement.successful++;
                        difyStatusForProfile = `AI Refined (ID: ${difyRunId || 'unknown'})`;
                        profileSpecificStats.sections[sectionKey] += ' (AI Refined)';
                    } else if (difyError) {
                        stats.difyRefinement.failed++;
                        difyStatusForProfile = `AI Refine Error: ${String(difyError).substring(0,50)} (ID: ${difyRunId || 'unknown'})`;
                        profileSpecificStats.sections[sectionKey] += ` (AI Refine Error)`;
                    } else {
                        stats.difyRefinement.skipped++;
                        difyStatusForProfile = 'AI Not Refined/Skipped';
                    }
                }
                profileSpecificStats.difyStatusPerSection[sectionKey] = difyStatusForProfile;
                stats.difyRefinement.details[profileUrl].sections[sectionKey] = {
                    refined: difyRefinedFlag,
                    error: difyError,
                    runId: difyRunId
                };
            }
       }
       stats.parseResults.details[profileUrl] = profileSpecificStats;
   }

   stats.dataQuality.totalTextLength = totalTextLengthOverall;
   stats.dataQuality.avgTextLength = stats.sectionsProcessed > 0 ? Math.round(totalTextLengthOverall / stats.sectionsProcessed) : 0;

   for (const key of Object.values(SECTION_KEYS)) {
       stats.dataQuality.sectionCoverage[key] = sectionTypeCounts[key] || 0;
       stats.dataQuality.extractionRates[key] = sectionTypeCounts[key] > 0 ? Math.round((successfulExtractionCounts[key] / sectionTypeCounts[key]) * 100) : 0;
   }
   return stats;
}

function updateUIs(message, type = "info", specificTabId = null) {
  let updatedPopup = false, updatedSpecificTab = false, updatedOtherTabs = 0;
  // Try to update popup
  chrome.runtime.sendMessage({ action: 'updatePopupStatus', message: message, type: type })
    .then(() => { updatedPopup = true; })
    .catch(e => { /* Normal if popup closed, or if message channel closes during update */ });

  const sendMessageToTab = (tabIdToUpdate, isPrimaryTarget) => {
    if (typeof tabIdToUpdate !== 'number') return Promise.resolve(false); // Ensure tabId is a number
    return chrome.tabs.sendMessage(tabIdToUpdate, { action: 'updateFloatingUIStatus', message: message, type: type })
    .then(() => {
      if (isPrimaryTarget) updatedSpecificTab = true; else updatedOtherTabs++;
      return true;
    })
    .catch(e => {
      // console.warn(`${SCRIPT_VERSION}: Could not send UI update to Tab ${tabIdToUpdate}. Error: ${e.message.substring(0,100)}`);
      return false; // Tab might be closed or not have content script
    });
  };

  // Update specific tab if ID provided
  if (specificTabId) {
    sendMessageToTab(specificTabId, true).then(success => {
      if (!success) console.warn(`${SCRIPT_VERSION}: Failed to update primary tab ${specificTabId} floating UI (it might be closed or unresponsive).`);
    });
  }

  // Update all other LinkedIn tabs
  chrome.tabs.query({ url: "*://*.linkedin.com/*" }, (tabs) => {
    if (chrome.runtime.lastError) {
      console.warn(`${SCRIPT_VERSION}: Error querying tabs for UI update: ${chrome.runtime.lastError.message}`);
      return;
    }
    if (tabs && tabs.length > 0) {
        const updatePromises = tabs.filter(tab => tab.id && tab.id !== specificTabId) // Exclude already updated tab
                                   .map(tab => sendMessageToTab(tab.id, false));
        Promise.allSettled(updatePromises).then(() => { // Use allSettled to ensure all attempts complete
          // console.log(`${SCRIPT_VERSION}: updateUIs distribution attempt completed.`);
        });
    }
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

console.log(`${SCRIPT_VERSION}: Service worker event listeners attached. Diagnostic logging enhanced.`);