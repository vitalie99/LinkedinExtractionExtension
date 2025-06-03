// prompts.js
export const MASTER_INSTRUCTIONS_TEXT = `You are an advanced AI assistant. This file contains data for multiple LinkedIn profiles and a set of prompts. For each profile entry under 'collectedData', you will find its URL, the profile person's name, and raw text from various sections (mainProfileText, postsText, etc.). When I instruct you to process a specific profile and one of its sections (e.g., 'extract profile information for profile X' or 'extract posts for profile Y'), you MUST: 1. Identify the correct profile data in 'collectedData' using the provided URL or name. 2. Select the corresponding prompt from the 'prompts' section below (e.g., use 'prompts.profile' for main profile information, 'prompts.posts' for posts, etc.). 3. If the selected prompt contains '[Profile Person's Name]', substitute it with the 'profileName' found in that profile's data entry. If no 'profileName' is available for a profile, use a generic placeholder like 'the profile person' or ask for clarification. 4. Apply this prompt to the relevant raw text (e.g., 'mainProfileText' for the profile prompt) for that specific profile. 5. Generate ONLY the JSON output as described by that prompt's 'JSON STRUCTURE DESCRIPTION'. Adhere strictly to this structure and output only the valid JSON. Only process the specific profile and section I request.`;

export const PROFILE_PROMPT_TEXT = `You are an expert LinkedIn profile data extractor. Your task is to meticulously parse the provided LinkedIn main profile text and structure all available information into a single JSON object.

IMPORTANT INSTRUCTIONS:
1.  Extract all fields as described in the "PROFILE INFO JSON STRUCTURE DESCRIPTION" section below.
2.  For descriptive text fields like 'about', 'experience descriptions', or 'recommendation text', if you encounter clearly duplicated paragraphs or large blocks of identical text appearing consecutively, include only ONE instance of that unique text.
3.  If information for a specific field is not present in the text, use \`null\` for that field value in the JSON, or an empty array \`[]\` if the field is an array. Do not invent data.
4.  Ensure the entire output is ONLY the single, valid JSON object representing the profile information. Do not include any explanations, notes, or any text before or after the JSON object.

PROFILE INFO JSON STRUCTURE DESCRIPTION:
The root of the JSON output must be an object containing the following keys:

-   "name": A String for the full name of the person.
-   "headline": A String for the professional headline or title.
-   "currentCompany": A String for the current primary company name (infer from recent experience if not explicit).
-   "location": A String for the City, State/Country.
-   "followers": A Number or String for the count of followers (e.g., 5404 or '5.4k').
-   "connections": A String for the number of connections (e.g., "500" or "500+").
-   "mutualConnections": An Array of Strings, where each string is a mutual connection's name.
-   "about": A String containing the complete 'About' section text, ensuring uniqueness if repeated.
-   "experience": An Array of JSON objects. Each object in this array should represent one work experience and contain the following keys:
    -   "title": A String for the job title.
    -   "company": A String for the company name.
    -   "duration": A String for the date range (e.g., 'Jan 2020 - Present').
    -   "totalDuration": A String for the total time displayed (e.g., '4 yrs 5 mos', '10 mos').
    -   "location": A String for the job location, or null if not specified.
    -   "description": A String for the full role description (ensure uniqueness if repeated), or null if not specified.
-   "education": An Array of JSON objects. Each object in this array should represent one education entry and contain the following keys:
    -   "school": A String for the school or university name.
    -   "degree": A String for the degree type (e.g., 'BA HONS', 'Masters', 'Bachelor of Science (BSc)').
    -   "fieldOfStudy": A String for the field of study, or null if not specified.
    -   "years": A String for the years attended (e.g., '2005 - 2008'), or null if not specified.
-   "skills": An Array of JSON objects. Each object in this array should represent one skill and contain the following keys:
    -   "name": A String for the skill name.
    -   "endorsementsCount": A Number for the count of endorsements, if available.
    -   "endorsedBySummary": An Array of Strings describing endorsers (e.g., "Person Name", "X colleagues at Company Y", "Z others who are highly skilled at this").
-   "recommendations": A JSON object with two keys:
    -   "received": An Array of JSON objects. Each object represents a received recommendation and must contain: "recommenderName" (String), "recommenderTitle" (String), "date" (String), "text" (String - ensure uniqueness if repeated).
    -   "given": An Array of JSON objects (populate if information is available). Each object represents a given recommendation and must contain: "recommendedName" (String), "recommendedTitle" (String), "date" (String), "text" (String - ensure uniqueness if repeated).
-   "interests": A JSON object (populate from visible "Interests" section) with keys:
    -   "topVoices": An Array of JSON objects, each with "name" (String), "headline" (String), "followers" (String or Number).
    -   "companies": An Array of JSON objects, each with "name" (String), "industry" (String, if available), "followers" (String or Number, if available).
    -   "groups": An Array of JSON objects, each with "name" (String), "members" (String or Number, if available).
    -   (Consider adding "schools" and "newsletters" if they appear in the interests section of the provided text and you want to capture them).

PROFILE TEXT TO PARSE:
{profile_text_input}`;

export const POSTS_PROMPT_TEXT = `You are an expert LinkedIn activity extractor. Your task is to parse the provided text, which contains posts and reposts by [Profile Person's Name], and structure all available information into a JSON object.

IMPORTANT INSTRUCTIONS:
1.  Identify each distinct activity item in the provided text. For each item, determine if it's an "original_post" authored by [Profile Person's Name] or a "repost" where [Profile Person's Name] shared content from someone else (the text will often indicate "[Profile Person's Name] reposted this").
2.  The entire output must be a single JSON object. This object must contain a single key named "postsAndRepostsByProfilePerson". The value for this key will be an array of activity item objects.
3.  For each activity item object in the array, extract all fields as described in the "ACTIVITY ITEM STRUCTURE" section below.
4.  If information for a specific field is not present in the text, use \`null\` for that field's value, or an empty array \`[]\` if the field is an array. Do not invent data.
5.  Generate a unique \`activityId\` for each item (e.g., by combining the first few words of [Profile Person's Name]'s content or the original author's name for a repost, plus its timestamp).
6.  Return ONLY a single, valid JSON object. No explanations or any text before or after the JSON.

ACTIVITY ITEM STRUCTURE (describes fields within each object in the "postsAndRepostsByProfilePerson" array):
Each item object should contain:
- "activityId": A unique reference String for the item.
- "activityType": A String, either "original_post" or "repost".
- "timestampOfActivity": A String for the relative or absolute timestamp of [Profile Person's Name]'s own post or their repost action (e.g., '1h ago', '3w ago', '2 weeks ago').
- "authoredContentByProfilePerson": A String containing any text content written by [Profile Person's Name] for this item. For an "original_post", this is the main content. For a "repost", this is any accompanying commentary [Profile Person's Name] added when reposting (can be null if they just reposted without added text).
- "engagementOnActivity": A JSON object for engagement specifically on [Profile Person's Name]'s post or on their repost action itself (i.e., likes/comments on their share, not the original shared item), with keys:
    - "likes": A Number or String of likes.
    - "commentsCount": A Number or String of comments.
    - "repostsCount": A Number or String of reposts (of their post/repost itself).
- "originalPostIfReposted": A JSON object (use null if activityType is "original_post"). If it is a repost, this object describes the original post that was shared, and must contain:
    - "originalAuthorName": A String for the name of the original post's author.
    - "originalAuthorHeadline": A String for the headline or brief description of the original post's author, if available, else null.
    - "originalPostTimestamp": A String for the timestamp of the original post (e.g. "3w", "5d ago").
    - "originalPostContent": A String for the full text content of the original post that was shared.
    - "originalPostEngagement": A JSON object for engagement on the *original shared post itself* (if discernible from the text), with keys: "likes", "commentsCount", "repostsCount".
- "mentionsByProfilePerson": An Array of JSON objects (mentions made by [Profile Person's Name] in their \`authoredContentByProfilePerson\`), each with "name" (String) and "link" (String or null if link not present).
- "hashtagsByProfilePerson": An Array of Strings (hashtags, without the '#', used by [Profile Person's Name] in their \`authoredContentByProfilePerson\`).
- "mediaAttached": An Array of JSON objects describing any media (images, videos, documents). Each object could have "type" (e.g., "image", "video_link", "document_link") and "description" (e.g., "Play video", "View document", "No alternative text description for this image") or "link" if a direct media URL is present.

POSTS AND REPOSTS TEXT TO PARSE:
{posts_text_input}`;

export const COMMENTS_PROMPT_TEXT = `You are an expert LinkedIn activity extractor. Your task is to parse the provided text, which contains comments and replies made by [Profile Person's Name] on other people's posts, and structure all available information into a JSON object.

IMPORTANT INSTRUCTIONS:
1. Focus ONLY on comments or replies written by [Profile Person's Name]. The text will indicate "[Profile Person's Name] commented on this" or "[Profile Person's Name] replied to X's comment".
2. The entire output must be a single JSON object. This object must contain a single key named "commentsMadeByProfilePerson". The value for this key will be an array of comment/reply objects.
3. For each comment/reply object, extract all fields as described in the "COMMENT/REPLY OBJECT STRUCTURE" section below.
4. If information for a specific field is not present, use \`null\` or an empty array \`[]\`.
5. Generate a unique \`commentId\` for each comment/reply (e.g., first ~10 words of comment + timestamp).
6. Return ONLY a single, valid JSON object. No explanations or any text before or after the JSON.

COMMENT/REPLY OBJECT STRUCTURE (describes fields within each object in the "commentsMadeByProfilePerson" array):
Each comment/reply object should contain:
- "commentId": A unique reference String.
- "commentText": A String: the text of the comment made by [Profile Person's Name].
- "commentTimestamp": A String: timestamp of [Profile Person's Name]'s comment (e.g., "20h", "4d").
- "likesOnComment": A Number or String for likes on [Profile Person's Name]'s comment, if available, else null.
- "onOriginalPost": A JSON object describing the post being commented on/replied to, with keys:
    - "author": A String: author of the original post.
    - "authorHeadline": A String: headline of the original post's author, if available.
    - "timestamp": A String: timestamp of the original post, if available.
    - "contentSnippet": A String: a brief ~20-30 word snippet of the original post's content to provide context.
- "isReplyTo": A JSON object (or null if it's a direct comment on a post, not a reply to another comment). If it is a reply, this object should have:
    - "author": A String: author of the specific comment being replied to by [Profile Person's Name].
    - "commentSnippet": A String: a brief snippet of the text of the comment being replied to.

COMMENTS TEXT TO PARSE:
{comments_text_input}`;

export const REACTIONS_PROMPT_TEXT = `You are an expert LinkedIn activity extractor. Your task is to parse the provided text, which describes posts and comments that [Profile Person's Name] has reacted to, and structure this information into a JSON object.

IMPORTANT INSTRUCTIONS:
1. Focus on identifying items (posts or comments made by OTHERS) where the text explicitly states that [Profile Person's Name] reacted (e.g., "[Profile Person's Name] liked X's post", "[Profile Person's Name] celebrated Y's comment on Z's post").
2. If [Profile Person's Name]'s own detailed textual comment is the primary content for an item in this reactions feed, it should primarily be handled by "Comments Extraction". However, if a reaction type (like, love, etc.) is *also explicitly mentioned* for that same item where they also commented, capture the reaction here. If no explicit reaction phrase is found for an item but it's clearly from a "reactions" feed context and doesn't show [Profile Person's Name]'s comment, list the reaction type as "Reacted - type unspecified".
3. The entire output must be a single JSON object. This object must contain a single key named "reactionsMadeByProfilePerson". The value for this key will be an array of reaction objects.
4. For each reaction object, extract fields as described in "REACTION OBJECT STRUCTURE" below.
5. Generate a unique \`reactionId\` for each distinct reaction.
6. If information for a specific field is not present, use \`null\`.
7. Return ONLY a single, valid JSON object. No explanations or any text before or after the JSON.

REACTION OBJECT STRUCTURE (describes fields within each object in the "reactionsMadeByProfilePerson" array):
Each reaction object should contain:
- "reactionId": A unique reference String (e.g., original author + first ~5 words of content reacted to + timestamp).
- "reactionType": A String describing the type of reaction as explicitly stated in the text (e.g., "liked", "celebrated", "loved", "insightful"). If the text only implies an interaction from the reactions feed without stating the type and no comment from [Profile Person's Name] is present, use "Reacted - type unspecified".
- "reactedTo": A JSON object describing the content that [Profile Person's Name] reacted to. It should have:
    - "type": A String, either "post" or "comment".
    - "author": A String for the author of the post or comment that was reacted to.
    - "authorHeadline": A String for the headline of the author reacted to, if available.
    - "contentSnippet": A String containing a brief ~20-30 word snippet of the post or comment content that was reacted to.
- "originalPostContext": A JSON object (or null if the reaction was directly to a post). If the reaction was to a comment, this object provides context about the main post that the comment belongs to, with keys:
    - "author": A String for the author of the main post.
    - "contentSnippet": A String containing a brief snippet of the main post's content.

REACTIONS TEXT TO PARSE:
{reactions_text_input}`;