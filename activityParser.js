// activityParser.js - Fixed with correct parsing logic

export function parsePosts(rawText, profileName) {
  const postsAndRepostsByProfilePerson = [];
  
  if (!rawText || typeof rawText !== 'string') {
    return { postsAndRepostsByProfilePerson };
  }

  // Split by "Feed post number" markers - this is THE pattern that defines activities
  const postBlocks = rawText.split(/Feed post number \d+/);
  
  console.log(`parsePosts: Found ${postBlocks.length - 1} posts based on Feed post number pattern`);
  
  // Skip the first block as it's before the first "Feed post number"
  for (let i = 1; i < postBlocks.length; i++) {
    const block = postBlocks[i];
    if (!block || block.trim().length < 10) continue; // Skip empty blocks
    
    // This IS a valid post - we found it using the Feed post number pattern
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

    const lines = block.split('\n').map(l => l.trim()).filter(l => l);
    
    // Determine if it's a repost by checking for "reposted this" anywhere in the block
    const isRepost = block.includes('reposted this');
    activityItem.activityType = isRepost ? "repost" : "original_post";

    // Extract post author information - look for the duplicate name pattern
    let postAuthor = null;
    let postAuthorTitle = null;
    
    for (let i = 0; i < Math.min(20, lines.length); i++) {
      if (lines[i].match(/^View.*graphic link$/)) continue;
      
      // Check for duplicate name pattern (common in LinkedIn extracts)
      if (i + 1 < lines.length && 
          lines[i] === lines[i + 1] && 
          lines[i].length > 2 &&
          /^[A-Z]/.test(lines[i]) &&
          !lines[i].includes('•') &&
          !lines[i].match(/^\d+$/)) {
        postAuthor = lines[i];
        // Look for title in next few lines
        for (let j = i + 2; j < Math.min(i + 5, lines.length); j++) {
          if (lines[j] && !lines[j].match(/^View|^Follow|^\d+$/) && lines[j].length > 5) {
            postAuthorTitle = lines[j];
            break;
          }
        }
        break;
      }
    }

    // Extract timestamp
    const timestampPatterns = [
      /(\d+h)\s*•\s*\d+\s*hours?\s*ago/,
      /(\d+d)\s*•\s*\d+\s*days?\s*ago/,
      /(\d+w)\s*•\s*\d+\s*weeks?\s*ago/,
      /(\d+[hdw])\s*•/,
      /(\d+\s*(?:hours?|days?|weeks?)\s*ago)/
    ];
    
    for (const pattern of timestampPatterns) {
      const match = block.match(pattern);
      if (match) {
        activityItem.timestampOfActivity = match[1].trim();
        break;
      }
    }

    // Extract main content - look for content after "Visible to anyone on or off LinkedIn"
    let contentText = null;
    const contentStartIndex = block.indexOf('Visible to anyone on or off LinkedIn');
    if (contentStartIndex > -1) {
      const afterVisibility = block.substring(contentStartIndex + 37).trim();
      const contentEndMatch = afterVisibility.match(/\n(?:…more|Activate to view|like[a-z]*\s*\n\d+)/);
      
      if (contentEndMatch) {
        contentText = afterVisibility.substring(0, contentEndMatch.index).trim();
      } else {
        // Take content until we hit engagement section
        const lines = afterVisibility.split('\n');
        const contentLines = [];
        for (const line of lines) {
          if (line.match(/^(?:like[a-z]*|\d+|Like|Comment|Repost|Send)$/)) break;
          if (line.trim()) contentLines.push(line.trim());
        }
        contentText = contentLines.join(' ');
      }
    }

    // Clean up hashtag formatting if present
    if (contentText) {
      contentText = contentText.replace(/\s*hashtag\s*#/g, ' #');
      contentText = contentText.replace(/hashtag\s+/g, '#');
    }

    // Assign content based on post type
    if (isRepost) {
      activityItem.originalPostIfReposted = {
        originalAuthorName: postAuthor,
        originalAuthorHeadline: postAuthorTitle,
        originalPostTimestamp: activityItem.timestampOfActivity,
        originalPostContent: contentText,
        originalPostEngagement: { likes: null, commentsCount: null, repostsCount: null }
      };
    } else {
      activityItem.authoredContentByProfilePerson = contentText;
    }

    // Extract engagement numbers
    const engagementSection = block.substring(block.lastIndexOf('…more') > -1 ? block.lastIndexOf('…more') : 0);
    
    // Look for likes pattern
    const likesPatterns = [
      /like[a-z]*\s*\n(\d+)\s*\n/i,
      /(\d+)\s*\n[^0-9]+and\s+(\d+)\s+others/,
      /^(\d+)$/m
    ];
    
    for (const pattern of likesPatterns) {
      const match = engagementSection.match(pattern);
      if (match) {
        let likes = parseInt(match[1]);
        if (match[2]) { // "X and Y others" pattern
          likes = 1 + parseInt(match[2]);
        }
        if (likes >= 0) {
          if (isRepost) {
            activityItem.originalPostIfReposted.originalPostEngagement.likes = likes;
          } else {
            activityItem.engagementOnActivity.likes = likes;
          }
          break;
        }
      }
    }

    // Extract comments count
    const commentsMatch = engagementSection.match(/(\d+)\s*comments?/i);
    if (commentsMatch) {
      const comments = parseInt(commentsMatch[1]);
      if (isRepost) {
        activityItem.originalPostIfReposted.originalPostEngagement.commentsCount = comments;
      } else {
        activityItem.engagementOnActivity.commentsCount = comments;
      }
    }

    // Extract reposts count  
    const repostsMatch = engagementSection.match(/(\d+)\s*reposts?/i);
    if (repostsMatch) {
      const reposts = parseInt(repostsMatch[1]);
      if (isRepost) {
        activityItem.originalPostIfReposted.originalPostEngagement.repostsCount = reposts;
      } else {
        activityItem.engagementOnActivity.repostsCount = reposts;
      }
    }

    // Extract hashtags and mentions from content
    const textToAnalyze = activityItem.authoredContentByProfilePerson || 
                         activityItem.originalPostIfReposted?.originalPostContent || '';
    
    if (textToAnalyze) {
      // Extract hashtags
      const hashtagRegex = /#(\w+)/g;
      let hashtagMatch;
      const seenHashtags = new Set();
      while ((hashtagMatch = hashtagRegex.exec(textToAnalyze)) !== null) {
        if (!seenHashtags.has(hashtagMatch[1])) {
          activityItem.hashtagsByProfilePerson.push(hashtagMatch[1]);
          seenHashtags.add(hashtagMatch[1]);
        }
      }

      // Extract mentions
      const mentionRegex = /@([A-Za-z\s]+?)(?=\s|$|[,.])/g;
      let mentionMatch;
      const seenMentions = new Set();
      while ((mentionMatch = mentionRegex.exec(textToAnalyze)) !== null) {
        const name = mentionMatch[1].trim();
        if (!seenMentions.has(name)) {
          activityItem.mentionsByProfilePerson.push({
            name: name,
            link: null
          });
          seenMentions.add(name);
        }
      }
    }

    // Check for media attachments
    if (block.includes('Activate to view larger image')) {
      activityItem.mediaAttached.push({
        type: "image",
        description: "Activate to view larger image"
      });
    }
    if (block.includes('Play\n') || block.includes('Play video')) {
      activityItem.mediaAttached.push({
        type: "video", 
        description: "Play video"
      });
    }

    // Generate activity ID
    const authorName = postAuthor || profileName || 'unknown';
    const contentSnippet = (contentText || 'post').substring(0, 20).replace(/[^\w]/g, '_');
    const timestamp = activityItem.timestampOfActivity || `post${i}`;
    activityItem.activityId = `${authorName.replace(/[^\w]/g, '_')}_${contentSnippet}_${timestamp}`;

    // Always add the activity - we found it via Feed post number pattern
    postsAndRepostsByProfilePerson.push(activityItem);
  }
  
  console.log(`parsePosts: Successfully parsed ${postsAndRepostsByProfilePerson.length} posts`);
  return { postsAndRepostsByProfilePerson };
}

export function parseComments(rawText, profileName) {
  const commentsMadeByProfilePerson = [];
  
  if (!rawText || typeof rawText !== 'string') {
    return { commentsMadeByProfilePerson };
  }

  // Split by "Feed post number" markers - this is THE pattern that defines activities
  const commentBlocks = rawText.split(/Feed post number \d+/);
  
  console.log(`parseComments: Found ${commentBlocks.length - 1} comment activities based on Feed post number pattern`);
  
  // Skip the first block as it's before the first "Feed post number"
  for (let i = 1; i < commentBlocks.length; i++) {
    const block = commentBlocks[i];
    if (!block || block.trim().length < 10) continue;
    
    // This IS a valid comment activity - we found it using the Feed post number pattern
    const commentItem = {
      commentId: null,
      commentText: null,
      commentTimestamp: null,
      likesOnComment: null,
      onOriginalPost: {
        author: null,
        authorHeadline: null,
        timestamp: null,
        contentSnippet: null
      },
      isReplyTo: null
    };

    const lines = block.split('\n').map(l => l.trim()).filter(l => l);

    // Extract original post author (the duplicate name pattern)
    for (let i = 0; i < Math.min(20, lines.length); i++) {
      if (lines[i].match(/^View.*graphic link$/)) continue;
      
      if (i + 1 < lines.length && 
          lines[i] === lines[i + 1] && 
          lines[i].length > 2 &&
          /^[A-Z]/.test(lines[i]) &&
          !lines[i].includes('•')) {
        commentItem.onOriginalPost.author = lines[i];
        // Look for title
        for (let j = i + 2; j < Math.min(i + 5, lines.length); j++) {
          if (lines[j] && !lines[j].match(/^View|^Follow|^\d+$/) && lines[j].length > 5) {
            commentItem.onOriginalPost.authorHeadline = lines[j];
            break;
          }
        }
        break;
      }
    }

    // Extract original post timestamp
    const timestampMatch = block.match(/(\d+[hdw])\s*•/);
    if (timestampMatch) {
      commentItem.onOriginalPost.timestamp = timestampMatch[1];
    }

    // Extract original post content snippet
    const contentStartIndex = block.indexOf('Visible to anyone on or off LinkedIn');
    if (contentStartIndex > -1) {
      const afterVisibility = block.substring(contentStartIndex + 37).trim();
      const endMatch = afterVisibility.match(/\n(?:…more|commented on this|Like|Comment)/);
      
      let contentText = '';
      if (endMatch) {
        contentText = afterVisibility.substring(0, endMatch.index).trim();
      } else {
        const lines = afterVisibility.split('\n').slice(0, 5);
        contentText = lines.join(' ').trim();
      }
      
      if (contentText) {
        const words = contentText.split(/\s+/);
        commentItem.onOriginalPost.contentSnippet = words.slice(0, 30).join(' ');
        if (words.length > 30) {
          commentItem.onOriginalPost.contentSnippet += '...';
        }
      }
    }

    // Extract the comment text
    // Look for "Author" designation which indicates the commenter
    const authorMatch = block.match(/([^\n]+)\s*\n\s*(?:•\s*)?Author/);
    if (authorMatch) {
      // Comment text usually follows the Author line
      const authorIndex = block.indexOf('Author');
      if (authorIndex > -1) {
        const afterAuthor = block.substring(authorIndex + 6).trim();
        const commentEndMatch = afterAuthor.match(/\n(?:Like|Reply|\d+)(?:\s|$)/);
        
        if (commentEndMatch) {
          commentItem.commentText = afterAuthor.substring(0, commentEndMatch.index).trim();
        } else {
          const lines = afterAuthor.split('\n');
          const commentLines = [];
          for (const line of lines) {
            if (line.match(/^(?:Like|Reply|Load more|\d+)$/)) break;
            if (line.trim()) commentLines.push(line.trim());
          }
          commentItem.commentText = commentLines.join(' ');
        }
      }
    }

    // Extract comment timestamp
    const commentTimestampMatch = block.match(/(\d+[hdw])\b/);
    if (commentTimestampMatch) {
      commentItem.commentTimestamp = commentTimestampMatch[1];
    }

    // Generate comment ID
    const commentSnippet = (commentItem.commentText || 'comment').substring(0, 20).replace(/[^\w]/g, '_');
    const author = commentItem.onOriginalPost.author || 'unknown';
    const timestamp = commentItem.commentTimestamp || `comment${i}`;
    commentItem.commentId = `comment_${author.replace(/[^\w]/g, '_')}_${commentSnippet}_${timestamp}`;

    // Always add the comment - we found it via Feed post number pattern
    commentsMadeByProfilePerson.push(commentItem);
  }
  
  console.log(`parseComments: Successfully parsed ${commentsMadeByProfilePerson.length} comments`);
  return { commentsMadeByProfilePerson };
}

export function parseReactions(rawText, profileName) {
  const reactionsMadeByProfilePerson = [];
  
  if (!rawText || typeof rawText !== 'string') {
    return { reactionsMadeByProfilePerson };
  }

  // Split by "Feed post number" markers - this is THE pattern that defines activities
  const reactionBlocks = rawText.split(/Feed post number \d+/);
  
  console.log(`parseReactions: Found ${reactionBlocks.length - 1} reaction activities based on Feed post number pattern`);
  
  // Skip the first block as it's before the first "Feed post number"
  for (let i = 1; i < reactionBlocks.length; i++) {
    const block = reactionBlocks[i];
    if (!block || block.trim().length < 10) continue;
    
    // This IS a valid reaction activity - we found it using the Feed post number pattern
    const reactionItem = {
      reactionId: null,
      reactionType: 'liked', // Default to liked, will check for other types
      reactedTo: {
        type: 'post', // Default to post, will check if comment
        author: null,
        authorHeadline: null,
        contentSnippet: null
      },
      originalPostContext: null
    };

    const lines = block.split('\n').map(l => l.trim()).filter(l => l);
    
    // Check reaction type from the block content
    if (block.includes('loves this') || block.includes('loved')) {
      reactionItem.reactionType = 'loved';
    } else if (block.includes('celebrated')) {
      reactionItem.reactionType = 'celebrated';
    } else if (block.includes('supported')) {
      reactionItem.reactionType = 'supported';
    } else if (block.includes('insightful')) {
      reactionItem.reactionType = 'insightful';
    }
    
    // Check if it's a comment reaction
    const commentReactionMatch = block.match(/liked\s+([^']+)'s\s+comment/i);
    if (commentReactionMatch) {
      reactionItem.reactedTo.type = 'comment';
      reactionItem.reactedTo.author = commentReactionMatch[1].trim();
      
      // Look for original post context
      const postContextMatch = block.match(/comment on ([^']+)'s post/i);
      if (postContextMatch) {
        reactionItem.originalPostContext = {
          author: postContextMatch[1].trim(),
          contentSnippet: null
        };
      }
    }
    
    // For post reactions, extract post author
    if (reactionItem.reactedTo.type === 'post') {
      // Look for author pattern (duplicate name)
      for (let i = 0; i < Math.min(20, lines.length); i++) {
        if (lines[i].match(/^View.*graphic link$/)) continue;
        
        if (i + 1 < lines.length && 
            lines[i] === lines[i + 1] && 
            lines[i].length > 2 &&
            /^[A-Z]/.test(lines[i]) &&
            !lines[i].includes('•')) {
          reactionItem.reactedTo.author = lines[i];
          // Look for title
          for (let j = i + 2; j < Math.min(i + 5, lines.length); j++) {
            if (lines[j] && !lines[j].match(/^View|^Follow|^\d+$/) && lines[j].length > 5) {
              reactionItem.reactedTo.authorHeadline = lines[j];
              break;
            }
          }
          break;
        }
      }
    }

    // Extract content snippet
    const contentStartIndex = block.indexOf('Visible to anyone on or off LinkedIn');
    if (contentStartIndex > -1) {
      const afterVisibility = block.substring(contentStartIndex + 37).trim();
      const endMatch = afterVisibility.match(/\n(?:…more|like[a-z]*\s*\n|Like|Comment)/);
      
      let contentText = '';
      if (endMatch) {
        contentText = afterVisibility.substring(0, endMatch.index).trim();
      } else {
        const lines = afterVisibility.split('\n').slice(0, 5);
        contentText = lines.join(' ').trim();
      }
      
      if (contentText) {
        const words = contentText.split(/\s+/);
        const snippet = words.slice(0, 25).join(' ');
        reactionItem.reactedTo.contentSnippet = words.length > 25 ? snippet + '...' : snippet;
        
        if (reactionItem.originalPostContext) {
          reactionItem.originalPostContext.contentSnippet = reactionItem.reactedTo.contentSnippet;
        }
      }
    }

    // Generate reaction ID
    const authorSnippet = (reactionItem.reactedTo.author || 'unknown').substring(0, 10).replace(/[^\w]/g, '_');
    const contentSnippet = (reactionItem.reactedTo.contentSnippet || 'content').substring(0, 15).replace(/[^\w]/g, '_');
    reactionItem.reactionId = `reaction_${reactionItem.reactionType}_${authorSnippet}_${contentSnippet}_${i}`;

    // Always add the reaction - we found it via Feed post number pattern
    reactionsMadeByProfilePerson.push(reactionItem);
  }
  
  console.log(`parseReactions: Successfully parsed ${reactionsMadeByProfilePerson.length} reactions`);
  return { reactionsMadeByProfilePerson };
}

// Helper utility functions
export function cleanDuplicateContent(text) {
  if (!text) return null;
  
  const paragraphs = text.split(/\n\n+/);
  const uniqueParagraphs = [];
  let lastParagraph = null;
  
  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (trimmed && trimmed !== lastParagraph?.trim()) {
      uniqueParagraphs.push(paragraph);
    }
    lastParagraph = paragraph;
  }
  
  const result = uniqueParagraphs.join('\n\n');
  const lines = result.split('\n');
  const midpoint = Math.floor(lines.length / 2);
  
  if (lines.length > 6) {
    const firstHalf = lines.slice(0, midpoint).join('\n').trim();
    const secondHalf = lines.slice(midpoint).join('\n').trim();
    
    if (firstHalf === secondHalf && firstHalf.length > 100) {
      return firstHalf;
    }
  }
  
  return result;
}

export function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;

  const words1 = new Set(str1.toLowerCase().match(/\b(\w+)\b/g) || []);
  const words2 = new Set(str2.toLowerCase().match(/\b(\w+)\b/g) || []);

  if (words1.size === 0 && words2.size === 0) return 1;
  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return union.size === 0 ? 0 : intersection.size / union.size;
}

export function extractHeadlineFromProfile(text, nameToExclude) {
  if (!text) return null;
  
  const lines = text.split('\n');
  const cleanName = nameToExclude ? nameToExclude.trim().toLowerCase() : '';
  
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i].trim();
    const nextLine = lines[i + 1] ? lines[i + 1].trim() : '';
    
    if (line.toLowerCase() !== cleanName && 
        line.length > 10 && 
        line.length < 200 &&
        !line.includes('•') &&
        !line.match(/^\d+$/) &&
        (nextLine.includes('•') || nextLine.match(/Contact info|followers|connections/i))) {
      return line;
    }
  }
  
  return null;
}

export function cleanProfileName(name) {
  if (!name || typeof name !== 'string') return name || "Unknown Profile";
  return name
    .replace(/\s*{:badgeType}\s*/g, '')
    .replace(/\s+account\s*$/i, '')
    .replace(/\s+has\s+a\s*/i, '')
    .replace(/^(?:Mr\.? |Ms\.? |Mrs\.? |Dr\.? )/i, '')
    .replace(/\s*(?:,|PhD|MBA|MD|Esq\.?)$/i, '')
    .trim();
}