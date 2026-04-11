const { matchJobsToResume } = require("./internos-matcher");
// or swap with internos-matcher-gemini

const resumeText = `
Vinay Hadimani
B.E. AIML, 1st Year | VCE Mysore | 2025-2029
Skills: Python, JavaScript, React, React Native, 
        LangChain, OpenAI API, Node.js, HTML, CSS
Projects: LifeBoost AI (React Native + Python + OpenAI)
          Portfolio websites (React + Netlify)
Certifications: Google Python (Coursera) - Completed
Seeking: Remote internship, part-time, open to international
`;

const jobListings = [
  {
    title: "AI/ML Intern",
    company: "Actian Corporation",
    location: "Remote",
    description: "Summer 2026 internship. Python required. No experience needed. 12 weeks structured program."
  },
  {
    title: "Senior Embedded QA Engineer",
    company: "EnCharge AI",
    location: "India",
    description: "7+ years required. BS/MS/PhD in EE or CS."
  },
  {
    title: "Frontend Developer Intern",
    company: "SomeStartup",
    location: "Remote",
    description: "React, HTML, CSS. Currently pursuing degree welcome. Stipend provided."
  }
];

async function main() {
  console.log("Running InternOS matcher...\n");

  const results = await matchJobsToResume(resumeText, jobListings);

  // Print student profile
  console.log("=== STUDENT PROFILE ===");
  console.log(JSON.stringify(results.student_profile, null, 2));

  // Print matched jobs sorted by priority
  console.log("\n=== MATCHED JOBS ===");
  results.matched_jobs
    .sort((a, b) => b.match_score - a.match_score)
    .forEach(job => {
      console.log(`
${job.title} @ ${job.company}
Score: ${job.match_score}/100 | Priority: ${job.apply_priority}
Why: ${job.why_apply}
Missing: ${job.missing_skills.join(", ") || "None"}
Red Flags: ${job.red_flags.join(", ") || "None"}
---`);
    });
}

main().catch(console.error);