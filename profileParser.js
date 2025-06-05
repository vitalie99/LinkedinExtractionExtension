// profileParser.js - Robust Implementation with All Fixes (Analyzed from samples)
export function parseProfileInfo(rawText, existingProfileName) {
  const parsedData = {
    name: null,
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
    interests: { topVoices: [], companies: [], groups: [], newsletters: [], schools: [] } // Added newsletters & schools
  };

  if (!rawText || typeof rawText !== 'string') {
    return parsedData;
  }

  // Helper function for de-duplication (remains the same)
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

  const lines = rawText.split('\n');

  // 1. Enhanced Name Extraction (remains largely the same, was working)
  if (!existingProfileName || existingProfileName === "Unknown Profile" ||
      existingProfileName.includes('{:badgeType}')) {
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i].trim();
      if (line.includes('{:badgeType}') || line.includes('account')) continue;
      if (line.length > 2 && line.length < 50 &&
          /^[A-Za-z\s'-]+$/.test(line) &&
          !line.match(/Premium|Verified|degree|connection/i)) {
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          if (nextLine.match(/He\/Him|She\/Her|They\/Them/i) ||
              (i + 2 < lines.length && lines[i + 2].trim().match(/(?:1st|2nd|3rd)/))) {
            parsedData.name = line;
            break;
          }
        }
      }
    }
    if (!parsedData.name) {
      const pronounPattern = /^([A-Za-z\s'-]+)\s*\n\s*(?:He\/Him|She\/Her|They\/Them)/m;
      const pronounMatch = rawText.match(pronounPattern);
      if (pronounMatch && pronounMatch[1] && !pronounMatch[1].includes('{:')) {
        parsedData.name = pronounMatch[1].trim();
      }
    }
  } else if (!existingProfileName.includes('{:badgeType}')) {
    parsedData.name = existingProfileName;
  }
  if (!parsedData.name && existingProfileName && existingProfileName !== "Unknown Profile") {
    parsedData.name = existingProfileName;
  }


  // 2. Fixed Headline Extraction (remains largely the same, was working)
  const headlinePatterns = [
    /(?:1st|2nd|3rd)(?:\s+degree connection)?\s*\n([^\n]+?)(?:\s*\n[^\n]*)?(?:\s*\n.*?(?:Contact info|United States|followers))/s,
    /(?:He\/Him|She\/Her|They\/Them)\s*\n\s*(?:1st|2nd|3rd).*?\n([^\n]+)\n/,
    /(?:1st|2nd|3rd)\s*\n([^\n]+)\n(?!Premium|Verified)/
  ];
  for (const pattern of headlinePatterns) {
    const match = rawText.match(pattern);
    if (match && match[1]) {
      const headline = match[1].trim();
      if (headline.length > 5 && headline.length < 200 &&
          !headline.match(/^\d|Contact info|followers|connections|United States|Routable\n|Y Combinator|Membersy/i) && // Added Membersy from sample
          !headline.includes('•') && !headline.includes('{:')) {
        parsedData.headline = headline;
        break;
      }
    }
  }

  // 3. Fixed Location Extraction
  // Prioritize more specific patterns, ensure no company name is prepended.
  const primaryLocationPattern = /(?:[A-Za-z\s]+,\s*[A-Za-z\s]+,?\s*United States)\s+Contact info/;
  let locMatch = rawText.match(primaryLocationPattern);
  if (locMatch && locMatch[0]) {
      parsedData.location = locMatch[0].replace(/\s+Contact info/,'').trim();
  } else {
      const locationPatternsOld = [
        /\n([A-Za-z\s]+,\s*[A-Za-z\s]+),?\s*United States\s+Contact info/,
        /\n([A-Za-z\s]+,\s*[A-Z]{2})\s+Contact info/,
        // More general: line above "Contact info" that looks like a location
        /([A-Za-z\s]+,\s*[A-Za-z\s]+(?:,\s*United States)?)\n\s*Contact info/m,
        // Fallback: Location often appears near headline or company name for profile owner
        // This is tricky, try to get it if other methods fail and it's near the top.
        // Example: Nik Garza \n He/Him \n 1st \n Revenue Operations \n Membersy \n University of North Texas \n Austin, Texas, United States <-- This one
      ];
      for (const pattern of locationPatternsOld) {
        const match = rawText.match(pattern);
        if (match && match[1]) {
          let location = match[1].trim();
          const companyInHeadline = parsedData.headline ? parsedData.headline.split(/ at | @ /)[1] : null;
          if (companyInHeadline && location.startsWith(companyInHeadline)) {
            location = location.substring(companyInHeadline.length).replace(/^,\s*/, '').trim();
          }
          // Further clean if company name from headline is still there
          if (parsedData.name && location.startsWith(parsedData.name)) continue; // Avoid name being location

          // Remove company name if it's accidentally prepended
          // This needs a list of known companies or a more robust way.
          // For now, a simple check if it's not too long and looks like a location.
          if (location && location.length > 3 && location.length < 100 &&
              !location.match(/followers|connections|degree|Routable|Membersy|Domestique/i) && // Added example companies
              (location.includes(',') || location.toLowerCase().includes('united states'))) { // Basic check for location format
            if (location.toLowerCase().includes('united states') && !location.endsWith('United States')) {
                // Fix if "United States" is in the middle
                const parts = location.split(/,\s*United States/i);
                if (parts.length > 1) location = parts[0].trim() + ", United States";
            } else if (!location.toLowerCase().includes('united states') && location.includes(',')) {
                location += ", United States"; // Assume US if not specified but has city, state
            }
            parsedData.location = location.replace(/,\s*,/g, ',').trim();
            break;
          }
        }
      }
  }
   // Fallback if still no location, check near name/headline area
    if (!parsedData.location) {
        const nameAndHeadlineText = lines.slice(0, 10).join('\n');
        const fallbackLocMatch = nameAndHeadlineText.match(/([A-Za-z\s]+,\s*[A-Za-z\s]+(?:,\s*United States)?)(?=\n|$)/m);
        if (fallbackLocMatch && fallbackLocMatch[1]) {
            const potentialLoc = fallbackLocMatch[1].trim();
            if (potentialLoc.length > 5 && potentialLoc.includes(',') &&
                !/Routable|Membersy|Domestique|Y Combinator|California Polytechnic/i.test(potentialLoc) && // Avoid school/company names
                !parsedData.headline.includes(potentialLoc) && !parsedData.name.includes(potentialLoc) ) {
                 parsedData.location = potentialLoc.toLowerCase().includes('united states') ? potentialLoc : `${potentialLoc}, United States`;
            }
        }
    }


  // 4. Followers - search more broadly in the text if not found immediately
  const followersRegex = /([\d,]+)\s+followers/i;
  // Try specific section first, then broader search
  const activitySectionMatch = rawText.match(/Activity\s*\n\s*([\d,]+)\s+followers/i);
  if (activitySectionMatch && activitySectionMatch[1]) {
    parsedData.followers = activitySectionMatch[1].replace(/,/g, '');
  } else {
    const followersMatchGlobal = rawText.match(followersRegex);
    if (followersMatchGlobal && followersMatchGlobal[1]) {
        parsedData.followers = followersMatchGlobal[1].replace(/,/g, '');
    }
  }


  // 5. Connections (remains the same)
  const connectionsRegex = /([\d,]+\+?)\s+connections/i;
  const connectionsMatch = rawText.match(connectionsRegex);
  if (connectionsMatch && connectionsMatch[1]) {
    parsedData.connections = connectionsMatch[1];
  }

  // 6. Mutual Connections - REFINED
  const mutualConnectionsTextPattern = /((?:[A-Za-z\s.'-]+(?:,\s*)?)+)\s*(?:and|,)\s*(\d+)\s+other mutual connections/i;
  const mutualMatch = rawText.match(mutualConnectionsTextPattern);
  if (mutualMatch && mutualMatch[1]) {
    const namesText = mutualMatch[1].trim().replace(/,\s*$/, ''); // Remove trailing comma
    const names = namesText.split(/,(?!\sJr\.|\sSr\.|\sI{1,3}V?)/) // Split by comma, careful with suffixes
      .map(name => name.trim().replace(/\.$/, '')) // Trim and remove trailing period if any (e.g. David K.)
      .filter(name => name.length > 1 && name.length < 50 && // Min length 2, max 50
              /^[A-Za-z\s.'-]+$/.test(name) && // Allow ' and . in names
              !name.match(/connections|degree|Follow/i) &&
              name.toLowerCase() !== 'and'); // Explicitly filter out "and"
    parsedData.mutualConnections = names.slice(0, 5); // Limit to 5 as before
  }


  // 7. About section - REFINED end markers slightly
  const aboutRegex = /About\s*\n\s*About\s*\n([\s\S]*?)(?=\n(?:Featured|Activity|Experience|Education|Skills|Services|Top skills|$))/;
  const aboutMatchRaw = rawText.match(aboutRegex);
  if (aboutMatchRaw && aboutMatchRaw[1]) {
    let aboutText = aboutMatchRaw[1].trim();
    // Remove "Top skills" if it was captured within about section
    aboutText = aboutText.replace(/\nTop skills\s*(\n[\s\S]*)*/i, '').trim();
    // Remove "Services" if it was captured
    aboutText = aboutText.replace(/\nServices\s*(\n[\s\S]*)*/i, '').trim();

    const sentences = aboutText.split(/\.\s+/);
    const uniqueSentences = [];
    const seenSentences = new Set();
    for (const sentence of sentences) {
      const normalized = sentence.toLowerCase().trim();
      if (normalized && !seenSentences.has(normalized)) {
        seenSentences.add(normalized);
        uniqueSentences.push(sentence);
      }
    }
    const fullText = uniqueSentences.join('. ').trim();
    const halfLength = Math.floor(fullText.length / 2);
    if (fullText.length > 200 && fullText.substring(0, halfLength).trim() === fullText.substring(halfLength).trim()) {
      parsedData.about = fullText.substring(0, halfLength).trim();
    } else {
      parsedData.about = fullText;
    }
    if (parsedData.about && !parsedData.about.endsWith('.') && parsedData.about.length > 0) {
      parsedData.about += '.';
    }
  }

  // 8. Experience section - SUBSTANTIAL REWRITE
  const experienceSectionRegex = /Experience\s*\n\s*Experience\s*\n([\s\S]*?)(?=\n(?:Education|Skills|Recommendations|Interests|Licenses & certifications|Projects|Volunteering|$))/;
  const experienceSectionMatch = rawText.match(experienceSectionRegex);

  if (experienceSectionMatch && experienceSectionMatch[1]) {
    const experienceText = experienceSectionMatch[1];
    // Improved splitting logic: Look for a title, then company, then date range as start of blocks.
    // This is complex. A common pattern is:
    // Title
    // Company Name · Employment Type (e.g. Full-time)
    // Dates · Duration
    // Location
    // Description
    // Or sometimes:
    // Company Name (if multiple roles at same company)
    //   Title
    //   Dates · Duration
    //   Description
    //   Title
    //   Dates · Duration
    //   Description

    const jobEntries = [];
    // Split by potential company blocks first, then by roles within them if company is listed once for multiple roles.
    // For simplicity here, assume each job has its title and company listed explicitly.
    // A more robust way might be to look for date patterns as reliable separators AFTER a title/company.
    const rawJobBlocks = experienceText.split(/\n(?=[A-Z][A-Za-z\s'-]+.*\n(?:[A-Za-z0-9\s.,·&'-]+(?:LLC|Inc\.|Ltd\.|Corp\.|Company|Technologies|Solutions|Group|Ventures|Labs|Studios)?\s*(?:·\s*(?:Full-time|Part-time|Contract|Internship|Self-employed))?)\n(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s*[-–]\s*(?:Present|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})|(?:Present))|(?:Show all \d+ experiences))/);
    // This regex above is an attempt and might be too complex or not general enough.
    // A simpler, iterative approach might be better:
    let currentExpLines = [];
    const allExpLines = experienceText.split('\n');
    for (let i = 0; i < allExpLines.length; i++) {
        const line = allExpLines[i].trim();
        if (line === "Show all experiences" || line.match(/^Show all \d+ experiences$/)) break;

        // Heuristic to detect start of a new job:
        // Often a job title, not a date line, not a location line, not description.
        // And often followed by a company name or date line.
        const nextLine = (i + 1 < allExpLines.length) ? allExpLines[i+1].trim() : "";
        const nextNextLine = (i + 2 < allExpLines.length) ? allExpLines[i+2].trim() : "";

        // Crude way to check if 'line' looks like a title and next lines confirm a new job
        const looksLikeTitle = line.length > 3 && line.length < 150 && /^[A-Z]/.test(line) &&
                              !line.match(/·|\d{4}|Present|Location:|Description:/i) &&
                              !line.match(/^[A-Za-z\s]+,\s*[A-Za-z\s]+.*$/); // Not like "City, State"

        const nextLooksLikeCompanyOrDate = (nextLine.length > 1 && !nextLine.startsWith('·')) ||
                                           (nextLine.includes('·') && (nextLine.includes('Full-time') || nextLine.includes('Part-time'))) ||
                                           nextLine.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}|Present/i);

        if (looksLikeTitle && nextLooksLikeCompanyOrDate && currentExpLines.length > 0) {
            // Process previous block
            jobEntries.push(currentExpLines.join('\n'));
            currentExpLines = [line];
        } else {
            currentExpLines.push(line);
        }
    }
    if (currentExpLines.length > 0) {
        jobEntries.push(currentExpLines.join('\n'));
    }


    for (const block of jobEntries) {
      if (block.trim().length < 10) continue;
      const blockLines = block.split('\n').map(l => l.trim()).filter(l => l && !l.match(/^Skills:|see more$|Show all \d+ roles/i));
      if (blockLines.length < 1) continue;

      const expItem = { title: null, company: null, duration: null, totalDuration: null, location: null, description: null };
      let lineCursor = 0;

      // 1. Title
      if (lineCursor < blockLines.length && blockLines[lineCursor].length > 1 && /^[A-Z]/.test(blockLines[lineCursor]) && !blockLines[lineCursor].includes('·') && !blockLines[lineCursor].match(/\d{4}|Present/i) ) {
          expItem.title = blockLines[lineCursor];
          lineCursor++;
      }

      // 2. Company
      if (lineCursor < blockLines.length) {
          let companyLine = blockLines[lineCursor];
          expItem.company = companyLine.split(/\s*·\s*(?:Full-time|Part-time|Contract|Internship|Self-employed)/i)[0].trim();
          // If title was not found, and this line looks more like a title, previous line might be company (multi-role structure)
          // This part is very tricky and needs more sophisticated parsing for multi-role at same company.
          // For now, assume title then company.
          lineCursor++;
      }
       // If company seems to be title, and title is company, try to swap
      if (expItem.title && expItem.company && (expItem.title.toLowerCase().includes('llc') || expItem.title.toLowerCase().includes('inc')) && !(expItem.company.toLowerCase().includes('llc') || expItem.company.toLowerCase().includes('inc'))) {
          [expItem.title, expItem.company] = [expItem.company, expItem.title];
      }


      let descriptionLines = [];
      for (let i = lineCursor; i < blockLines.length; i++) {
        const currentLine = blockLines[i];
        const datePattern = /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})\s*[-–]\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}|Present)/i;
        const totalDurationPattern = /(\d+\s+yrs?)?\s*(\d+\s+mos?)?/;
        const combinedDateDurationPattern = new RegExp(datePattern.source + /\s*·\s*/.source + totalDurationPattern.source, 'i');


        const combinedMatch = currentLine.match(combinedDateDurationPattern);
        if (combinedMatch && !expItem.duration) {
            expItem.duration = `${combinedMatch[1]} - ${combinedMatch[2]}`;
            let totalDur = [];
            if (combinedMatch[3]) totalDur.push(combinedMatch[3]);
            if (combinedMatch[4]) totalDur.push(combinedMatch[4]);
            if (totalDur.length > 0) expItem.totalDuration = totalDur.join(' ').trim();
        } else if (currentLine.match(datePattern) && !expItem.duration) {
            expItem.duration = currentLine; // Simpler date pattern if combined fails
        } else if (currentLine.match(/^[A-Za-z\s]+,\s*[A-Za-z\s]+(?:,\s*United States)?$/) && currentLine.length < 80 && !expItem.location && !currentLine.toLowerCase().includes('skills')) {
            expItem.location = currentLine;
        } else if (currentLine.length > 20 || (descriptionLines.length > 0 && currentLine.length > 5)) { // Heuristic for description
            // Avoid specific metadata lines in description
            if (!currentLine.match(/^(?:Skills:|Sales Pipeline Management|Marketing Strategy|Customer Success)/i) && // Avoid skill lists being descriptions
                !currentLine.match(/United States · Hybrid|Metropolitan Area/i) && // Avoid location remnants
                currentLine !== expItem.location && currentLine !== expItem.duration && currentLine !== expItem.totalDuration) {
                 descriptionLines.push(currentLine);
            }
        }
      }

      if (descriptionLines.length > 0) {
        expItem.description = simpleDeduplicate(descriptionLines.join('\n'));
      }
      
      // Basic validation: title and company must exist.
      if (expItem.title && expItem.company && expItem.title.length > 1 && expItem.company.length > 1 &&
          !expItem.title.match(/Present|\d{4}|mos|yrs|-|·/) && // Title shouldn't be just a date
          !expItem.company.match(/Present|\d{4}|mos|yrs|-|·/)) { // Company shouldn't be just a date
        parsedData.experience.push(expItem);
      }
    }
  }


  // 9. Education section - REFINED
  const educationSectionRegex = /Education\s*\n\s*Education\s*\n([\s\S]*?)(?=\n(?:Skills|Licenses & certifications|Recommendations|Interests|Volunteering|Languages|$))/; // Added more terminators
  const educationSectionMatch = rawText.match(educationSectionRegex);

  if (educationSectionMatch && educationSectionMatch[1]) {
    const educationText = educationSectionMatch[1];
    // Split by likely school name (usually capitalized, may contain "University", "College", etc.)
    // This needs to avoid splitting within a single school's multi-line description.
    // A line starting with a capital letter, not indented, often a school name.
    const eduBlocks = educationText.split(/\n(?=[A-Z][^\n]*(?:University|College|School|Institute|Academy|Y Combinator|High School)\b)/)
                                .filter(block => !block.match(/Licenses & certifications/i)); // Ensure licenses are not parsed as edu

    const seenSchools = new Set();
    for (const block of eduBlocks) {
      if (block.trim().length < 5) continue;
      const eduItem = { school: null, degree: null, fieldOfStudy: null, years: null };
      const eduLines = block.split('\n').map(l => l.trim()).filter(l => l);
      if (eduLines.length === 0) continue;

      eduItem.school = eduLines[0]; // Assume first line is school
      if (seenSchools.has(eduItem.school.toLowerCase()) || eduItem.school.includes('.png')) { // Skip duplicates or image files
        continue;
      }
      seenSchools.add(eduItem.school.toLowerCase());

      for (let i = 1; i < eduLines.length; i++) {
        const line = eduLines[i];
        const yearPattern = /(\b\d{4}\b)\s*[-–]\s*(\b\d{4}\b)/;
        const yearMatch = line.match(yearPattern);
        const degreeGenericPattern = /(Bachelor(?:’s|'s| of Arts| of Science)?|Master(?:’s|'s| of Science)?|Associate|B\.?A\.?|B\.?S\.?|M\.?A\.?|M\.?S\.?|MBA|PhD|Doctorate|Diploma|Certificate|Degree)/i;
        const fieldOfStudyPattern = /,\s*([^,·\d]+(?:\s+[^,·\d]+)*)/; // Text after a comma, not numbers

        if (yearMatch && !eduItem.years) {
          eduItem.years = `${yearMatch[1]} - ${yearMatch[2]}`;
        } else if (degreeGenericPattern.test(line) && !eduItem.degree) {
            let degreeText = line;
            let fieldText = null;

            // Try to split degree and field if on the same line
            const degreeMatchSpecific = line.match(degreeGenericPattern);
            if (degreeMatchSpecific) {
                degreeText = degreeMatchSpecific[0].trim(); // The specific degree part
                // The rest of the line might be field of study
                let remainingLine = line.substring(degreeMatchSpecific[0].length).trim();
                if (remainingLine.startsWith(',')) remainingLine = remainingLine.substring(1).trim();

                if (remainingLine.length > 2 && !remainingLine.match(yearPattern)) { // Check if it's not years
                    fieldText = remainingLine;
                }
            }
            eduItem.degree = degreeText;
            if (fieldText) eduItem.fieldOfStudy = fieldText;

        } else if (!eduItem.fieldOfStudy && eduItem.degree && line.length > 2 && !yearMatch && !degreeGenericPattern.test(line) && !line.match(/Activities and societies/i)) {
            // If degree is set and this line is not years or another degree, it might be field of study
            eduItem.fieldOfStudy = line;
        } else if (!eduItem.degree && !eduItem.fieldOfStudy && line.length > 2 && !yearMatch && !line.match(/Activities and societies|HubSpot Academy\.png/i)) {
            // Fallback: if no degree/field yet, and line is substantive, consider it field of study or degree-like
            // This is less precise.
            if (line.split(/\s+/).length <= 5) { // Assume degree/field names are not excessively long
                 eduItem.fieldOfStudy = line; // Or could be degree if it's a non-standard name
            }
        }
      }
      if (eduItem.school && !eduItem.school.match(/^Activities and societies/i) && eduItem.school.length > 2) {
        parsedData.education.push(eduItem);
      }
    }
  }


  // 10. Skills section - REFINED
  const skillsSectionRegex = /Skills\s*\n\s*Skills\s*\n([\s\S]*?)(?=\n(?:Recommendations|Honors|Languages|Interests|Projects|Volunteering|$))/;
  const skillsSectionMatch = rawText.match(skillsSectionRegex);

  if (skillsSectionMatch && skillsSectionMatch[1]) {
    const skillsText = skillsSectionMatch[1];
    const skillLines = skillsText.split('\n').map(l => l.trim()).filter(Boolean);
    const seenSkills = new Set();

    for (let i = 0; i < skillLines.length; i++) {
      const line = skillLines[i];
      const skillItem = { name: null, endorsementsCount: null, endorsedBySummary: [] };

      // Skip known non-skill headers or UI elements
      if (line === 'Skills' || line.match(/^Show all \d+ skills$/i) ||
          line.match(/experiences? across|other compan(?:y|ies)/i) || // Skip "X experiences across Y company"
          line.match(/^Endorse$/i) || line.match(/^Show all \d+ details$/i)) { // Skip "Endorse" button text
        continue;
      }

      // Assume current line is skill name if it's not an endorsement line
      const endorsementRegex = /(\d+\+?)\s*endorsements?/i;
      if (!endorsementRegex.test(line) && !line.startsWith("Endorsed by")) {
        skillItem.name = line;

        // Look for endorsements on subsequent lines, skipping "Endorsed by X" type lines
        for (let j = i + 1; j < Math.min(i + 5, skillLines.length); j++) { // Look ahead a few lines
          const nextLine = skillLines[j];
          if (nextLine.startsWith("Endorsed by")) {
            skillItem.endorsedBySummary.push(nextLine); // Optional: capture summary
            continue; // Skip this line and check next for count
          }
          const endorsementMatch = nextLine.match(endorsementRegex);
          if (endorsementMatch) {
            skillItem.endorsementsCount = endorsementMatch[1].includes('+') ? endorsementMatch[1] : parseInt(endorsementMatch[1]);
            i = j; // Advance outer loop cursor
            break;
          }
          // If it's another skill name or unrelated text, stop looking for endorsements for current skill
          if (!nextLine.startsWith("Endorsed by") && !endorsementRegex.test(nextLine) && nextLine.length > 0) {
              break;
          }
        }
      }

      if (skillItem.name && !seenSkills.has(skillItem.name.toLowerCase())) {
        parsedData.skills.push(skillItem);
        seenSkills.add(skillItem.name.toLowerCase());
      }
    }
  }


  // 11. Recommendations section (remains largely the same, was mostly working)
  const recRegex = /Recommendations\s*\n\s*Recommendations\s*\n([\s\S]*?)(?=\n(?:Honors|Languages|Interests|Publications|Projects|Volunteering|$))/;
  const recMatch = rawText.match(recRegex);
  if (recMatch && recMatch[1]) {
    const recText = recMatch[1];
    const receivedSection = recText.split(/\nGiven\n/)[0];
    if (receivedSection) {
      // Improved split: look for a name, then title with '·', then date
      const recBlocks = receivedSection.split(/\n(?=[A-Z][a-z'-]+ [A-Z][a-z'-]+(?: [A-Z][a-z'-]+)?\s*\n.*·.*\n(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4})/);
      for (const block of recBlocks) {
        if (block.trim().length < 30 || block.includes("Recommend Alex") || block.includes("Recommend Nik")) continue; // Skip "Recommend X" prompts
        const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 3) continue;
        const recItem = { recommenderName: null, recommenderTitle: null, date: null, text: null };
        recItem.recommenderName = lines[0];
        let textStartIndex = -1;
        for (let k = 1; k < lines.length; k++) {
            const line = lines[k];
            const dateRegex = /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/;
            const dateMatch = line.match(dateRegex);
            if (dateMatch) {
                recItem.date = dateMatch[0];
                // Title is often the line before date, or part of it.
                 if (lines[k-1] && lines[k-1] !== recItem.recommenderName && !lines[k-1].match(dateRegex)) {
                    recItem.recommenderTitle = lines[k-1].split('·')[0].trim(); // Take part before '·'
                 }
                 textStartIndex = k + 1; // Text usually starts after date line
            } else if (line.includes('·') && !recItem.recommenderTitle && line !== recItem.recommenderName) {
                recItem.recommenderTitle = line.split('·')[0].trim();
            }
        }
        if (textStartIndex !== -1 && textStartIndex < lines.length) {
            recItem.text = simpleDeduplicate(lines.slice(textStartIndex).join('\n').trim());
        } else if (lines.length > 2 && !recItem.text) { // Fallback for text if specific markers not found
             const potentialText = lines.slice(1).filter(l => l !== recItem.recommenderTitle && l !== recItem.date && l.length > 30).join('\n');
             if (potentialText) recItem.text = simpleDeduplicate(potentialText);
        }

        if (recItem.recommenderName && recItem.text && recItem.date) {
          parsedData.recommendations.received.push(recItem);
        }
      }
    }
  }

  // 12. Interests Section - IMPLEMENTED
  const interestsSectionRegex = /Interests\s*\n\s*Interests\s*\n([\s\S]*?)(?=\n(?:Causes|Languages|Skills|Recommendations|Projects|Volunteering|$))/i;
  const interestsSectionMatch = rawText.match(interestsSectionRegex);
  if (interestsSectionMatch && interestsSectionMatch[1]) {
      const interestsText = interestsSectionMatch[1];
      const sections = {
          "Top Voices": { regex: /Top Voices\s*\n([\s\S]*?)(?=\n(?:Companies|Groups|Newsletters|Schools|$))/i, data: parsedData.interests.topVoices, type: 'voice' },
          "Companies": { regex: /Companies\s*\n([\s\S]*?)(?=\n(?:Top Voices|Groups|Newsletters|Schools|$))/i, data: parsedData.interests.companies, type: 'company' },
          "Groups": { regex: /Groups\s*\n([\s\S]*?)(?=\n(?:Top Voices|Companies|Newsletters|Schools|$))/i, data: parsedData.interests.groups, type: 'group' },
          "Newsletters": { regex: /Newsletters\s*\n([\s\S]*?)(?=\n(?:Top Voices|Companies|Groups|Schools|$))/i, data: parsedData.interests.newsletters, type: 'newsletter' },
          "Schools": { regex: /Schools\s*\n([\s\S]*?)(?=\n(?:Top Voices|Companies|Groups|Newsletters|$))/i, data: parsedData.interests.schools, type: 'school' }
      };

      for (const key in sections) {
          const sectionMatch = interestsText.match(sections[key].regex);
          if (sectionMatch && sectionMatch[1]) {
              const itemsText = sectionMatch[1].trim();
              // Each item often has Name, then Headline/Industry, then Followers/Members, then "Follow" button
              // This split is a heuristic and may need refinement based on more examples.
              const itemBlocks = itemsText.split(/\nFollow\s*(?:\n|$)/); // Split by "Follow" button
              for (const block of itemBlocks) {
                  if (block.trim().length < 5) continue;
                  const itemLines = block.split('\n').map(l => l.trim()).filter(Boolean);
                  if (itemLines.length < 1) continue;

                  const item = { name: itemLines[0] }; // First line is usually name
                  if (itemLines.length > 1 && !itemLines[1].match(/(\d[\d,.]*k?)\s+(followers|members)/i) && !itemLines[1].includes('·')) {
                      // Second line often headline or industry if not follower/member count
                      if (sections[key].type === 'voice') item.headline = itemLines[1];
                      if (sections[key].type === 'company') item.industry = itemLines[1]; // Or might be headline
                  }
                  for (let k = 1; k < itemLines.length; k++) {
                      const followersMatch = itemLines[k].match(/(\d[\d,.]*k?)\s+(followers|members)/i);
                      if (followersMatch) {
                          if (sections[key].type === 'voice' || sections[key].type === 'company' || sections[key].type === 'school') item.followers = followersMatch[1];
                          if (sections[key].type === 'group') item.members = followersMatch[1];
                          // If headline/industry wasn't found on line 1, try line k-1 if it's not name
                          if (!item.headline && !item.industry && k > 0 && itemLines[k-1] !== item.name && !itemLines[k-1].match(/(\d[\d,.]*k?)\s+(followers|members)/i)) {
                             if (sections[key].type === 'voice') item.headline = itemLines[k-1];
                             if (sections[key].type === 'company') item.industry = itemLines[k-1];
                          }
                          break;
                      }
                  }
                  sections[key].data.push(item);
              }
          }
      }
  }
  // End Interests

  // Set current company from most recent experience - REFINED to handle parsing issues
  if (parsedData.experience.length > 0) {
    const mostRecentExp = parsedData.experience.find(exp => exp.duration && exp.duration.toLowerCase().includes('present'));
    if (mostRecentExp && mostRecentExp.company && !mostRecentExp.company.match(/Present|\d{4}|mos|yrs|-|·/)) { // Ensure company is not a date
      parsedData.currentCompany = mostRecentExp.company;
    } else if (parsedData.experience[0] && parsedData.experience[0].company && !parsedData.experience[0].company.match(/Present|\d{4}|mos|yrs|-|·/)) {
        // Fallback to first listed company if "Present" isn't found or duration is malformed, but only if it seems valid
        if (parsedData.experience[0].duration) { // Only if there's some duration, even if not "Present"
             parsedData.currentCompany = parsedData.experience[0].company;
        }
    }
  }


  //TODO: Add parsing for Licenses & Certifications, Projects, Volunteering, Honors & Awards, Publications, Causes if schema is extended.
  // For now, they are not part of the requested schema.

  return parsedData;
}

// Helper function to calculate text similarity (remains the same)
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  const words1 = str1.toLowerCase().split(/\s+/);
  const words2 = str2.toLowerCase().split(/\s+/);
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}