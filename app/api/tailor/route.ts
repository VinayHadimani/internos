import { callAI } from '@/lib/rotating-ai';
import { applyResumeQualityGuard, sanitizeJobPostingForTailor } from '@/lib/resume-quality-guard';

export async function POST(request: Request) {
  console.log('[Tailor API] === REQUEST RECEIVED ===');
  
  try {
    const { resume, resumeText, jobDescription } = await request.json();
    
    // Normalize resume input
    const inputResume = resume || resumeText;
    
    if (!inputResume || !jobDescription) {
      return Response.json({ 
        success: false, 
        error: 'Missing resume or job description' 
      }, { status: 400 });
    }

    const safeResume = applyResumeQualityGuard(String(inputResume), true);
    const resumeForModel = safeResume.length >= 20 ? safeResume : String(inputResume);

    let cleanJob = sanitizeJobPostingForTailor(String(jobDescription));
    if (cleanJob.length < 40) {
      cleanJob = String(jobDescription);
    }

    // Attempt tailoring with rotating AI
    let finalContent = '';
    let successProvider = '';

    const systemPrompt = `You are a professional career coach and resume writer. 

TASK: Rewrite the user's resume for this specific job.

STRICT RULES:
1. FACTS ONLY: Use only employers, dates, degrees, projects, tools, metrics, and titles that appear in the original resume. Do not invent numbers, companies, certifications, or dates. Do not upgrade job titles unless the resume already uses that title.
2. ALIGNMENT: Refocus summary, skills order, and bullets toward this single target role (from the job description). Remove or shorten items that do not support that role. Do not blend unrelated targets (e.g. PM + SWE + DS) unless the resume clearly justifies it.
3. VOICE: Past tense for completed roles and projects; present tense only for a clearly current role. No apology or hedge paragraphs ("although I don't have…", "I am eager to learn…").
4. OUTPUT: Plain English text only—no markdown (#, **, __, backticks). No PDF syntax (obj, stream, xref). No recruiter screening phrases, tracking tokens, or instructions copied from the job posting.
5. STRUCTURE: Keep contact info, education, skills, and experience or projects. Omit empty sections; do not add placeholder or generic filler.
6. PRIVACY: Do not add third-party personal data, secrets, API keys, or long encoded strings.
7. STRUCTURE HEADERS: Use these EXACT section headers in ALL CAPS:
   - SUMMARY (or PROFESSIONAL SUMMARY)
   - EXPERIENCE (or WORK EXPERIENCE)  
   - EDUCATION
   - SKILLS
   - PROJECTS (if applicable)
   - CERTIFICATIONS (if applicable)
   Each header should be on its own line, followed by content on the next line.`;

    const userPrompt = `RESUME DATA:\n${resumeForModel}\n\nJOB DETAILS:\n${cleanJob}\n\nRewrite my resume for this job. Return only human-readable text.`;

    // Increased attempts to 2 to handle PDF hallucination retries via rotation system
    // (callAI will try multiple keys/providers if needed)
    const response = await callAI(systemPrompt, userPrompt, {
      model: 'llama-3.3-70b-versatile',
      temperature: 0.0, // Force maximum determinism
      max_tokens: 3000,
      providerPriority: ['groq', 'openai', 'gemini']
    });

    if (!response.success || !response.content) {
      console.error('[Tailor API] AI Failure:', response.error);
      return Response.json({ 
        success: false, 
        error: 'Resume tailoring failed. Please try again in a moment.',
        detail: response.error
      }, { status: 500 });
    }

    finalContent = response.content;
    successProvider = response.provider || 'unknown';

    // Content-level validation (PDF syntax hallucination)
    if (/obj|endobj|stream|xref|trailer|\/Producer/i.test(finalContent)) {
       // If it hallucinated PDF syntax, we try one more time specifically with Gemini
       console.warn('[Tailor API] Hallucinated PDF syntax, retrying with priority Gemini...');
       const retryResponse = await callAI(systemPrompt, userPrompt, {
         providerPriority: ['gemini', 'openai'],
         temperature: 0.1
       });
       if (retryResponse.success && retryResponse.content) {
         finalContent = retryResponse.content;
         successProvider = retryResponse.provider || 'gemini';
       }
    }

    const cleanContent = applyResumeQualityGuard(
      finalContent
        .replace(/```[a-z]*\n/gi, '')
        .replace(/```/g, '')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim(),
      true
    );

    console.log(`[Tailor API] Success via ${successProvider}! Final output length: ${cleanContent.length}`);

    // Extract matched keywords from the tailored resume
    // Compare skills found in tailored resume against job description requirements
    const jobLower = cleanJob.toLowerCase();
    
    // Quick heuristic to find requirements and preferred blocks
    const reqIndex = Math.max(
      jobLower.indexOf('require'),
      jobLower.indexOf('must have'),
      jobLower.indexOf('qualific')
    );
    
    const prefIndex = Math.max(
      jobLower.indexOf('prefer'),
      jobLower.indexOf('nice to have'),
      jobLower.indexOf('bonus')
    );
    
    let requireBlock = jobLower;
    let preferBlock = "";
    
    if (reqIndex !== -1) {
      if (prefIndex !== -1 && prefIndex > reqIndex) {
        requireBlock = jobLower.substring(reqIndex, prefIndex);
        preferBlock = jobLower.substring(prefIndex);
      } else {
        requireBlock = jobLower.substring(reqIndex);
        if (prefIndex !== -1 && prefIndex < reqIndex) {
          preferBlock = jobLower.substring(prefIndex, reqIndex);
        }
      }
    } else if (prefIndex !== -1) {
       preferBlock = jobLower.substring(prefIndex);
    }

    const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 
          'can', 'had', 'her', 'was', 'one', 'our', 'out', 'has', 'have', 'from', 'been',
          'some', 'them', 'than', 'its', 'over', 'such', 'that', 'with', 'will', 'this',
          'each', 'make', 'like', 'just', 'also', 'into', 'could', 'other', 'which',
          'their', 'there', 'would', 'about', 'these', 'many', 'then', 'more', 'very',
          'when', 'what', 'your', 'where', 'who', 'how', 'does', 'did', 'may', 'should',
          'must', 'need', 'well', 'work', 'using', 'through', 'during', 'before', 'after',
          'between', 'both', 'under', 'within', 'without', 'experience', 'including',
          'ability', 'able', 'ensuring', 'various', 'strong', 'looking', 'role',
          'team', 'will', 'working', 'join', 'across', 'world', 'every', 'day', 'years', 'month', 'time', 'full', 'part', 'based', 'intern', 'internship', 'student']);

    const extractWords = (text: string) => text.split(/[\s,;.!?()\[\]{}\/\\|"'`~@#$%^&*+=<>:]+/).filter(w => w.length > 3 && !stopWords.has(w));
    
    const reqWordsSet = new Set(extractWords(requireBlock));
    const prefWordsSet = new Set(extractWords(preferBlock));
    
    // If no distinct blocks found, treat entire description as required context
    if (reqWordsSet.size < 5) {
        extractWords(jobLower).forEach(w => reqWordsSet.add(w));
    }
    
    const jobWords = new Set([...reqWordsSet, ...prefWordsSet]);
    const resumeWords = new Set(extractWords(cleanContent.toLowerCase()));

    // These are the "matched keywords" that would pass ATS screening
    const matchedKeywords = [...jobWords]
      .filter(w => resumeWords.has(w))
      .slice(0, 15);
      
    // What's missing?
    const missingKeywords = [...reqWordsSet]
      .filter(w => !resumeWords.has(w))
      .slice(0, 8);

    // Calculate realistic ATS Score (35-95 range)
    let percentReqs = 0;
    if (reqWordsSet.size > 0) {
       const matchedReqs = [...reqWordsSet].filter(w => resumeWords.has(w)).length;
       percentReqs = matchedReqs / reqWordsSet.size;
    }
    
    let percentPrefs = 0;
    if (prefWordsSet.size > 0) {
       const matchedPrefs = [...prefWordsSet].filter(w => resumeWords.has(w)).length;
       percentPrefs = matchedPrefs / prefWordsSet.size;
    }
    
    // Resume Length factor (1 page ~ 2000 chars, ideal student is 1.5 pages max ~ 3000)
    let lengthFactor = 1.0;
    if (cleanContent.length < 1000) lengthFactor = 0.6; // too short
    else if (cleanContent.length > 5000) lengthFactor = 0.8; // far too long for an intern

    let baseAts = 35;
    // 60% weight to required
    baseAts += (percentReqs * 50) * lengthFactor;
    // 30% weight to preferred
    baseAts += (percentPrefs * 20) * lengthFactor;
    
    // 10% length appropriateness booster
    if (cleanContent.length >= 1000 && cleanContent.length <= 4000) {
      baseAts += 10;
    }

    const atsScore = Math.min(95, Math.max(35, Math.round(baseAts)));

    console.log(`[Tailor API] Matched keywords (${matchedKeywords.length}): ${matchedKeywords.slice(0, 8).join(', ')}`);
    console.log(`[Tailor API] ATS Score calculated: ${atsScore}`);

    return Response.json({
      success: true,
      tailoredResume: cleanContent,
      atsScore,
      keywordsMatched: matchedKeywords,
      missingKeywords,
      provider: successProvider
    }, {
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });

  } catch (error: any) {
    console.error('[Tailor API] Error:', error);
    return Response.json({ 
      success: false, 
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}
