import Groq from 'groq-sdk';
import { aggregateJobs, Job } from './job-aggregator';
import { calculateMatchScore } from '@/lib/matching/skills';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

export interface SearchTerms {
  skills: string[];
  roleTypes: string[];
  experience: string;
  searchQueries: string[];
}

/**
 * Function 1: Extract search terms from resume
 */
export async function extractSearchTerms(
  resumeText: string
): Promise<SearchTerms> {
  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: `Analyze this resume and extract job search terms.
          Return ONLY valid JSON.
          Format:
          {
            "skills": ["skill1", "skill2"],
            "roleTypes": ["Frontend Developer", "Full Stack"],
            "experience": "fresher|junior|mid|senior",
            "searchQueries": [
              "React developer intern",
              "Frontend intern",
              "Full stack intern"
            ]
          }
          searchQueries should be 3-5 specific search terms
          based on their strongest skills and experience.`
        },
        {
          role: "user",
          content: resumeText
        }
      ],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("No content returned from AI");
    
    return JSON.parse(content);
  } catch (error) {
    console.error("Error extracting search terms:", error);
    return {
      skills: [],
      roleTypes: [],
      experience: 'fresher',
      searchQueries: ['software developer intern']
    };
  }
}

/**
 * Function 2: Search jobs based on resume
 */
export async function searchJobsForResume(
  resumeText: string
): Promise<{
  jobs: Job[];
  searchTerms: SearchTerms;
}> {
  // Step 1: Extract what to search for
  const searchTerms = await extractSearchTerms(resumeText);
  
  // Step 2: Run aggregator for each search query
  const allJobs: Job[] = [];
  
  for (const query of searchTerms.searchQueries) {
    try {
      const jobs = await aggregateJobs(query);
      allJobs.push(...jobs);
      
      // Small delay between searches to avoid rate limits
      await new Promise(r => setTimeout(r, 500));
    } catch (error) {
      console.error(`Search failed for query: ${query}`, error);
    }
  }

  // Step 3: Deduplicate jobs by URL
  const seen = new Set<string>();
  const uniqueJobs = allJobs.filter(job => {
    const key = job.url || `${job.title}-${job.company}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    jobs: uniqueJobs,
    searchTerms
  };
}

/**
 * Function 3: Rank jobs against resume
 */
export async function rankJobsForResume(
  resumeText: string,
  jobs: Job[],
  userSkills: string[],
  experienceLevel: string
): Promise<any[]> {
  const rankedJobs = jobs.map(job => {
    // Extract skills from job
    const jobSkills = job.skills || 
                      (job.description ? extractSkillsFromText(job.description) : []);

    // Calculate match score using the matching algorithm
    const matchScore = calculateMatchScore(userSkills, jobSkills);

    return {
      ...job,
      matchScore,
      matchLabel: getMatchLabel(matchScore)
    };
  });

  // Sort by match score descending
  return rankedJobs.sort((a, b) => b.matchScore - a.matchScore);
}

// Helper: extract skills from job text
function extractSkillsFromText(text: string): string[] {
  const commonSkills = [
    'Python', 'JavaScript', 'TypeScript', 'React', 'Node.js',
    'SQL', 'MongoDB', 'AWS', 'Docker', 'Git', 'Java', 'C++',
    'Machine Learning', 'Data Science', 'Django', 'Flask',
    'Next.js', 'Vue', 'Angular', 'CSS', 'HTML', 'Tailwind',
    'Figma', 'UI/UX', 'Marketing', 'Excel', 'PowerPoint'
  ];
  
  return commonSkills.filter(skill => 
    text.toLowerCase().includes(skill.toLowerCase())
  );
}

// Helper: get match label from score
function getMatchLabel(score: number): string {
  if (score >= 80) return 'Excellent Match';
  if (score >= 60) return 'Good Match';
  if (score >= 40) return 'Moderate Match';
  return 'Low Match';
}