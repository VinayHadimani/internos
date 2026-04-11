const Groq = require("groq-sdk");
const fs = require("fs");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = fs.readFileSync("./internos-system-prompt.txt", "utf-8");

async function matchJobsToResume(resumeText, jobListings) {
  // Build the user message
  const userMessage = `
## STUDENT RESUME
${resumeText}

## JOB LISTINGS TO EVALUATE
${jobListings.map((job, i) => `
--- LISTING ${i + 1} ---
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
Description: ${job.description}
`).join("\n")}

Run Phase 1 first to extract student profile.
Then run Phase 2 to score all listings.
Return ONLY valid JSON array of matched results.
Discard any listing that fails hard filters.
`;

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage }
    ],
    temperature: 0.1,      // low temp = consistent scoring
    max_tokens: 4000,
    response_format: { type: "json_object" }
  });

  const raw = response.choices[0].message.content;

  try {
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (err) {
    // Strip markdown fences if model adds them
    const clean = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  }
}

module.exports = { matchJobsToResume };