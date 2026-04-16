// app/api/internships/search/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { aggregateJobs, type JobResult as Job } from '@/lib/aggregator';

interface ResumeProfile {
  hard_skills: string[];
  soft_skills: string[];
  roles: string[];
  industry: string;
  experience_level: string;
  search_keywords: string[];
}

function cleanResumeText(text: string): string {
  // Use character class to support multi-line matching on older targets
  return text.replace(/\(Tip:[\s\S]*?\)\s*/gi, '').trim();
}

async function aiExtractProfile(resumeText: string): Promise<ResumeProfile | null> {
  try {
    const cleanText = cleanResumeText(resumeText);
    const prompt = `Analyze this resume. Return ONLY valid JSON, no markdown:
{
  "hard_skills": ["list technical/domain skills"],
  "soft_skills": ["list soft skills"],
  "roles": ["target job titles"],
  "industry": "industry",
  "experience_level": "student|entry|mid|senior",
  "search_keywords": ["5-8 job search terms"]
}

Resume:
${cleanText}`;

    const apiKey = process.env.GROQ_API_KEY || process.env.GROQ_API_KEYS;
    if (!apiKey) return null;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.split(',')[0]}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'Return valid JSON only. No markdown.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 800,
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) return null;
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    let jsonStr = content;
    const fence = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) jsonStr = fence[1];
    const match = jsonStr.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const p = JSON.parse(match[0]);
    return {
      hard_skills: Array.isArray(p.hard_skills) ? p.hard_skills.map((s: string) => s.toLowerCase().trim()) : [],
      soft_skills: Array.isArray(p.soft_skills) ? p.soft_skills.map((s: string) => s.toLowerCase().trim()) : [],
      roles: Array.isArray(p.roles) ? p.roles.map((r: string) => r.toLowerCase().trim()) : [],
      industry: (p.industry || '').toLowerCase().trim(),
      experience_level: (p.experience_level || 'entry').toLowerCase().trim(),
      search_keywords: Array.isArray(p.search_keywords) ? p.search_keywords : [],
    };
  } catch (err) {
    console.error('[Search] AI error:', err);
    return null;
  }
}

function scoreJob(job: Job, profile: ResumeProfile): number {
  const jobText = `${job.title} ${job.description}`.toLowerCase();
  const titleLower = job.title.toLowerCase();

  // Count hard skill matches
  let skillHits = 0;
  for (const skill of profile.hard_skills) {
    if (skill.length < 2) continue;
    if (titleLower.includes(skill)) skillHits += 2; // Title match = double weight
    else if (jobText.includes(skill)) skillHits += 1;
  }

  // Count role matches
  let roleHits = 0;
  for (const role of profile.roles) {
    if (role.length < 3) continue;
    const words = role.split(/\s+/).filter(w => w.length > 2);
    if (words.length === 0) continue;
    const titleWords = titleLower.split(/\s+/);
    const hits = words.filter(w => titleWords.some(t => t.includes(w) || w.includes(t))).length;
    if (hits >= Math.max(1, words.length * 0.5)) roleHits++;
  }

  // If NOTHING matches at all, give it a very low score (not zero)
  if (skillHits === 0 && roleHits === 0) {
    // Check if job is entry-level — give a tiny score so it doesn't vanish
    if (/\b(intern|junior|entry|student|graduate|trainee|assistant|associate)\b/.test(titleLower)) {
      return 5; // Will show at bottom, marked as low match
    }
    return 0;
  }

  let score = 0;
  score += Math.min(skillHits * 10, 50); // Skills: up to 50pts
  score += Math.min(roleHits * 15, 30);  // Roles: up to 30pts

  // Industry match
  if (profile.industry && jobText.includes(profile.industry)) score += 10;

  // Entry-level bonus
  if (/\b(intern|internship|junior|entry[\s.-]?level|student|graduate|trainee|apprentice)\b/.test(titleLower)) {
    score += 5;
  }

  // Senior penalty
  if (/\b(senior|sr\.?|lead|principal|director|vp|vice president|head of|chief|staff)\b/.test(titleLower)) {
    score -= 20;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

// Simple dedup
function dedup(jobs: Job[]): Job[] {
  const seen = new Set<string>();
  return jobs.filter(j => {
    const key = `${j.title.toLowerCase().replace(/[^a-z0-9]/g, '')}|${j.company.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { resumeText, location } = body;

    if (!resumeText || typeof resumeText !== 'string' || resumeText.length < 50) {
      return NextResponse.json({ error: 'Resume text is required' }, { status: 400 });
    }

    // 1. Extract profile via AI
    const profile = await aiExtractProfile(resumeText);
    const skills = profile?.hard_skills || [];
    const roles = profile?.roles || [];
    const searchKeywords = profile?.search_keywords || [];
    
    const keywords = searchKeywords.length > 0
      ? searchKeywords
      : [...skills, ...roles].slice(0, 6);

    console.log(`[Search] Skills: ${skills.join(', ')}`);
    console.log(`[Search] Roles: ${roles.join(', ')}`);
    console.log(`[Search] Keywords: ${keywords.join(', ')}`);

    // 2. Fetch jobs — join keywords into a single string
    const query = keywords.join(' ');
    console.log(`[Search] Query: "${query}"`);

    const allJobs = await aggregateJobs(query, location || undefined);
    const jobCount = allJobs?.length || 0;
    console.log(`[Search] Fetched ${jobCount} jobs`);

    if (!allJobs || jobCount === 0) {
      return NextResponse.json({
        jobs: [], skills, softSkills: profile?.soft_skills || [],
        roles, total: 0,
      });
    }

    // 3. Deduplicate
    const deduped = dedup(allJobs);
    console.log(`[Search] After dedup: ${deduped.length}`);

    // 4. Score ALL jobs
    const scored = deduped.map(job => ({
      ...job,
      matchScore: scoreJob(job, { hard_skills: skills, soft_skills: [], roles, industry: profile?.industry || '', experience_level: profile?.experience_level || 'entry', search_keywords: [] }),
    }));

    // 5. Sort by score descending
    scored.sort((a, b) => b.matchScore - a.matchScore);

    // 6. Count how many scored above threshold
    const goodMatches = scored.filter(j => j.matchScore >= 15);
    console.log(`[Search] Good matches (>=15%): ${goodMatches.length}`);
    if (goodMatches.length > 0) {
      console.log(`[Search] Top 3: ${goodMatches.slice(0, 3).map(j => `${j.title} (${j.matchScore}%)`).join(', ')}`);
    }

    // 7. KEY FIX: If we have jobs but none scored well,
    // still return the top 20 so the user sees SOMETHING
    const resultJobs = goodMatches.length >= 5
      ? goodMatches.slice(0, 50)
      : scored.slice(0, 20); // Fallback: show top 20 even if low scores

    console.log(`[Search] Returning ${resultJobs.length} jobs`);

    return NextResponse.json({
      success: true,
      jobs: resultJobs,
      skills,
      softSkills: profile?.soft_skills || [],
      roles,
      total: scored.length,
    });
  } catch (error) {
    console.error('[Search] Error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
