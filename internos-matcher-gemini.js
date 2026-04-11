const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const SYSTEM_PROMPT = fs.readFileSync("./internos-system-prompt.txt", "utf-8");

async function matchJobsToResume(resumeText, jobListings) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json"  // forces JSON output
    }
  });

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

Run Phase 1 to extract student profile.
Then run Phase 2 to score all listings.
Return ONLY a JSON object with keys:
- "student_profile": extracted profile
- "matched_jobs": array of scored results
Discard listings that fail hard filters entirely.
`;

  const result = await model.generateContent(userMessage);
  const raw = result.response.text();

  try {
    return JSON.parse(raw);
  } catch (err) {
    const clean = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  }
}

module.exports = { matchJobsToResume };