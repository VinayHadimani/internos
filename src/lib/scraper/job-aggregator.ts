import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  source: string;
  postedAt: string;
  salary?: string;
  skills?: string[];
}

export interface JobProvider {
  name: string;
  search: (query: string) => Promise<Job[]>;
}

/**
 * JobAggregator is the core engine that searches multiple job APIs
 * and aggregates results into a unified format.
 */
export class JobAggregator {
  private providers: JobProvider[] = [];

  constructor(providers: JobProvider[] = []) {
    this.providers = providers;
  }

  public addProvider(provider: JobProvider) {
    this.providers.push(provider);
  }

  /**
   * Searches all configured providers for jobs matching the query.
   * Uses AI to potentially optimize the search query first.
   */
  async search(query: string): Promise<Job[]> {
    // Use AI to expand the query for better results across different APIs
    // This ensures we capture synonyms and related roles
    const expandedQueries = await this.expandQueryWithAI(query);
    
    const allJobsPromises = expandedQueries.flatMap(q => 
      this.providers.map(provider => 
        provider.search(q).catch(err => {
          console.error(`Provider ${provider.name} failed for query "${q}":`, err);
          return [];
        })
      )
    );

    const results = await Promise.all(allJobsPromises);
    const flattenedJobs = results.flat();

    // Deduplicate jobs based on URL or a combination of title and company
    return this.deduplicate(flattenedJobs);
  }

  private async expandQueryWithAI(query: string): Promise<string[]> {
    try {
      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "You are a job search expert. Expand the user's job query into 3-5 diverse but relevant search strings that would work well across different job boards (e.g., LinkedIn, Indeed, Glassdoor). Return ONLY valid JSON."
          },
          {
            role: "user",
            content: `Expand this job query: "${query}". Return JSON: {"queries": ["string1", "string2"]}`
          }
        ],
        response_format: { type: "json_object" }
      });

      const content = response.choices[0].message.content;
      if (!content) return [query];
      
      const parsed = JSON.parse(content);
      const queries = parsed.queries || parsed.expanded_queries || (Array.isArray(parsed) ? parsed : [query]);
      
      return Array.isArray(queries) ? queries : [queries, query];
    } catch (error) {
      console.error("AI query expansion failed, using original query:", error);
      return [query];
    }
  }

  private deduplicate(jobs: Job[]): Job[] {
    const seen = new Set<string>();
    return jobs.filter(job => {
      const key = job.url || `${job.title}-${job.company}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

// Export a default instance with no providers initially, 
// allowing them to be registered during app initialization.
export const jobAggregator = new JobAggregator();

/**
 * Convenience function to aggregate jobs for a given query.
 */
export async function aggregateJobs(query: string): Promise<Job[]> {
  return jobAggregator.search(query);
}