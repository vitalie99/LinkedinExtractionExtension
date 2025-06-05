// profileParser.js
export function parseProfileInfo(rawText, existingProfileName) {
  const parsedData = {
    name: existingProfileName || null,
    headline: null,
    currentCompany: null,
    location: null,
    followers: null,
    connections: null,
    mutualConnections: [],
    about: null,
    experience: [],
    education: [],
    skills: [],
    recommendations: { received: [], given: [] },
    interests: { topVoices: [], companies: [], groups: [] }
  };

  if (!rawText || typeof rawText !== 'string') {
    return parsedData;
  }

  // Helper function for simple de-duplication
  function simpleDeduplicate(text) {
    if (!text) return null;
    const paragraphs = text.split(/\n\n+/);
    const uniqueParagraphs = [];
    let lastParagraph = null;
    for (const p of paragraphs) {
      const trimmed = p.trim();
      if (trimmed && trimmed !== lastParagraph?.trim()) {
        uniqueParagraphs.push(p);
      }
      lastParagraph = p;
    }
    return uniqueParagraphs.join('\n\n');
  }

  // 1. Name - refine existing name or extract new one from first meaningful line
  if (!existingProfileName || existingProfileName === "Unknown Profile") {
    const lines = rawText.split('\n');
    for (const line of lines.slice(0, 5)) {
      const trimmed = line.trim();
      if (trimmed.length > 2 && trimmed.length < 80 && 
          !/linkedin|feed|posts|comments|reactions|contact info|followers|connections/i.test(trimmed) &&
          /[A-Za-z]/.test(trimmed)) {
        parsedData.name = trimmed;
        break;
      }
    }
  }

  // 2. Headline - typically appears after name and connection info
  const headlineRegex = /(?:2nd|3rd|1st)?\s*\n([^\n]+)\n(?:[^\n]*\n)*?(?:Contact info|followers|connections|New York|Location)/;
  const headlineMatch = rawText.match(headlineRegex);
  if (headlineMatch && headlineMatch[1]) {
    const headline = headlineMatch[1].trim();
    if (headline.length < 200 && !/^\d|contact info|followers|connections/i.test(headline)) {
      parsedData.headline = headline;
    }
  }

  // 3. Location - extract from contact info area
  const locationRegex = /([A-Za-z\s,.-]+)\s+Contact info/;
  const locationMatch = rawText.match(locationRegex);
  if (locationMatch && locationMatch[1]) {
    parsedData.location = locationMatch[1].trim();
  }

  // 4. Followers
  const followersRegex = /([\d,.]+)\s*followers/i;
  const followersMatch = rawText.match(followersRegex);
  if (followersMatch && followersMatch[1]) {
    parsedData.followers = followersMatch[1].replace(/,/g, '');
  }

  // 5. Connections
  const connectionsRegex = /([\d,]+\+?)\s*connections/i;
  const connectionsMatch = rawText.match(connectionsRegex);
  if (connectionsMatch && connectionsMatch[1]) {
    parsedData.connections = connectionsMatch[1];
  }

  // 6. Mutual Connections - extract names from mutual connections line
  const mutualRegex = /([^,\n]+,\s*[^,\n]+),?\s*and\s*(\d+)\s*other\s*mutual\s*connections/;
  const mutualMatch = rawText.match(mutualRegex);
  if (mutualMatch) {
    const names = mutualMatch[1].split(',').map(name => name.trim());
    parsedData.mutualConnections = names;
  }

  // 7. About section
  const aboutRegex = /About\s*\n\s*About\s*\n([\s\S]*?)(?=\n(?:Top skills|Services|Featured|Experience|Activity|Education|$))/;
  const aboutMatch = rawText.match(aboutRegex);
  if (aboutMatch && aboutMatch[1]) {
    let aboutText = aboutMatch[1].trim();
    // Remove duplicate content that appears twice
    const lines = aboutText.split('\n');
    const midpoint = Math.floor(lines.length / 2);
    const firstHalf = lines.slice(0, midpoint).join('\n');
    const secondHalf = lines.slice(midpoint).join('\n');
    if (firstHalf.trim() === secondHalf.trim()) {
      aboutText = firstHalf;
    }
    parsedData.about = simpleDeduplicate(aboutText);
  }

  // 8. Experience section
  const experienceRegex = /Experience\s*\n\s*Experience\s*\n([\s\S]*?)(?=\n(?:Education|Licenses|Volunteer|Skills|$))/;
  const experienceMatch = rawText.match(experienceRegex);
  if (experienceMatch && experienceMatch[1]) {
    const experienceText = experienceMatch[1];
    
    // Split by job entries - look for pattern of Title\nCompany\nDuration
    const jobBlocks = experienceText.split(/\n(?=[A-Z][^\n]*\n[A-Z][^\n]*(?:\s·\s(?:Full-time|Part-time|Contract|Freelance))?)/);
    
    for (const block of jobBlocks) {
      if (block.trim().length < 30) continue;
      
      const lines = block.split('\n').filter(line => line.trim());
      if (lines.length < 2) continue;
      
      const expItem = {
        title: null,
        company: null,
        duration: null,
        totalDuration: null,
        location: null,
        description: null
      };

      // Extract title (first line)
      expItem.title = lines[0].trim();

      // Extract company (second line, remove employment type)
      if (lines[1]) {
        expItem.company = lines[1].replace(/\s·\s(?:Full-time|Part-time|Contract|Freelance|Internship).*/, '').trim();
      }

      // Extract duration - look for date patterns
      const durationRegex = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s*(?:[-–]\s*(?:Present|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}))?/;
      const durationMatch = block.match(durationRegex);
      if (durationMatch) {
        expItem.duration = durationMatch[0];
      }

      // Extract total duration - look for "· X yrs Y mos" pattern
      const totalDurationRegex = /·\s*((?:\d+\s*(?:yrs?|mos?|years?|months?)[\s,]*)+)/;
      const totalDurationMatch = block.match(totalDurationRegex);
      if (totalDurationMatch) {
        expItem.totalDuration = totalDurationMatch[1].trim();
      }

      // Extract location - look for city, country pattern
      const locationRegex = /([A-Za-z\s,.-]+(?:,\s*[A-Za-z\s,.-]+)?)\s*·\s*(?:On-site|Remote|Hybrid)/;
      const locationMatch = block.match(locationRegex);
      if (locationMatch) {
        expItem.location = locationMatch[1].trim();
      }

      // Extract description - everything after the main metadata
      const descLines = lines.slice(3);
      if (descLines.length > 0) {
        let description = descLines.join('\n').trim();
        // Remove duplicate content if present
        const sentences = description.split(/\.\s+/);
        if (sentences.length > 4) {
          const midpoint = Math.floor(sentences.length / 2);
          const firstHalf = sentences.slice(0, midpoint).join('. ');
          const secondHalf = sentences.slice(midpoint).join('. ');
          if (firstHalf.trim() === secondHalf.trim()) {
            description = firstHalf;
          }
        }
        expItem.description = description.length > 20 ? description : null;
      }

      if (expItem.title && expItem.company) {
        parsedData.experience.push(expItem);
      }
    }
  }

  // 9. Education section
  const educationRegex = /Education\s*\n\s*Education\s*\n([\s\S]*?)(?=\n(?:Licenses|Volunteer|Skills|$))/;
  const educationMatch = rawText.match(educationRegex);
  if (educationMatch && educationMatch[1]) {
    const educationText = educationMatch[1];
    const eduBlocks = educationText.split(/\n(?=[A-Z][^\n]*(?:University|College|School|Institute|Academy|Wagon|Tribe))/);
    
    for (const block of eduBlocks) {
      if (block.trim().length < 10) continue;
      
      const eduItem = {
        school: null,
        degree: null,
        fieldOfStudy: null,
        years: null
      };

      const lines = block.split('\n').filter(line => line.trim());
      if (lines.length > 0) {
        eduItem.school = lines[0].trim();
        
        // Look for degree information
        const degreeRegex = /((?:Bachelor|Master|PhD|BA|BS|MA|MS|MBA|BSc|MSc|Computer Programming|Growth)[^,\n]*)/i;
        const degreeMatch = block.match(degreeRegex);
        if (degreeMatch) {
          eduItem.degree = degreeMatch[1].trim();
        }

        // Extract years
        const yearRegex = /(\d{4})\s*[-–]\s*(?:(\d{4})|Present|Apr\s+\d{4})/;
        const yearMatch = block.match(yearRegex);
        if (yearMatch) {
          eduItem.years = yearMatch[2] ? `${yearMatch[1]} - ${yearMatch[2]}` : yearMatch[1];
        }
      }

      if (eduItem.school) {
        parsedData.education.push(eduItem);
      }
    }
  }

  // 10. Skills section
  const skillsRegex = /Skills\s*\n\s*Skills\s*\n([\s\S]*?)(?=\n(?:Recommendations|Interests|Languages|$))/;
  const skillsMatch = rawText.match(skillsRegex);
  if (skillsMatch && skillsMatch[1]) {
    const skillsText = skillsMatch[1];
    const skillLines = skillsText.split('\n').filter(line => line.trim());
    
    for (const line of skillLines) {
      // Look for endorsement count
      const endorsementRegex = /(\d+)\s*endorsements?/i;
      const endorsementMatch = line.match(endorsementRegex);
      
      if (endorsementMatch) {
        const skillName = line.replace(endorsementRegex, '').trim();
        if (skillName.length > 0 && skillName.length < 100) {
          parsedData.skills.push({
            name: skillName,
            endorsementsCount: parseInt(endorsementMatch[1]),
            endorsedBySummary: [] // Complex to extract reliably
          });
        }
      } else if (line.length > 2 && line.length < 80 && 
                 !/^[0-9\s]+$/.test(line) && 
                 !/endorsements?|skills|top skills/i.test(line)) {
        parsedData.skills.push({
          name: line.trim(),
          endorsementsCount: null,
          endorsedBySummary: []
        });
      }
    }
  }

  // 11. Recommendations - basic structure extraction
  const recRegex = /Recommendations\s*\n\s*Recommendations\s*\n([\s\S]*?)(?=\n(?:Languages|Interests|$))/;
  const recMatch = rawText.match(recRegex);
  if (recMatch && recMatch[1]) {
    const recText = recMatch[1];
    
    // Look for received recommendations pattern
    const receivedBlocks = recText.split(/\n(?=[A-Z][^\n]*\n·)/);
    
    for (const block of receivedBlocks) {
      if (block.trim().length < 50) continue;
      
      const lines = block.split('\n');
      if (lines.length < 3) continue;
      
      const recItem = {
        recommenderName: null,
        recommenderTitle: null,
        date: null,
        text: null
      };

      // Extract recommender name (first line)
      if (lines[0] && lines[0].trim().length > 0) {
        recItem.recommenderName = lines[0].trim();
      }

      // Extract title (line with "·")
      const titleLine = lines.find(line => line.includes('·') && !line.includes('managed') && !line.includes('worked'));
      if (titleLine) {
        recItem.recommenderTitle = titleLine.replace(/·.*/, '').trim();
      }

      // Extract date
      const dateRegex = /((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d+,\s+\d{4})/;
      const dateMatch = block.match(dateRegex);
      if (dateMatch) {
        recItem.date = dateMatch[1];
      }

      // Extract recommendation text (everything after the metadata)
      const textLines = lines.slice(3);
      if (textLines.length > 0) {
        recItem.text = simpleDeduplicate(textLines.join('\n').trim());
      }

      if (recItem.recommenderName && recItem.text) {
        parsedData.recommendations.received.push(recItem);
      }
    }
  }

  // 12. Interests section - basic extraction
  const interestsRegex = /Interests\s*\n\s*Interests\s*\n([\s\S]*)$/;
  const interestsMatch = rawText.match(interestsRegex);
  if (interestsMatch && interestsMatch[1]) {
    const interestsText = interestsMatch[1];
    
    // Look for Top Voices section
    const topVoicesRegex = /Top Voices\s*\n\s*Top Voices\s*\n([\s\S]*?)(?=\n(?:Companies|Groups|Newsletters|Schools|$))/;
    const topVoicesMatch = interestsText.match(topVoicesRegex);
    if (topVoicesMatch && topVoicesMatch[1]) {
      const voicesText = topVoicesMatch[1];
      const voiceBlocks = voicesText.split(/\n(?=[A-Z][^\n]*\n·)/);
      
      for (const block of voiceBlocks) {
        if (block.trim().length < 20) continue;
        
        const lines = block.split('\n');
        if (lines.length >= 2) {
          const voiceItem = {
            name: lines[0].trim(),
            headline: lines[1].replace(/·.*/, '').trim(),
            followers: null
          };
          
          const followersMatch = block.match(/([\d,]+)\s*followers/);
          if (followersMatch) {
            voiceItem.followers = followersMatch[1];
          }
          
          if (voiceItem.name && voiceItem.headline) {
            parsedData.interests.topVoices.push(voiceItem);
          }
        }
      }
    }
  }

  // Set current company from most recent experience
  if (parsedData.experience.length > 0) {
    const mostRecent = parsedData.experience[0];
    if (mostRecent.duration && (mostRecent.duration.includes('Present') || mostRecent.duration.includes('present'))) {
      parsedData.currentCompany = mostRecent.company;
    }
  }

  return parsedData;
}

// activityParser.js
export function parsePosts(rawText, profileName) {
  const postsAndRepostsByProfilePerson = [];
  
  if (!rawText || typeof rawText !== 'string' || !profileName) {
    return { postsAndRepostsByProfilePerson };
  }

  // Split by "Feed post number" markers
  const postBlocks = rawText.split(/Feed post number \d+/);
  
  for (const block of postBlocks) {
    if (block.trim().length < 100) continue;
    
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
    const isRepost = block.includes(`${profileName} reposted this`);
    activityItem.activityType = isRepost ? "repost" : "original_post";

    // Extract timestamp - look for patterns like "8h •", "3d •", etc.
    const timestampRegex = /(\d+[hdw]|[\d\s]*(?:hours?|days?|weeks?)\s*ago)\s*•/;
    const timestampMatch = block.match(timestampRegex);
    if (timestampMatch) {
      activityItem.timestampOfActivity = timestampMatch[1].trim();
    }

    // Extract engagement numbers
    const likesRegex = /(\d+)\s*(?=\n[^\n]*(?:comments?|reposts?))/;
    const likesMatch = block.match(likesRegex);
    if (likesMatch) {
      activityItem.engagementOnActivity.likes = parseInt(likesMatch[1]);
    }

    const commentsRegex = /(\d+)\s*comments?/;
    const commentsMatch = block.match(commentsRegex);
    if (commentsMatch) {
      activityItem.engagementOnActivity.commentsCount = parseInt(commentsMatch[1]);
    }

    const repostsRegex = /(\d+)\s*reposts?/;
    const repostsMatch = block.match(repostsRegex);
    if (repostsMatch) {
      activityItem.engagementOnActivity.repostsCount = parseInt(repostsMatch[1]);
    }

    // Extract main content
    const contentRegex = /Follow\n([\s\S]*?)(?=\n…more|\nActivate to view|\n\d+\n)/;
    const contentMatch = block.match(contentRegex);
    if (contentMatch) {
      activityItem.authoredContentByProfilePerson = contentMatch[1].trim();
    }

    // Extract hashtags from authored content
    if (activityItem.authoredContentByProfilePerson) {
      const hashtagRegex = /#(\w+)/g;
      let hashtagMatch;
      while ((hashtagMatch = hashtagRegex.exec(activityItem.authoredContentByProfilePerson)) !== null) {
        activityItem.hashtagsByProfilePerson.push(hashtagMatch[1]);
      }
    }

    // Extract mentions from authored content
    if (activityItem.authoredContentByProfilePerson) {
      const mentionRegex = /@([A-Za-z\s]+)/g;
      let mentionMatch;
      while ((mentionMatch = mentionRegex.exec(activityItem.authoredContentByProfilePerson)) !== null) {
        activityItem.mentionsByProfilePerson.push({
          name: mentionMatch[1].trim(),
          link: null
        });
      }
    }

    // Check for media attachments
    if (block.includes('Activate to view larger image')) {
      activityItem.mediaAttached.push({
        type: "image",
        description: "Activate to view larger image"
      });
    }
    if (block.includes('Play')) {
      activityItem.mediaAttached.push({
        type: "video",
        description: "Play video"
      });
    }

    // Handle repost-specific data
    if (isRepost) {
      activityItem.originalPostIfReposted = {
        originalAuthorName: null,
        originalAuthorHeadline: null,
        originalPostTimestamp: null,
        originalPostContent: null,
        originalPostEngagement: { likes: null, commentsCount: null, repostsCount: null }
      };
      
      // For reposts, the authored content by profile person would be their commentary
      // The original post content is the main content
      activityItem.authoredContentByProfilePerson = null; // Most reposts don't have additional commentary
      
      if (contentMatch) {
        activityItem.originalPostIfReposted.originalPostContent = contentMatch[1].trim();
      }
      
      // The engagement numbers we extracted are actually for the original post
      activityItem.originalPostIfReposted.originalPostEngagement = { ...activityItem.engagementOnActivity };
      activityItem.engagementOnActivity = { likes: null, commentsCount: null, repostsCount: null };
    }

    // Generate unique activity ID
    const contentSnippet = (activityItem.authoredContentByProfilePerson || 
                           activityItem.originalPostIfReposted?.originalPostContent || 
                           'post').substring(0, 20).replace(/\s+/g, '_');
    activityItem.activityId = `${profileName.replace(/\s+/g, '_')}_${contentSnippet}_${activityItem.timestampOfActivity || 'unknown'}`;

    if (activityItem.activityType && (activityItem.authoredContentByProfilePerson || activityItem.originalPostIfReposted)) {
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

  // Split by "Feed post number" markers
  const commentBlocks = rawText.split(/Feed post number \d+/);
  
  for (const block of commentBlocks) {
    if (block.trim().length < 50) continue;
    
    // Check if this block contains a comment/reply by the profile person
    const commentPattern = new RegExp(`${profileName}\\s+(?:replied to|commented on)`, 'i');
    if (!commentPattern.test(block)) continue;
    
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

    // Determine if it's a reply or direct comment
    const isReply = block.includes(`${profileName} replied to`);
    
    if (isReply) {
      // Extract who they replied to
      const replyToRegex = new RegExp(`${profileName}\\s+replied to\\s+([^']+)'s comment`, 'i');
      const replyToMatch = block.match(replyToRegex);
      if (replyToMatch) {
        commentItem.isReplyTo = {
          author: replyToMatch[1].trim(),
          commentSnippet: null // Complex to extract reliably
        };
      }
    }

    // Extract the comment text - look for the author block with their comment
    const authorBlockRegex = new RegExp(`${profileName}[\\s\\S]*?Author[\\s\\S]*?\\n([\\s\\S]*?)(?=\\nLike\\n|\\nReply|$)`, 'i');
    const authorBlockMatch = block.match(authorBlockRegex);
    if (authorBlockMatch) {
      commentItem.commentText = authorBlockMatch[1].trim();
    }

    // Extract comment timestamp
    const timestampRegex = /(\d+[hdw]|[\d\s]*(?:hours?|days?|weeks?)\s*ago)/;
    const timestampMatch = block.match(timestampRegex);
    if (timestampMatch) {
      commentItem.commentTimestamp = timestampMatch[1].trim();
    }

    // Extract original post author and content
    const lines = block.split('\n');
    let postAuthorFound = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Look for author pattern (name followed by connection degree)
      if (line.length > 0 && line.length < 80 && 
          /^[A-Z][^\n]*$/.test(line) && 
          !line.includes(profileName) &&
          i + 1 < lines.length && 
          /•\s*(1st|2nd|3rd)/.test(lines[i + 1])) {
        commentItem.onOriginalPost.author = line;
        
        // Get headline from next few lines
        if (i + 2 < lines.length) {
          const headline = lines[i + 2].trim();
          if (headline.length > 0 && headline.length < 200) {
            commentItem.onOriginalPost.authorHeadline = headline;
          }
        }
        postAuthorFound = true;
        break;
      }
    }

    // Extract original post content snippet
    const contentRegex = /Follow\n([\s\S]*?)(?=\n…more|\nActivate to view|\n\d+\n)/;
    const contentMatch = block.match(contentRegex);
    if (contentMatch) {
      const fullContent = contentMatch[1].trim();
      // Take first ~30 words as snippet
      const words = fullContent.split(/\s+/);
      commentItem.onOriginalPost.contentSnippet = words.slice(0, 30).join(' ');
      if (words.length > 30) {
        commentItem.onOriginalPost.contentSnippet += '...';
      }
    }

    // Extract original post timestamp
    const postTimestampMatch = block.match(/(\d+[hdw])\s*•/);
    if (postTimestampMatch) {
      commentItem.onOriginalPost.timestamp = postTimestampMatch[1];
    }

    // Generate comment ID
    const commentSnippet = (commentItem.commentText || 'comment').substring(0, 20).replace(/\s+/g, '_');
    commentItem.commentId = `${profileName.replace(/\s+/g, '_')}_comment_${commentSnippet}_${commentItem.commentTimestamp || 'unknown'}`;

    if (commentItem.commentText && commentItem.onOriginalPost.author) {
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

  // Split by "Feed post number" markers
  const reactionBlocks = rawText.split(/Feed post number \d+/);
  
  for (const block of reactionBlocks) {
    if (block.trim().length < 50) continue;
    
    // Check if this block contains a reaction by the profile person
    const reactionPattern = new RegExp(`${profileName}\\s+(liked|celebrated|loved|supported|insightful)`, 'i');
    const reactionMatch = block.match(reactionPattern);
    if (!reactionMatch) continue;
    
    const reactionItem = {
      reactionId: null,
      reactionType: null,
      reactedTo: {
        type: null,
        author: null,
        authorHeadline: null,
        contentSnippet: null
      },
      originalPostContext: null
    };

    // Extract reaction type
    reactionItem.reactionType = reactionMatch[1].toLowerCase();

    // Determine if reaction was to a post or comment
    const isCommentReaction = block.includes("'s comment on");
    reactionItem.reactedTo.type = isCommentReaction ? "comment" : "post";

    if (isCommentReaction) {
      // Extract comment author
      const commentAuthorRegex = new RegExp(`${profileName}\\s+${reactionMatch[1]}\\s+([^']+)'s comment`, 'i');
      const commentAuthorMatch = block.match(commentAuthorRegex);
      if (commentAuthorMatch) {
        reactionItem.reactedTo.author = commentAuthorMatch[1].trim();
      }

      // Extract original post context
      const postContextRegex = /comment on ([^']+)'s post/i;
      const postContextMatch = block.match(postContextRegex);
      if (postContextMatch) {
        reactionItem.originalPostContext = {
          author: postContextMatch[1].trim(),
          contentSnippet: null // Will be extracted from main content
        };
      }
    } else {
      // Direct post reaction - extract post author
      const lines = block.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Look for author pattern after the reaction line
        if (line.length > 0 && line.length < 80 && 
            /^[A-Z][^\n]*$/.test(line) && 
            !line.includes(profileName) &&
            i + 1 < lines.length && 
            /•\s*(1st|2nd|3rd)/.test(lines[i + 1])) {
          reactionItem.reactedTo.author = line;
          
          // Get headline
          if (i + 2 < lines.length) {
            const headline = lines[i + 2].trim();
            if (headline.length > 0 && headline.length < 200) {
              reactionItem.reactedTo.authorHeadline = headline;
            }
          }
          break;
        }
      }
    }

    // Extract content snippet
    const contentRegex = /Follow\n([\s\S]*?)(?=\n…more|\nActivate to view|\n\d+\n)/;
    const contentMatch = block.match(contentRegex);
    if (contentMatch) {
      const fullContent = contentMatch[1].trim();
      const words = fullContent.split(/\s+/);
      const snippet = words.slice(0, 25).join(' ');
      reactionItem.reactedTo.contentSnippet = words.length > 25 ? snippet + '...' : snippet;
      
      // If it's a comment reaction, also set the original post context snippet
      if (isCommentReaction && reactionItem.originalPostContext) {
        reactionItem.originalPostContext.contentSnippet = reactionItem.reactedTo.contentSnippet;
      }
    }

    // Generate reaction ID
    const authorSnippet = (reactionItem.reactedTo.author || 'unknown').substring(0, 10).replace(/\s+/g, '_');
    const contentSnippet = (reactionItem.reactedTo.contentSnippet || 'content').substring(0, 15).replace(/\s+/g, '_');
    reactionItem.reactionId = `${profileName.replace(/\s+/g, '_')}_${reactionItem.reactionType}_${authorSnippet}_${contentSnippet}`;

    if (reactionItem.reactionType && reactionItem.reactedTo.author) {
      reactionsMadeByProfilePerson.push(reactionItem);
    }
  }
  
  return { reactionsMadeByProfilePerson };
}

// Helper utility functions that can be used across parsers
export function extractMentions(text) {
  if (!text) return [];
  const mentions = [];
  const mentionRegex = /@([A-Za-z\s]+(?:[A-Za-z\s]*[A-Za-z])?)/g;
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push({
      name: match[1].trim(),
      link: null
    });
  }
  return mentions;
}

export function extractHashtags(text) {
  if (!text) return [];
  const hashtags = [];
  const hashtagRegex = /#(\w+)/g;
  let match;
  while ((match = hashtagRegex.exec(text)) !== null) {
    hashtags.push(match[1]);
  }
  return hashtags;
}

export function generateUniqueId(prefix, content, timestamp) {
  const contentSnippet = (content || 'item').substring(0, 20).replace(/[^\w]/g, '_');
  const timeSnippet = (timestamp || Date.now().toString()).replace(/[^\w]/g, '_');
  return `${prefix}_${contentSnippet}_${timeSnippet}`;
}

export function extractTimestamp(text) {
  const timestampRegex = /(\d+(?:[hdw]|hours?|days?|weeks?|months?|years?)\s*(?:ago)?)\s*•/i;
  const match = text.match(timestampRegex);
  return match ? match[1].trim() : null;
}

export function extractEngagementNumbers(text) {
  const engagement = {
    likes: null,
    commentsCount: null,
    repostsCount: null
  };

  const likesRegex = /(\d+)\s*(?=\n[^\n]*(?:comments?|reposts?))/;
  const likesMatch = text.match(likesRegex);
  if (likesMatch) {
    engagement.likes = parseInt(likesMatch[1]);
  }

  const commentsRegex = /(\d+)\s*comments?/;
  const commentsMatch = text.match(commentsRegex);
  if (commentsMatch) {
    engagement.commentsCount = parseInt(commentsMatch[1]);
  }

  const repostsRegex = /(\d+)\s*reposts?/;
  const repostsMatch = text.match(repostsRegex);
  if (repostsMatch) {
    engagement.repostsCount = parseInt(repostsMatch[1]);
  }

  return engagement;
}

export function detectMediaAttachments(text) {
  const media = [];
  
  if (text.includes('Activate to view larger image')) {
    media.push({
      type: "image",
      description: "Activate to view larger image"
    });
  }
  
  if (text.includes('Play video')) {
    media.push({
      type: "video",
      description: "Play video"
    });
  }
  
  if (text.includes('View document')) {
    media.push({
      type: "document",
      description: "View document"
    });
  }
  
  if (text.includes('Play\n')) {
    media.push({
      type: "video_link",
      description: "Play"
    });
  }
  
  return media;
}

// Content cleaning and deduplication utilities
export function cleanDuplicateContent(text) {
  if (!text) return null;
  
  // Split into paragraphs
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
  
  // Check for duplicate halves (common in LinkedIn extractions)
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

export function extractContentSnippet(text, maxWords = 30) {
  if (!text) return null;
  
  const words = text.split(/\s+/);
  const snippet = words.slice(0, maxWords).join(' ');
  return words.length > maxWords ? snippet + '...' : snippet;
}