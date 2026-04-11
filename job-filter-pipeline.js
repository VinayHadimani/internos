
const SYSTEM_PROMPT = require('./internos-system-prompt.txt');

// This runs AFTER ScraperOS fetches jobs
// BEFORE InternOS displays them

async function filterAndScoreJobs(resumeText, rawScrapedJobs) {
  
  // STEP 1: Pre-filter before even calling AI
  // This saves tokens and API calls
  const preFiltered = rawScrapedJobs.filter(job => {
    const title = job.title.toLowerCase();
    const desc = (job.description || '').toLowerCase();
    
    // Hard discard by title keywords
    const seniorKeywords = [
      'senior', 'sr.', 'staff', 'lead', 'manager',
      'director', 'principal', 'head of', 'vp', 
      'chief', 'architect'
    ];
    
    const isSenior = seniorKeywords.some(k => title.includes(k));
    if (isSenior) return false;
    
    // Hard discard by experience requirement in description
    const expPattern = /(\d+)\+?\s*years?\s*(of\s*)?(experience|exp)/gi;
    const matches = [...desc.matchAll(expPattern)];
    const hasHighExp = matches.some(m => parseInt(m[1]) >= 2);
    if (hasHighExp) return false;
    
    return true;
  });

  console.log(`Pre-filter: ${rawScrapedJobs.length} → ${preFiltered.length} jobs`);

  // STEP 2: AI scoring on pre-filtered results only
  const scored = await matchInBatches(resumeText, preFiltered);
  
  // STEP 3: Final sort and cap
  return scored
    .filter(job => job.match_score >= 40)
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, 30);
}

module.exports = { filterAndScoreJobs };
