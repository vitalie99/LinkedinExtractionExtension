// parserUtils.js - Enhanced utility functions for LinkedIn parsing

/**
 * Cleans and deduplicates text content, removing repeated paragraphs.
 * Also handles cases where the entire text block might be duplicated.
 * @param {string} text - The text to clean
 * @returns {string|null} - Cleaned text or null if empty
 */
export function cleanDuplicateContent(text) {
  if (!text || typeof text !== 'string') return null;

  const trimmedText = text.trim();
  if (!trimmedText) return null;

  // Check for exact duplicate halves (common in LinkedIn extractions for longer texts)
  const halfLength = Math.floor(trimmedText.length / 2);
  if (trimmedText.length > 200 && halfLength > 0) { // Only for substantial texts
    const firstHalf = trimmedText.substring(0, halfLength).trim();
    const secondHalf = trimmedText.substring(halfLength).trim();
    // Check if the halves are very similar (e.g., Jaccard similarity > 0.95) or identical
    if (firstHalf === secondHalf) {
      return firstHalf;
    }
  }

  // Split into paragraphs and remove consecutive duplicates
  const paragraphs = trimmedText.split(/\n\s*\n+/); // Split by one or more newlines, potentially with whitespace
  const uniqueParagraphs = [];
  const seenParagraphs = new Set();

  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim();
    // Normalize for seen check: lower case and remove non-alphanumeric for better duplicate detection
    const normalized = trimmedParagraph.toLowerCase().replace(/\W/g, '');

    if (trimmedParagraph && (uniqueParagraphs.length === 0 || !seenParagraphs.has(normalized) || calculateSimilarity(trimmedParagraph, uniqueParagraphs[uniqueParagraphs.length-1]) < 0.9)) {
      uniqueParagraphs.push(trimmedParagraph);
      if (normalized.length > 30) { // Only add longer, substantial paragraphs to seen set to avoid over-filtering short common phrases
          seenParagraphs.add(normalized);
      }
    }
  }

  return uniqueParagraphs.join('\n\n');
}

/**
 * Calculates similarity between two text strings using Jaccard similarity on words.
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Similarity score between 0 and 1
 */
export function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;

  const words1 = new Set(str1.toLowerCase().match(/\b(\w+)\b/g) || []);
  const words2 = new Set(str2.toLowerCase().match(/\b(\w+)\b/g) || []);

  if (words1.size === 0 && words2.size === 0) return 1; // Both empty considered identical
  if (words1.size === 0 || words2.size === 0) return 0; // One empty, one not

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Extracts mentions (@username) from text.
 * @param {string} text - Text to extract mentions from
 * @returns {Array} - Array of mention objects with name and link (link is always null for now)
 */
export function extractMentions(text) {
  if (!text || typeof text !== 'string') return [];
  const mentions = [];
  // Regex allows for names with dots, hyphens, apostrophes if they are part of the @mention
  const mentionRegex = /@([A-Za-z0-9\s.'-]+)/g;
  let match;
  const seen = new Set();

  while ((match = mentionRegex.exec(text)) !== null) {
    const name = match[1].trim();
    // Basic validation for a plausible mentioned name/entity
    if (name.length > 1 && name.length < 100 && !seen.has(name.toLowerCase())) {
      mentions.push({
        name: name,
        link: null // Link extraction from raw text is usually not feasible without DOM access
      });
      seen.add(name.toLowerCase());
    }
  }
  return mentions;
}

/**
 * Extracts hashtags (#hashtag) from text.
 * @param {string} text - Text to extract hashtags from
 * @returns {Array} - Array of hashtag strings (without the #)
 */
export function extractHashtags(text) {
  if (!text || typeof text !== 'string') return [];
  const hashtags = [];
  const hashtagRegex = /#([a-zA-Z0-9_]+)/g; // Standard hashtag characters
  let match;
  const seen = new Set();

  while ((match = hashtagRegex.exec(text)) !== null) {
    const tag = match[1];
    if (!seen.has(tag.toLowerCase())) {
      hashtags.push(tag);
      seen.add(tag.toLowerCase());
    }
  }
  return hashtags;
}

/**
 * Generates a unique ID for activities/comments/reactions.
 * @param {string} prefix - Prefix for the ID (e.g., profile name)
 * @param {string} content - Content to derive ID from (e.g., first few words)
 * @param {string} timestamp - Timestamp for uniqueness
 * @returns {string} - Unique ID
 */
export function generateUniqueId(prefix, content, timestamp) {
  const safePrefix = (prefix || 'unknown').replace(/[^\w]/g, '_').substring(0, 20);
  const contentSnippet = (content || 'item')
    .substring(0, 20)
    .replace(/[^\w]/g, '_')
    .toLowerCase();
  const timeSnippet = (timestamp || Date.now().toString())
    .replace(/[^\w\s:-]/g, '_') // Keep common time chars like : and -
    .substring(0,15);
  return `${safePrefix}_${contentSnippet}_${timeSnippet}`;
}

/**
 * Extracts timestamp from LinkedIn text using various patterns.
 * @param {string} text - Text to extract timestamp from
 * @returns {string|null} - Extracted timestamp or null
 */
export function extractTimestamp(text) {
  if (!text || typeof text !== 'string') return null;
  // More comprehensive patterns, including minutes, seconds, full dates, and "ago" variations.
  const timestampPatterns = [
    /(\d+[hdwms]\b(?:\s*ago)?)\s*•/, // e.g., "1h •", "2d ago •" (added ms and optional ago)
    /(\d+\s*(?:minute|hour|day|week|month|year)s?\s*ago)\s*•/, // e.g., "2 hours ago •"
    /(\d+[hdwms]\b(?:\s*ago)?)(?=\s|$|\n)/, // e.g., "3w", "5m ago" (at end of line or before space)
    /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4})/i, // e.g., "Jan 1, 2023"
    /(\d{1,2}\/\d{1,2}\/\d{2,4})/, // e.g., "12/31/2023"
  ];

  for (const pattern of timestampPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

/**
 * Extracts engagement numbers (likes, comments, reposts) from text.
 * This is a general utility; more specific parsing is now in activityParser.js
 * @param {string} text - Text to extract engagement from
 * @returns {Object} - Object with likes, commentsCount, repostsCount
 */
export function extractEngagementNumbers(text) {
  if (!text || typeof text !== 'string') return { likes: null, commentsCount: null, repostsCount: null };
  const engagement = {
    likes: null,
    commentsCount: null,
    repostsCount: null
  };

  // Helper to parse numbers with k/M/B suffixes
  const parseNumericValue = (valueStr) => {
    if (!valueStr) return null;
    const str = valueStr.toLowerCase().replace(/,/g, '');
    let num = parseFloat(str);
    if (isNaN(num)) return null;
    if (str.includes('k')) num *= 1000;
    if (str.includes('m')) num *= 1000000;
    if (str.includes('b')) num *= 1000000000;
    return Math.round(num);
  };

  // Extract likes - multiple patterns
  const likesPatterns = [
    /([\d,.]+[kMB]?)\s*(?:likes?|reactions?)/i,
    /([\d,.]+[kMB]?)\s+[\w\s,]+and\s+\d+\s+others/i, // e.g., "John Doe and 26 others"
    // Number on a line, often followed by comments/reposts or action buttons
    /^([\d,.]+[kMB]?)\s*$/m,
  ];
  for (const pattern of likesPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const num = parseNumericValue(match[1]);
      if (num !== null && num >= 0 && num < 2000000000) { // Allow 0 likes
        engagement.likes = num;
        break;
      }
    }
  }
   // Fallback for "X and Y others" if likes not found above
    if (engagement.likes === null) {
        const andOthersMatch = text.match(/([\w\s,]+)\s+and\s+(\d+)\s+others/i);
        if (andOthersMatch && andOthersMatch[1] && andOthersMatch[2]) {
            const namesCount = (andOthersMatch[1].match(/,/g) || []).length + 1;
            engagement.likes = namesCount + parseInt(andOthersMatch[2]);
        }
    }


  const commentsRegex = /([\d,.]+[kMB]?)\s*comments?/i;
  const commentsMatch = text.match(commentsRegex);
  if (commentsMatch && commentsMatch[1]) {
    engagement.commentsCount = parseNumericValue(commentsMatch[1]);
  }

  const repostsRegex = /([\d,.]+[kMB]?)\s*reposts?/i;
  const repostsMatch = text.match(repostsRegex);
  if (repostsMatch && repostsMatch[1]) {
    engagement.repostsCount = parseNumericValue(repostsMatch[1]);
  }

  return engagement;
}

/**
 * Detects media attachments in LinkedIn text.
 * @param {string} text - Text to analyze for media
 * @returns {Array} - Array of media attachment objects
 */
export function detectMediaAttachments(text) {
  if (!text || typeof text !== 'string') return [];
  const media = [];
  const seenDescriptions = new Set();

  const addMedia = (type, description) => {
      if (!seenDescriptions.has(description.toLowerCase())) {
          media.push({ type, description });
          seenDescriptions.add(description.toLowerCase());
      }
  };

  if (text.includes('Activate to view larger image')) addMedia("image", "Activate to view larger image");
  if (text.includes('Play video') || text.match(/Play\s*\n/)) addMedia("video", "Play video");
  if (text.includes('View document')) addMedia("document", "View document");
  if (text.includes('Web Link') || text.match(/Web Link\s*\n/)) addMedia("web_link", "Web Link"); // Added from activityParser
  // Add more patterns if other media types are common, e.g., polls, articles linked within posts

  return media;
}

/**
 * Extracts a content snippet of specified length.
 * @param {string} text - Full text content
 * @param {number} maxWords - Maximum number of words in snippet
 * @returns {string|null} - Content snippet or null
 */
export function extractContentSnippet(text, maxWords = 30) {
  if (!text || typeof text !== 'string') return null;

  const cleanedText = text.trim().replace(/\s+/g, ' '); // Normalize whitespace
  const words = cleanedText.split(' ');
  if (words.length === 0 || words[0] === '') return null;

  const snippet = words.slice(0, maxWords).join(' ');
  return words.length > maxWords ? snippet + '...' : snippet;
}

/**
 * Cleans LinkedIn text by removing common UI elements and metadata.
 * This is a general cleaner; more specific cleaning might be needed in context.
 * @param {string} text - Raw text to clean
 * @returns {string} - Cleaned text
 */
export function cleanLinkedInText(text) {
  if (!text || typeof text !== 'string') return '';

  let cleaned = text;
  // Normalize line breaks and trim whitespace
  cleaned = cleaned.replace(/\r\n|\r/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  // Common UI elements that are often safe to remove globally
  const uiPatternsToRemove = [
    /Follow\s*\n/g,                            // Follow buttons
    /Like\s+Comment\s+Repost\s+Send\s*$/gm,    // Action button sequences at end of lines
    /\nActivate to view[^\n]*/g,             // Activation prompts
    /\n…more\n/g,                             // "…more" indicators (if not handled by truncation)
    /\s*{:badgeType}\s*/g,                    // Badge type markers like "{:badgeType}"
    /\nVisible to anyone on or off LinkedIn\s*$/gim,
    /\nEdited\s*•\s*Visible to anyone on or off LinkedIn\s*$/gim,
    /\n\d+[hdwms]\b(?:\s*ago)?\s*•\s*Edited\s*•?\s*$/gim, // Timestamp + Edited
    /\n\d+[hdwms]\b(?:\s*ago)?\s*•?\s*$/gim,             // Timestamp line
    /View job\s*$/gim,
    /Play\s*(?=\n|$)/g, // "Play" button for videos if on its own
    /Unmute\s*(?=\n|$)/g,
    /Turn closed captions on\s*(?=\n|$)/g,
    /Turn fullscreen on\s*(?=\n|$)/g,
    // Remove "Show all X ... " if it's on a line by itself.
    /^\s*Show all \d+ (?:skills|experiences|posts|comments|reactions|details|licenses & certifications|projects)\s*$/gim,
    /^\s*Load more comments?\s*$/gim
  ];

  uiPatternsToRemove.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '\n'); // Replace with newline to avoid merging unrelated lines, then re-normalize
  });

  // Fix hashtag formatting (already in activityParser, but good to have here too)
  cleaned = cleaned.replace(/\nhashtag\n#([a-zA-Z0-9_]+)/g, ' #$1');
  cleaned = cleaned.replace(/hashtag\s*\n#([a-zA-Z0-9_]+)/g, ' #$1');
  cleaned = cleaned.replace(/hashtag\s+#([a-zA-Z0-9_]+)/g, ' #$1');


  // Final newline normalization and trim
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  return cleaned;
}

/**
 * Validates if a string looks like a person's name.
 * @param {string} name - String to validate
 * @returns {boolean} - True if it looks like a name
 */
export function isValidPersonName(name) {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();

  if (trimmed.length < 2 || trimmed.length > 100) return false;
  // Allows letters, spaces, apostrophes, hyphens, periods (for initials or suffixes like Jr.)
  if (!/^[A-Za-z\s.'-]+$/.test(trimmed)) return false;
  // Should not be just common UI text or generic terms
  if (/^(?:follow|like|comment|repost|send|more|view|show all|see all|premium|verified|author|member|manager|director|ceo|founder|analyst|engineer|specialist|consultant|llc|inc|corp|company|technologies|solutions|group|ventures|labs|studios|university|college|school|institute|academy)$/i.test(trimmed) && trimmed.split(/\s+/).length <=2) return false;
  if (/^\d+$|^[\W_]+$/.test(trimmed)) return false; // Not just numbers or only special characters
  if (trimmed.includes('{:') || trimmed.toLowerCase().includes('account')) return false;
  if (trimmed.toLowerCase().startsWith('http')) return false; // Not a URL

  // Check for at least one capitalized word if multi-word, or the single word is capitalized
  const words = trimmed.split(/\s+/);
  if (words.length > 1) {
      if (!words.some(w => w.length > 0 && w[0] === w[0].toUpperCase())) return false;
  } else if (words.length === 1) {
      if (trimmed[0] !== trimmed[0].toUpperCase()) return false;
  }

  return true;
}

/**
 * Validates if a string looks like a company name.
 * @param {string} company - String to validate
 * @returns {boolean} - True if it looks like a company name
 */
export function isValidCompanyName(company) {
  if (!company || typeof company !== 'string') return false;
  const trimmed = company.trim();

  if (trimmed.length < 2 || trimmed.length > 150) return false;
  // Avoid common job types or UI text if they are the ENTIRE company name
  if (/^(?:full-time|part-time|contract|freelance|internship|show all|see all|self-employed|remote|hybrid)$/i.test(trimmed)) return false;
  if (/^[\d\W_]+$/.test(trimmed) && !trimmed.match(/[a-zA-Z]/)) return false; // Not just numbers/special chars without letters
  if (trimmed.toLowerCase().startsWith('http')) return false;

  return true;
}

/**
 * Parses LinkedIn date ranges into start and end dates.
 * Example: "Jan 2020 - Present" or "2019 - 2021"
 * @param {string} dateRangeStr - Date range string
 * @returns {Object} - Object with start and end dates (as strings) or original string if not parsable.
 */
export function parseDateRange(dateRangeStr) {
  if (!dateRangeStr || typeof dateRangeStr !== 'string') return { start: dateRangeStr, end: null };

  const parts = dateRangeStr.split(/\s*[-–]\s*/); // Split by hyphen or en-dash
  if (parts.length === 2) {
    const start = parts[0].trim();
    const end = parts[1].trim();
    return {
      start: start,
      end: end.toLowerCase() === 'present' ? 'Present' : end
    };
  } else if (dateRangeStr.match(/^\d{4}$/) && dateRangeStr.toLowerCase() !== 'present') { // Single year, e.g. "2017"
    return { start: dateRangeStr, end: dateRangeStr };
  }
  // If not a clear range, return the original string as 'start'
  return { start: dateRangeStr.trim(), end: null };
}

/**
 * Extracts person's headline from LinkedIn profile text.
 * This is a general utility; profileParser.js has more contextual headline logic.
 * @param {string} text - Raw profile text
 * @param {string} nameToExclude - Person's name to avoid re-capturing if it's part of headline patterns
 * @returns {string|null} - Extracted headline or null
 */
export function extractHeadlineFromProfile(text, nameToExclude) {
  if (!text || typeof text !== 'string') return null;

  const cleanedNameToExclude = nameToExclude ? cleanProfileName(nameToExclude) : '';

  // Patterns for headline, typically after name/pronouns/connection degree
  const headlinePatterns = [
    // After connection degree (e.g., 1st, 2nd, 3rd)
    /(?:1st|2nd|3rd)\s*(?:degree connection)?\s*\n([^\n]+)/i,
    // After pronouns if present
    /(?:He\/Him|She\/Her|They\/Them)\s*(?:\n[^\n]*)?\n([^\n]+)/i,
    // After a verified badge or similar marker
    /(?:Verified|Premium)\s*•?\s*[^\n]*\n([^\n]+)/i,
    // If name is provided, look for line after name that's not another common element
    cleanedNameToExclude ? new RegExp(`^${cleanedNameToExclude.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\n(?:[^\\n]*\\n){0,1}([^\n]+)`, 'im') : null
  ].filter(Boolean); // Remove null pattern if nameToExclude is not provided

  for (const pattern of headlinePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const headline = match[1].trim();
      // Validate headline: not too short, not another name, not location, not just "Contact info" etc.
      if (headline.length > 5 && headline.length < 300 &&
          headline.toLowerCase() !== cleanedNameToExclude.toLowerCase() &&
          !headline.match(/Contact info|followers|connections|United States|mutual connections/i) &&
          !headline.match(/^\d+[a-z]?\s*degree connection$/i) && // e.g. "2nd degree connection"
          !headline.includes('View full profile') && !headline.includes('See all') &&
          !headline.includes('{:')) {
        return headline;
      }
    }
  }
  return null;
}

/**
 * Cleans profile name from badge markers and common trailing/leading noise.
 * @param {string} name - Raw profile name
 * @returns {string} - Cleaned name
 */
export function cleanProfileName(name) {
  if (!name || typeof name !== 'string') return name;
  return name
    .replace(/\s*{:badgeType}\s*/g, '')    // Remove "{:badgeType}"
    .replace(/\s+account\s*$/i, '')        // Remove " account" at the end
    .replace(/\s+has\s+a\s*/i, '')          // Remove " has a "
    .replace(/^(?:Mr\.? |Ms\.? |Mrs\.? |Dr\.? )/i, '') // Remove common titles from start
    .replace(/\s*(?:,|PhD|MBA|MD|Esq\.?)$/i, '') // Remove common suffixes
    .trim();
}