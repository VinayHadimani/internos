import { load } from 'cheerio';

export async function extractWithAI(
  html: string,
  prompt: string,
  apiKey: string
): Promise<{ success: boolean; data: any; error?: string }> {
  const $ = load(html);

  const title = $('title').text();
  const allText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 12000);

  const systemPrompt = `You are an expert web data extractor. Extract structured data from webpages.

RULES:
1. Return ONLY valid JSON (no markdown, no explanation)
2. If data not found, use null or empty array
3. Extract ALL matching items (not just first)
4. Clean up data (remove extra whitespace, fix formatting)`;

  const userPrompt = `Webpage: ${title}

Content:
 ${allText}

REQUEST: ${prompt}

Return ONLY valid JSON.`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      return { success: false, data: null, error: 'AI request failed' };
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      return { success: false, data: null, error: 'No AI response' };
    }

    const cleanContent = content.replace(/\`\`\`json\n?|\`\`\`\n?/g, '').trim();
    const extractedData = JSON.parse(cleanContent);

    return { success: true, data: extractedData };
  } catch (error: any) {
    return { success: false, data: null, error: error.message };
  }
}

export async function extractInternships(html: string, apiKey: string): Promise<any[]> {
  const result = await extractWithAI(
    html,
    `Extract all internship/job listings. Return JSON array:
[{
  "title": "Job title",
  "company": "Company name",
  "location": "City or Remote",
  "stipend": "Salary/stipend amount",
  "duration": "Duration if mentioned",
  "skills": ["skill1", "skill2"],
  "description": "Brief description",
  "link": "URL to apply",
  "deadline": "Application deadline"
}]`,
    apiKey
  );

  if (!result.success) return [];
  if (Array.isArray(result.data)) return result.data;
  if (result.data?.internships) return result.data.internships;
  if (result.data?.jobs) return result.data.jobs;

  return [];
}

export async function extractSkillsFromJD(description: string, apiKey: string): Promise<string[]> {
  if (!description) return [];

  const result = await extractWithAI(
    description,
    `Extract all technical skills and requirements from this job description. Return JSON array of skill names only: ["skill1", "skill2"]`,
    apiKey
  );

  if (!result.success || !Array.isArray(result.data)) return [];
  return result.data;
}
