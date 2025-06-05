// activityParser.js - Robust Implementation with All Fixes (Analyzed from samples)

export function parsePosts(rawText, profileName) {
  const postsAndRepostsByProfilePerson = [];

  if (!rawText || typeof rawText !== 'string' || !profileName) {
    return { postsAndRepostsByProfilePerson };
  }

  // Clean profile name from badge markers
  const cleanProfileName = profileName.replace(/\s*{:badgeType}\s*/, '').replace(/\s+account\s*$/, '').trim();

  // Split by "Feed post number" markers
  const postBlocks = rawText.split(/Feed post number \d+/);

  for (const block of postBlocks) {
    if (block.trim().length < 50) continue;

    const activityItem = {
      activityId: null,
      activityType: null,
      timestampOfActivity: null,
      authoredContentByProfilePerson: null,
      engagementOnActivity: { likes: null, commentsCount: null, repostsCount: null },
      originalPostIfReposted: null,
      mentionsByProfilePerson: [],
      hashtagsByProfilePerson: [],
      mediaAttached: []
    };

    // Determine if it's a repost or original post
    const isRepost = block.includes(cleanProfileName + ' reposted this') ||
                     block.match(new RegExp(cleanProfileName + '\\s+reposted', 'i'));
    activityItem.activityType = isRepost ? "repost" : "original_post";

    // Extract timestamp
    const timestampPatterns = [
      /(\d+[hdwms]\b(?: ago)?)\s*•/, // Added 'ms' and optional 'ago'
      /(\d+\s*(?:minute|hour|day|week|month|year)s?\s*ago)\s*•/,
      /(\d+[hdwms]\b)/,
      /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4})/,
    ];

    let firstTimestampLine = block.split('\n').find(line => timestampPatterns.some(p => p.test(line)));
    if (firstTimestampLine) {
        for (const pattern of timestampPatterns) {
          const match = firstTimestampLine.match(pattern);
          if (match && match[1]) {
            activityItem.timestampOfActivity = match[1].trim();
            break;
          }
        }
    }


    // Extract main content - IMPROVED
    let contentText = null;
    const followSplit = block.split(/Follow\s*\n/);
    const contentSourceBlock = followSplit.length > 1 ? followSplit[1] : block;

    // Define end markers for content more carefully
    const contentEndMarkers = [
      /\n…more\n/, // LinkedIn's own "see more"
      // Pattern for start of engagement stats (likes, comments, reposts)
      // Ensure it's on a new line and looks like a stats block
      /\n\s*\d+(?:[\d,.]*k?M?B?)?\s*(?:likes?|reactions?|[\w\s,]+and\s+\d+\s+others)/i, // Likes/Reactions count
      /\n\s*\d+(?:[\d,.]*k?M?B?)?\s*comments?/i, // Comments count
      /\n\s*\d+(?:[\d,.]*k?M?B?)?\s*reposts?/i,  // Reposts count
      /\nLike\s+Comment\s+Repost\s+Send\s*$/, // Action buttons at the end of a post block
      /\nActivate to view larger image/, // Media prompts
      /\nPlay video/,
      /\nView document/,
      // FIX: Do NOT use hashtag pattern for TRUNCATION
      // /\nhashtag\n#/ // This was causing premature truncation

      // Attempt to stop before another person's post begins if this is a share not marked as "reposted"
      // This looks for a new name, a typical separator (like '• 2nd'), and then a timestamp or 'Follow'
      /\n([A-Z][a-z'-]+ [A-Z][a-z'-]+(?: [A-Z][a-z'-]+)?)\s*\n\s*•\s*(?:1st|2nd|3rd|Influencer|Premium)/,
      /\n([A-Z][a-z'-]+ [A-Z][a-z'-]+(?: [A-Z][a-z'-]+)?)\s*\n(?:[^\n]*\n){0,2}?(?:\d+[hdwms]\b|Follow)/
    ];

    let content = contentSourceBlock;
    let endIndex = content.length;

    for (const marker of contentEndMarkers) {
      const markerMatch = content.match(marker);
      if (markerMatch && markerMatch.index < endIndex) {
        endIndex = markerMatch.index;
      }
    }
    content = content.substring(0, endIndex).trim();

    // Clean up common UI text that might still be attached
    content = content.replace(/Visible to anyone on or off LinkedIn\s*$/i, '').trim();
    content = content.replace(/Edited\s*•\s*Visible to anyone on or off LinkedIn\s*$/i, '').trim();
    content = content.replace(/\s*\d+ (days?|weeks?|months?|years?) ago\s*•\s*Edited\s*•\s*$/i, '').trim();
    content = content.replace(/\s*\d+ (days?|weeks?|months?|years?) ago\s*•\s*$/i, '').trim();


    // Remove profile person's own name/title if it's at the start of the content block
    // (often happens if 'Follow' split was not effective or it's not a typical post structure)
    const selfMentionPattern = new RegExp(`^${cleanProfileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\n(?:[^\\n]*\\n){0,3}`, 'i');
    content = content.replace(selfMentionPattern, '').trim();


    // Clean up hashtag formatting AFTER content extraction
    content = content.replace(/\nhashtag\n#/g, ' #'); // Handles "hashtag\n#tag"
    content = content.replace(/hashtag\s*\n#(\w+)/g, '#$1'); // Handles "hashtag \n#tag"
    content = content.replace(/hashtag\s+#(\w+)/g, '#$1');   // Handles "hashtag #tag"

    if (content.length > 5 || (isRepost && content.length >=0) ) { // Allow empty commentary for reposts
      contentText = content;
    }


    // Extract engagement numbers
    // Search for engagement numbers in the part of the block AFTER the extracted content
    // or in the whole block if content extraction was minimal.
    const engagementSearchText = block.substring(block.indexOf(content) + content.length) || block;

    const likesPatterns = [
        /(\d[\d,.]*k?M?B?)\s*(?:likes?|reactions?)/i,
        /([\d,.]*k?M?B?)\s+[\w\s,]+and\s+\d+\s+others/i, // e.g., "Alex Biale and 26 others"
        // Regex to find a number that is likely likes, often followed by comments/reposts counts
        /(\d[\d,.]*k?M?B?)\s*\n(?:[\s\S]*?\n)?\s*(?:\d+.*comment|\d+.*repost)/i,
        // Simpler: number on a line by itself before comment/repost keywords
        /^(\d[\d,.]*k?M?B?)$(?=\s*\n(?:[\s\S]*?\n)?(?:\d+.*comment|\d+.*repost|Like\s+Comment))/mi
    ];
    for (const pattern of likesPatterns) {
        const match = engagementSearchText.match(pattern);
        if (match && match[1]) {
            const numStr = match[1].toLowerCase().replace(/,/g, '');
            let num = parseFloat(numStr);
            if (numStr.includes('k')) num *= 1000;
            if (numStr.includes('m')) num *= 1000000;
            if (numStr.includes('b')) num *= 1000000000;
            if (num > 0 && num < 2000000000) { // Reasonable limits
                activityItem.engagementOnActivity.likes = Math.round(num);
                break;
            }
        }
    }
    // Fallback for "X and Y others" if likes not found above
    if (activityItem.engagementOnActivity.likes === null) {
        const andOthersMatch = engagementSearchText.match(/([\w\s,]+)\s+and\s+(\d+)\s+others/i);
        if (andOthersMatch) {
            const namesCount = (andOthersMatch[1].match(/,/g) || []).length + 1;
            activityItem.engagementOnActivity.likes = namesCount + parseInt(andOthersMatch[2]);
        }
    }


    const commentsRegex = /(\d[\d,.]*k?M?B?)\s*comments?/i;
    const commentsMatch = engagementSearchText.match(commentsRegex);
    if (commentsMatch && commentsMatch[1]) {
        const numStr = commentsMatch[1].toLowerCase().replace(/,/g, '');
        let num = parseFloat(numStr);
        if (numStr.includes('k')) num *= 1000;
        if (numStr.includes('m')) num *= 1000000;
        if (numStr.includes('b')) num *= 1000000000;
        activityItem.engagementOnActivity.commentsCount = Math.round(num);
    }

    const repostsRegex = /(\d[\d,.]*k?M?B?)\s*reposts?/i;
    const repostsMatch = engagementSearchText.match(repostsRegex);
    if (repostsMatch && repostsMatch[1]) {
        const numStr = repostsMatch[1].toLowerCase().replace(/,/g, '');
        let num = parseFloat(numStr);
        if (numStr.includes('k')) num *= 1000;
        if (numStr.includes('m')) num *= 1000000;
        if (numStr.includes('b')) num *= 1000000000;
        activityItem.engagementOnActivity.repostsCount = Math.round(num);
    }


    if (isRepost) {
      activityItem.originalPostIfReposted = {
        originalAuthorName: null,
        originalAuthorHeadline: null,
        originalPostTimestamp: null,
        originalPostContent: contentText, // If it's a repost, the main content extracted is the original's
        originalPostEngagement: { ...activityItem.engagementOnActivity } // Assume engagement is for original
      };
      activityItem.authoredContentByProfilePerson = null; // Will be filled if there's commentary from profile person
      activityItem.engagementOnActivity = { likes: null, commentsCount: null, repostsCount: null }; // Reset for the repost action itself

      // Try to find commentary by the profile person for the repost
      const repostCommentaryPattern = new RegExp(`^${cleanProfileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(?:reposted this)?\\s*\\n(?:[^\\n]*\\n){0,2}?([\\s\\S]*?)(?=\\n[A-Z][a-z'-]+ [A-Z][a-z'-]+|\\nActivate to view|$)`, 'i');
      const commentaryMatch = block.match(repostCommentaryPattern);
      if (commentaryMatch && commentaryMatch[1] && commentaryMatch[1].trim() !== activityItem.originalPostIfReposted.originalPostContent) {
          let commentary = commentaryMatch[1].trim();
          // Clean out parts of the original post if they were accidentally included
          if(activityItem.originalPostIfReposted.originalPostContent && commentary.endsWith(activityItem.originalPostIfReposted.originalPostContent)){
              commentary = commentary.substring(0, commentary.length - activityItem.originalPostIfReposted.originalPostContent.length).trim();
          }
          if(commentary.length > 0) activityItem.authoredContentByProfilePerson = commentary;
      }


      const linesInBlock = block.split('\n').filter(line => line.trim());
      let originalAuthorFound = false;
      for (let i = 0; i < linesInBlock.length; i++) {
        const line = linesInBlock[i];
        if ((line.includes(cleanProfileName) && line.toLowerCase().includes('reposted')) || originalAuthorFound) {
          // Look for original author name in subsequent lines
          for (let j = originalAuthorFound ? i : i + 1; j < Math.min(i + 10, linesInBlock.length); j++) {
            const nextLine = linesInBlock[j].trim();
            if (nextLine.length > 3 && nextLine.length < 80 &&
                /^[A-Z]/.test(nextLine) && // Starts with a capital letter
                !nextLine.match(/Premium|Verified|•|degree connection|Follow|Comment|Repost|Like|Send/i) &&
                !nextLine.includes(cleanProfileName) &&
                nextLine !== activityItem.authoredContentByProfilePerson // Not the repost commentary itself
                ) {
              activityItem.originalPostIfReposted.originalAuthorName = nextLine;
              originalAuthorFound = true; // Mark as found
              // Look for headline in next lines
              if (j + 1 < linesInBlock.length) {
                const headlineLine = linesInBlock[j + 1].trim();
                if (headlineLine && headlineLine.length > 3 && !headlineLine.match(/•|\d+[hdwms]\b|Follow|Premium|Verified|degree|Comment|Like|Send/i) &&
                    !timestampPatterns.some(p => p.test(headlineLine))) {
                  activityItem.originalPostIfReposted.originalAuthorHeadline = headlineLine;
                  // Look for original post timestamp on the line after headline or author
                  if (j + 2 < linesInBlock.length) {
                      const tsLine = linesInBlock[j+2].trim();
                      for (const pattern of timestampPatterns) {
                          const tsMatch = tsLine.match(pattern);
                          if (tsMatch && tsMatch[1]) {
                            activityItem.originalPostIfReposted.originalPostTimestamp = tsMatch[1].trim();
                            break;
                          }
                      }
                  }
                } else { // If headlineLine IS a timestamp
                     for (const pattern of timestampPatterns) {
                          const tsMatch = headlineLine.match(pattern);
                          if (tsMatch && tsMatch[1]) {
                            activityItem.originalPostIfReposted.originalPostTimestamp = tsMatch[1].trim();
                            break;
                          }
                      }
                }
              }
              break; // Found author, break from inner loop
            }
          }
          if (activityItem.originalPostIfReposted.originalAuthorName) break; // Break from outer loop if author found
        }
      }
    } else { // Original post
      activityItem.authoredContentByProfilePerson = contentText;
    }

    // Extract hashtags and mentions from the correct content (profile person's authored content)
    const textToAnalyzeForTags = activityItem.authoredContentByProfilePerson || (isRepost ? "" : contentText) || '';
    if (textToAnalyzeForTags) {
      const hashtagRegex = /#(\w+)/g;
      let hashtagMatch;
      const foundHashtags = new Set();
      while ((hashtagMatch = hashtagRegex.exec(textToAnalyzeForTags)) !== null) {
        foundHashtags.add(hashtagMatch[1]);
      }
      activityItem.hashtagsByProfilePerson = Array.from(foundHashtags);

      // Mentions (simple @ format, as per prompt)
      const mentionRegex = /@([A-Za-z0-9\s.'-]+)/g; // Slightly more permissive for names
      let mentionMatch;
      const foundMentions = new Set();
      while ((mentionMatch = mentionRegex.exec(textToAnalyzeForTags)) !== null) {
        const mention = mentionMatch[1].trim();
        if (mention.length > 1 && mention.length < 100) { // Basic validation
          foundMentions.add(mention);
        }
      }
      activityItem.mentionsByProfilePerson = Array.from(foundMentions).map(name => ({
        name: name,
        link: null
      }));
    }

    // Media attachments
    if (block.includes('Activate to view larger image')) activityItem.mediaAttached.push({ type: "image", description: "Activate to view larger image" });
    if (block.includes('Play video') || block.match(/Play\s*\n/)) activityItem.mediaAttached.push({ type: "video", description: "Play video" });
    if (block.includes('View document')) activityItem.mediaAttached.push({ type: "document", description: "View document" });
    if (block.includes('Web Link') || block.match(/Web Link\s*\n/)) activityItem.mediaAttached.push({ type: "web_link", description: "Web Link" });


    // Generate unique activity ID
    const idContentSnippet = (activityItem.authoredContentByProfilePerson || activityItem.originalPostIfReposted?.originalPostContent || 'post').substring(0, 20).replace(/[^\w]/g, '_');
    const idTimestamp = (activityItem.timestampOfActivity || 'unknown').replace(/[^\w]/g, '_');
    activityItem.activityId = `${cleanProfileName.replace(/[^\w]/g, '_')}_${idContentSnippet}_${idTimestamp}`;

    // Only add if we have meaningful content or it's a repost with original content
    if (activityItem.activityType &&
        (activityItem.authoredContentByProfilePerson || (isRepost && activityItem.originalPostIfReposted?.originalPostContent))) {
      postsAndRepostsByProfilePerson.push(activityItem);
    }
  }
  return { postsAndRepostsByProfilePerson };
}


export function parseComments(rawText, profileName) {
  const commentsMadeByProfilePerson = [];
  if (!rawText || typeof rawText !== 'string' || !profileName) {
    return { commentsMadeByProfilePerson };
  }

  const cleanProfileName = profileName.replace(/\s*{:badgeType}\s*/, '').replace(/\s+account\s*$/, '').trim();
  const commentBlocks = rawText.split(/Feed post number \d+/);

  for (const block of commentBlocks) {
    if (block.trim().length < 50) continue;

    const hasCommentedOn = block.includes(cleanProfileName + ' commented on this') ||
                           block.includes(cleanProfileName + ' replied to');
    if (!hasCommentedOn) continue;

    const commentItem = {
      commentId: null, commentText: null, commentTimestamp: null, likesOnComment: null,
      onOriginalPost: { author: null, authorHeadline: null, timestamp: null, contentSnippet: null },
      isReplyTo: null
    };

    const lines = block.split('\n');
    let profileNameLineIndex = -1;
    // Find the start of the profile person's comment section (their name, not the "commented on" line)
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith(cleanProfileName) &&
            !lines[i].includes('commented on this') && !lines[i].includes('replied to')) {
            profileNameLineIndex = i;
            break;
        }
    }

    if (profileNameLineIndex === -1) continue; // Couldn't find where the profile person's comment starts

    // Extract actual comment text - CRITICAL FIX
    let commentTextFound = false;
    let extractedCommentText = '';
    for (let j = profileNameLineIndex + 1; j < lines.length; j++) {
        const potentialCommentLine = lines[j].trim();
        if (!potentialCommentLine) continue; // Skip empty lines

        // Skip known metadata: own headline, timestamp, "Like", "Reply", "Edited", "X comments/replies"
        const isTimestamp = /^\d+[hdwms]\b(?: ago)?$/i.test(potentialCommentLine) || /^\d+\s*(?:minute|hour|day|week|month|year)s?\s*ago$/i.test(potentialCommentLine);
        const isOwnHeadline = potentialCommentLine.toLowerCase().includes(profileName.split(' ')[0].toLowerCase()) && (potentialCommentLine.includes(' at ') || potentialCommentLine.includes('|') || potentialCommentLine.length > 20); // Heuristic for headline
        const isUiElement = /^(?:Like|Reply|Edited|Load more comments?|Photo|Video|\d+ replies?|\d+ comments?)$/i.test(potentialCommentLine) || potentialCommentLine.match(/^\d+$/); // Just a number (likes)
        const isAuthorTag = potentialCommentLine.toLowerCase() === 'author';
        const isDegreeConnection = potentialCommentLine.match(/•\s*(1st|2nd|3rd)/i);


        if (isTimestamp || isOwnHeadline || isUiElement || isAuthorTag || isDegreeConnection || potentialCommentLine === cleanProfileName) {
            // If this line is metadata AND we haven't found any comment text yet, continue skipping
            if (!commentTextFound) continue;
            // If it's metadata and we HAVE found text, it means the comment ended.
            else break;
        }

        // This line looks like part of the comment
        extractedCommentText += (commentTextFound ? '\n' : '') + potentialCommentLine;
        commentTextFound = true;

        // If next line is clearly UI (Like/Reply), comment probably ended here
        const nextLinePreview = (j + 1 < lines.length) ? lines[j + 1].trim() : "";
        if (nextLinePreview.match(/^(?:Like|Reply)$/i) || (nextLinePreview.match(/^\d+$/) && (j+2 < lines.length && lines[j+2].trim().match(/^(?:Like|Reply)$/i)))) {
            break;
        }
    }
    if (extractedCommentText.trim()) {
      commentItem.commentText = extractedCommentText.trim();
    } else {
        continue; // No valid comment text found for this block
    }


    // Extract comment timestamp (often found near the profile name or comment text)
    // Look around profileNameLineIndex and where comment text was found
    for (let k = Math.max(0, profileNameLineIndex -1) ; k < Math.min(lines.length, profileNameLineIndex + 5) ; k++){
        const lineToScanTime = lines[k].trim();
        const timePatterns = [/(\d+[hdwms]\b(?: ago)?)/i, /(\d+\s*(?:minute|hour|day|week|month|year)s?\s*ago)/i];
        for(const p of timePatterns){
            const timeMatch = lineToScanTime.match(p);
            if(timeMatch && timeMatch[1]){
                commentItem.commentTimestamp = timeMatch[1];
                break;
            }
        }
        if(commentItem.commentTimestamp) break;
    }


    // Extract likes on comment
    const commentTextEndIndex = block.toLowerCase().indexOf(commentItem.commentText.toLowerCase()) + commentItem.commentText.length;
    if (commentTextEndIndex > -1 && commentItem.commentText) {
      const afterCommentText = block.substring(commentTextEndIndex);
      const likesMatch = afterCommentText.match(/^\s*(\d+)\s*\n\s*(?:Like|Reply)/m);
      if (likesMatch && likesMatch[1]) {
        commentItem.likesOnComment = parseInt(likesMatch[1]);
      }
    }

    // Extract original post author and metadata
    // Look for author block usually at the beginning of the comment block
    for (let k = 0; k < Math.min(profileNameLineIndex, lines.length -1); k++) {
        const line = lines[k].trim();
        // Heuristic: Name often followed by '• 1st/2nd/3rd' or a professional title line
        if (line.length > 3 && line.length < 80 && /^[A-Z]/.test(line) && !line.includes(cleanProfileName) && !line.includes(' commented on this') && !line.includes(' replied to')) {
            const nextLine = (k + 1 < lines.length) ? lines[k+1].trim() : "";
            const nextNextLine = (k + 2 < lines.length) ? lines[k+2].trim() : "";

            if (nextLine.match(/•\s*(?:1st|2nd|3rd|Verified|Premium|Influencer)/i) || // Common pattern
                (nextLine.length > 5 && !nextLine.match(/\d+[hdwms]/i) && !nextLine.includes("Follow"))) { // Possible headline
                commentItem.onOriginalPost.author = line;
                if (!nextLine.match(/•\s*(?:1st|2nd|3rd|Verified|Premium|Influencer)/i) && nextLine.length > 5 && !nextLine.match(/\d+[hdwms]/i) && !nextLine.includes("Follow")) {
                    commentItem.onOriginalPost.authorHeadline = nextLine;
                } else if (nextNextLine && !nextNextLine.match(/•|\d+[hdwms]/i) && !nextNextLine.includes("Follow") && nextNextLine.length > 5) {
                    commentItem.onOriginalPost.authorHeadline = nextNextLine;
                }
                // Extract original post timestamp (often near author)
                const searchLinesForTimestamp = [nextLine, nextNextLine, (k + 3 < lines.length) ? lines[k+3].trim() : ""];
                for (const tsLine of searchLinesForTimestamp) {
                    if(!tsLine) continue;
                    const tsMatch = tsLine.match(/(\d+[hdwms]\b(?: ago)?)\s*•?/i);
                    if (tsMatch && tsMatch[1]) {
                        commentItem.onOriginalPost.timestamp = tsMatch[1];
                        break;
                    }
                }
                break; // Found original author
            }
        }
    }


    // Extract original post content snippet
    // Look for a substantial block of text after the original author details but before profile person's comment block
    let originalPostContentStart = -1;
    let originalPostContentEnd = profileNameLineIndex; // Content should be before our commenter's section

    if (commentItem.onOriginalPost.author) {
        const authorIndex = lines.findIndex(l => l.trim() === commentItem.onOriginalPost.author);
        if (authorIndex !== -1) {
            let tempStartIndex = authorIndex + 1;
            // Skip headline and timestamp lines
            if (commentItem.onOriginalPost.authorHeadline && lines[tempStartIndex] && lines[tempStartIndex].trim() === commentItem.onOriginalPost.authorHeadline) tempStartIndex++;
            if (commentItem.onOriginalPost.timestamp && lines[tempStartIndex] && lines[tempStartIndex].trim().includes(commentItem.onOriginalPost.timestamp)) tempStartIndex++;
            // Skip "Follow" button line
            if (lines[tempStartIndex] && lines[tempStartIndex].trim().toLowerCase() === 'follow') tempStartIndex++;
            originalPostContentStart = tempStartIndex;
        }
    }

    if (originalPostContentStart !== -1 && originalPostContentStart < originalPostContentEnd) {
        let snippetText = lines.slice(originalPostContentStart, originalPostContentEnd).join('\n').trim();
        snippetText = snippetText.split(/\n(?:…more|Like\s+Comment\s+Repost|Activate to view)/)[0].trim(); // Stop at common markers
        if (snippetText) {
            const words = snippetText.split(/\s+/);
            commentItem.onOriginalPost.contentSnippet = words.slice(0, 30).join(' ') + (words.length > 30 ? '...' : '');
        }
    }


    // isReplyTo
    const replyToMatch = block.match(new RegExp(`${cleanProfileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+replied to\\s+(?:their own comment on this|([^\\n']+)'s comment)`, 'i'));
    if (replyToMatch) {
        commentItem.isReplyTo = { author: replyToMatch[1] ? replyToMatch[1].trim() : cleanProfileName, commentSnippet: null };
        // Try to find snippet of comment replied to. This is harder.
        // Heuristic: look for text between "replied to X's comment" and profile person's own comment text.
    }


    const commentIdSnippet = (commentItem.commentText || 'comment').substring(0, 20).replace(/[^\w]/g, '_');
    const commentIdTimestamp = (commentItem.commentTimestamp || 'unknown').replace(/[^\w]/g, '_');
    commentItem.commentId = `${cleanProfileName.replace(/[^\w]/g, '_')}_comment_${commentIdSnippet}_${commentIdTimestamp}`;

    if (commentItem.commentText && (commentItem.onOriginalPost.author || commentItem.isReplyTo)) { // Require comment text and some context
      commentsMadeByProfilePerson.push(commentItem);
    }
  }
  return { commentsMadeByProfilePerson };
}


export function parseReactions(rawText, profileName) {
  const reactionsMadeByProfilePerson = [];
  if (!rawText || typeof rawText !== 'string' || !profileName) {
    return { reactionsMadeByProfilePerson };
  }

  const cleanProfileName = profileName.replace(/\s*{:badgeType}\s*/, '').replace(/\s+account\s*$/, '').trim();
  const reactionBlocks = rawText.split(/Feed post number \d+/);

  for (const block of reactionBlocks) {
    if (block.trim().length < 50) continue;

    const escapedName = cleanProfileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Added more reaction types like 'found funny', 'supported'
    const reactionPatterns = [
      new RegExp(escapedName + '\\s+(likes?|loves?|celebrates?|supports?|insightful|found\\s.*?funny)\\s+(?:this|[^\\n]+?\'s (post|comment))', 'i'),
      new RegExp(escapedName + '\\s+(liked|loved|celebrated|supported|found\\s.*?funny)', 'i') // Simpler pattern
    ];

    let reactionMatch = null;
    let reactionType = null;
    let reactedToWhose = null; // To capture "X's post/comment"

    for (const pattern of reactionPatterns) {
      const match = block.match(pattern);
      if (match) {
        reactionMatch = match;
        reactionType = match[1].toLowerCase().replace(/^found\s+.*?\s*/, 'funny'); // Normalize "found ... funny" to "funny"
        if (reactionType.endsWith('s') && reactionType !== 'likes') reactionType = reactionType.slice(0, -1); // supports -> support
        if (match[2] && match[3]) reactedToWhose = match[2].trim(); // "X's" from "[Name]'s post/comment"
        break;
      }
    }

    if (!reactionMatch) continue;

    const reactionItem = {
      reactionId: null,
      reactionType: reactionType || 'reacted', // Default if somehow type is missed
      reactedTo: { type: null, author: null, authorHeadline: null, contentSnippet: null },
      originalPostContext: null
    };

    // Determine if reaction was to a post or comment
    const reactedToCommentPattern = new RegExp(escapedName + `\\s+${reactionType}(?:s)?\\s+([^\\n']+?)'s\\s+comment`, 'i');
    const reactedToCommentMatch = block.match(reactedToCommentPattern);

    if (reactedToCommentMatch) {
        reactionItem.reactedTo.type = "comment";
        reactionItem.reactedTo.author = reactedToCommentMatch[1].trim();
        // Original post context for comment reaction
        const postContextRegex = /comment on this\s*\n([\s\S]*?)(?=\nFeed post number|$)/i; // Try to get the main post block after "comment on this"
        let mainPostBlockText = "";
        const postBlockMatch = block.match(postContextRegex);
        if (postBlockMatch && postBlockMatch[1]) {
            mainPostBlockText = postBlockMatch[1];
        } else { // Fallback: try to find after "comment on [Original Poster]'s post"
            const onPostAuthorMatch = block.match(/on\s+([^']+?)'s\s+post/i);
            if (onPostAuthorMatch) mainPostBlockText = block.substring(block.indexOf(onPostAuthorMatch[0]));
        }

        if (mainPostBlockText) {
            const mainPostAuthorLines = mainPostBlockText.split('\n').map(l => l.trim()).filter(Boolean);
            let postAuthor = null, postAuthorHeadline = null, postContent = [];
            if (mainPostAuthorLines.length > 0) postAuthor = mainPostAuthorLines[0]; // Simplistic: first line of the post block
            if (mainPostAuthorLines.length > 1 && !mainPostAuthorLines[1].match(/•|\d+[hdwms]/i) && !mainPostAuthorLines[1].includes("Follow")) postAuthorHeadline = mainPostAuthorLines[1];

            // Find content snippet of original post
            let contentStartIndex = (postAuthorHeadline ? 2 : 1);
            if (mainPostAuthorLines[contentStartIndex] && mainPostAuthorLines[contentStartIndex].toLowerCase() === 'follow') contentStartIndex++;
            postContent = mainPostAuthorLines.slice(contentStartIndex);

            reactionItem.originalPostContext = {
                author: postAuthor, // This might be the comment author again if parsing is tricky
                contentSnippet: postContent.join(' ').split(/\s+/).slice(0, 25).join(' ') + (postContent.join(' ').split(/\s+/).length > 25 ? '...' : '')
            };
            // Try to get snippet of the comment reacted to
            // This is hard; the block often contains the main post first, then the comment.
            // Heuristic: text immediately before "[ProfilePerson] reacted to X's comment" or after "X's comment"
             const reactedCommentSnippetPattern = new RegExp(`(?:${reactionItem.reactedTo.author.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\n(?:[^\\n]*\\n){0,2})([^\\n]{20,200})(?=\\n\\s*(?:Like|Reply|${escapedName}))`, 'm');
             const reactedCommentSnippetMatch = block.match(reactedCommentSnippetPattern);
             if(reactedCommentSnippetMatch && reactedCommentSnippetMatch[1]){
                 reactionItem.reactedTo.contentSnippet = reactedCommentSnippetMatch[1].trim().split(/\s+/).slice(0,25).join(' ') + "...";
             } else if (postContent.length > 0 && !reactionItem.reactedTo.contentSnippet) { // Fallback if comment snippet not found, use original post's
                 reactionItem.reactedTo.contentSnippet = reactionItem.originalPostContext.contentSnippet;
             }

        }
    } else { // Reaction to a post
      reactionItem.reactedTo.type = "post";
      const linesInBlock = block.split('\n').map(l => l.trim()).filter(Boolean);
      let authorSet = false;
      for (let i = 0; i < linesInBlock.length; i++) {
        const line = linesInBlock[i];
        if (line.includes(escapedName) && line.toLowerCase().includes(reactionType)) continue; // Skip the line saying "X likes this"

        if (!authorSet && line.length > 3 && line.length < 80 && /^[A-Z]/.test(line) &&
            !line.match(/Premium|Follow|Comment|Repost|Like|Send/i) && !line.includes(cleanProfileName)) {
          const nextLine = (i + 1 < linesInBlock.length) ? linesInBlock[i + 1] : "";
          if (nextLine.match(/•\s*(?:1st|2nd|3rd|Verified|Influencer)/i) || (nextLine.length > 5 && !nextLine.match(/\d+[hdwms]/i))) {
            reactionItem.reactedTo.author = line;
            if (!nextLine.match(/•\s*(?:1st|2nd|3rd|Verified|Influencer)/i) && !nextLine.match(/\d+[hdwms]/i)) {
                reactionItem.reactedTo.authorHeadline = nextLine;
            } else if ((i + 2 < linesInBlock.length) && !linesInBlock[i+2].match(/•|\d+[hdwms]/i) && linesInBlock[i+2].length > 5) {
                reactionItem.reactedTo.authorHeadline = linesInBlock[i+2];
            }
            authorSet = true; // Author found
            // Extract content snippet for the post
            let contentStartIndex = i + (reactionItem.reactedTo.authorHeadline ? 3 : 2);
            if (linesInBlock[contentStartIndex] && linesInBlock[contentStartIndex].toLowerCase() === 'follow') contentStartIndex++;
            const postContentLines = linesInBlock.slice(contentStartIndex);
            let postTextContent = postContentLines.join('\n').split(/\n(?:…more|Activate to view|Like\s+Comment)/)[0].trim();
            if (postTextContent) {
                const words = postTextContent.split(/\s+/);
                reactionItem.reactedTo.contentSnippet = words.slice(0, 25).join(' ') + (words.length > 25 ? '...' : '');
            }
            break; // Break after finding author and content
          }
        }
      }
    }

    // Fallback for content snippet if not yet found
    if (!reactionItem.reactedTo.contentSnippet) {
        const followSplit = block.split(/Follow\s*\n/);
        const contentSource = followSplit.length > 1 ? followSplit[1] : block;
        const generalContentMatch = contentSource.match(/^(?:[^\n]+\n){0,5}([^\n]{20,}(?:\n[^\n]{20,})*)/m); // Try to grab first few lines of substantive text
        if (generalContentMatch && generalContentMatch[1]) {
            let snippet = generalContentMatch[1].split(/\n(?:…more|Activate to view|Like\s+Comment)/)[0].trim();
            const words = snippet.split(/\s+/);
            reactionItem.reactedTo.contentSnippet = words.slice(0, 25).join(' ') + (words.length > 25 ? '...' : '');
        }
    }


    const idAuthor = (reactionItem.reactedTo.author || 'unknown').substring(0, 10).replace(/[^\w]/g, '_');
    const idType = reactionItem.reactionType.substring(0, 5);
    const idContent = (reactionItem.reactedTo.contentSnippet || 'content').substring(0, 15).replace(/[^\w]/g, '_');
    reactionItem.reactionId = `${cleanProfileName.replace(/[^\w]/g, '_')}_${idType}_${idAuthor}_${idContent}`;

    if (reactionItem.reactionType && reactionItem.reactedTo.author) { // Require type and author
      reactionsMadeByProfilePerson.push(reactionItem);
    }
  }
  return { reactionsMadeByProfilePerson };
}