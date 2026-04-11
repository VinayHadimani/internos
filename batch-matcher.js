async function matchInBatches(resumeText, allListings, batchSize = 10) {
  const results = [];

  // Split listings into chunks of 10
  // (avoids hitting token limits)
  for (let i = 0; i < allListings.length; i += batchSize) {
    const batch = allListings.slice(i, i + batchSize);
    
    console.log(`Processing batch ${i/batchSize + 1}...`);
    
    const batchResult = await matchJobsToResume(resumeText, batch);
    
    if (batchResult.matched_jobs) {
      results.push(...batchResult.matched_jobs);
    }

    // Rate limit buffer — Groq free tier needs this
    await new Promise(r => setTimeout(r, 1000));
  }

  // Final sort across all batches
  return results
    .filter(job => job.match_score > 30)  // drop junk matches
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, 20);  // top 20 only
}

module.exports = { matchInBatches };