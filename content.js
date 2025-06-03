// content.js (v2-rewritten)
console.log("content.js (v2-rewritten): Script executing on URL:", window.location.href);

if (!window.myLinkedInExtractor_contentScriptMarker_v2) {
  window.myLinkedInExtractor_contentScriptMarker_v2 = true;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("content.js (v2): Message received. Action:", request.action, "Payload:", JSON.stringify(request).substring(0, 200));

    if (request.action === 'extractRawTextForSection') {
      console.log(`content.js (v2): 'extractRawTextForSection' for ${request.pathKey}. ProfileURL: ${request.profileUrl}`);
      const pathKey = request.pathKey;
      const EXTRACTION_DELAY_MS = 250;

      const performSimplifiedRawTextExtraction = () => {
        console.log(`content.js (v2): Attempting simplified raw text extraction for ${pathKey}.`);
        if (!document.body) {
          console.error('content.js (v2): Page body not available.');
          sendResponse({ success: false, error: 'Page body not available.', pathKey: pathKey, profileUrl: request.profileUrl });
          return;
        }

        let textToReturn = "";
        let extractionMessage = `Raw text extracted for ${pathKey} from current view.`;
        let targetElement = null;

        try {
          if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
          }

          if (pathKey === 'profile') {
            targetElement = document.querySelector('main.scaffold-layout__main') || document.querySelector('main[role="main"]') || document.querySelector('main');
          } else if (pathKey === 'posts' || pathKey === 'comments' || pathKey === 'reactions') {
            targetElement = document.querySelector('.scaffold-finite-scroll__content') || document.querySelector('div[role="feed"]') || document.querySelector('main.scaffold-layout__main ul') || document.querySelector('main ul') || document.querySelector('main');
          } else {
            targetElement = document.querySelector('main') || document.body;
          }

          if (targetElement) {
            textToReturn = targetElement.innerText || targetElement.textContent || "";
          } else {
            console.warn(`content.js (v2): No specific targetElement found for ${pathKey}, using document.body.`);
            targetElement = document.body; // Fallback
            textToReturn = targetElement.innerText || targetElement.textContent || "";
          }

          if (!textToReturn || textToReturn.trim().length < 100) {
            console.warn(`content.js (v2): Target for ${pathKey} yielded little/no text (Length: ${textToReturn.trim().length}). Falling back to full document.body.innerText.`);
            textToReturn = document.body.innerText || document.body.textContent || "";
            extractionMessage = `Raw text extracted via document.body.innerText fallback for ${pathKey}.`;
          }
        } catch (e) {
          console.error(`content.js (v2): Error during raw text extraction for ${pathKey}:`, e);
          extractionMessage = `Error extracting raw text for ${pathKey}: ${e.message}. Using body text as fallback.`;
          textToReturn = document.body.innerText || document.body.textContent || "";
        }

        console.log(`content.js (v2): Final raw text for ${pathKey}, Length: ${textToReturn.length}.`);
        sendResponse({
          success: true,
          text: textToReturn,
          pathKey: pathKey,
          profileUrl: request.profileUrl,
          message: extractionMessage
        });
      };

      setTimeout(performSimplifiedRawTextExtraction, EXTRACTION_DELAY_MS);
      return true; // Indicate asynchronous response
    } else if (request.action === 'updateFloatingUIStatus') {
      // This message is intended for floating-ui.js which runs in the same content script context.
      // content.js itself doesn't need to act on it. This prevents "Unknown action" logs from content.js for this specific action.
      // console.log("content.js (v2): Received 'updateFloatingUIStatus', will be handled by floating-ui.js if present.");
      // Optionally, can return false or nothing if not sending a response.
      return false;
    } else {
      console.warn("content.js (v2): Received unknown action:", request.action, request);
      sendResponse({ success: false, error: `content.js received unknown action: ${request.action}` }); // Send a response for unknown actions
      return false; // Synchronous response
    }
  });
  console.log("content.js (v2-rewritten): Message listener attached.");
} else {
  console.warn("content.js (v2-rewritten): Listener flag already set or script already injected. Not re-attaching listener.");
}