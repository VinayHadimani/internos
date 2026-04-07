# INTERNS PROJECT COMPLETE AI-READABLE EXPLANATION
This document is designed to be 100% understandable by any AI. No context missing. All structures, relationships, flows and implementations are defined exactly.

---

## 🔹 PROJECT IDENTITY
Name: `internos`
Type: Next.js 16 Full Stack Web Application
Purpose: Internship scraping, matching & AI resume tailoring platform
Framework: Next.js 16.2.1 + React 19 + TypeScript + Supabase + Tailwind v4
Last Updated: 06-Apr-2026

---

## 🔹 FULL DEPENDENCY LIST (package.json)
```json
{
  "dependencies": {
    "@supabase/ssr": "^0.9.0",
    "@supabase/supabase-js": "^2.100.0",
    "axios": "^1.14.0",
    "cheerio": "^1.2.0",
    "framer-motion": "^12.38.0",
    "html2canvas": "^1.4.1",
    "jspdf": "^4.2.1",
    "lucide-react": "^1.7.0",
    "next": "16.2.1",
    "pdf-parse": "^2.4.5",
    "playwright": "^1.59.1",
    "razorpay": "^2.9.6",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "unpdf": "^1.4.0",
    "z-ai-web-dev-sdk": "^0.0.17"
  }
}
```

---

## 🔹 DIRECTORY STRUCTURE MAP
```
internos/
├── app/                      # Next.js App Router
│   ├── api/admin/scraper/route.ts    ✅ SCRAPER API ENDPOINT
│   ├── auth/
│   ├── admin/
│   ├── dashboard/
│   ├── internships/
│   ├── profile/
│   ├── tailor/
│   ├── tracker/
│   └── pricing/
├── lib/
│   ├── scraper/
│   │   ├── browser.ts                ✅ HTTP SCRAPER CLIENT
│   │   ├── internship-scraper.ts     ✅ MAIN SCRAPER LOGIC
│   │   └── extractor.ts              ⚙️ AI EXTRACTOR (hidden)
│   ├── supabase/
│   │   └── admin.ts                  ✅ ADMIN DATABASE CLIENT
│   ├── matching/
│   ├── scrapers/
│   └── limits.ts
├── components/
├── hooks/
├── contexts/
├── constants/
├── types/
│   └── database.ts                   ✅ FULL DATABASE SCHEMA
├── supabase/
└── public/
```

---

## 🔹 CORE MODULE 1: SCRAPER BROWSER (`lib/scraper/browser.ts`)
### Purpose: Low level HTTP client for scraping websites
```typescript
CONSTANTS:
  HEADERS: Standard browser user agent headers (Chrome 120)
  Timeout: 30000ms
  Max Redirects: 5

FUNCTION: scrapeUrl(url: string): Promise<string>
  INPUT: Any valid URL
  OUTPUT: Raw HTML string
  BEHAVIOUR: Throws error on failure, logs errors, handles gzip compression
```

---

## 🔹 CORE MODULE 2: INTERNSHIP SCRAPER (`lib/scraper/internship-scraper.ts`)
### Purpose: Orchestrates scraping across all internship sources

#### CONFIGURED SOURCES:
| Source     | Base URL                              | Categories Scraped |
|------------|---------------------------------------|--------------------|
| Internshala| https://internshala.com/internships   | python, web-development, data-science, marketing, design |
| Unstop     | https://unstop.com/internships        | engineering, marketing, design |

#### INTERFACE: ScrapedInternship
| Field        | Type          | Description |
|--------------|---------------|-------------|
| title        | string        | Internship position name |
| company      | string        | Hiring company |
| location     | string        | Location |
| stipend      | string        | Stipend amount/range |
| duration     | string/null   | Duration of internship |
| description  | string        | Full description |
| skills       | string[]      | Required skills |
| link         | string        | Original URL |
| deadline     | string/null   | Application deadline |
| source       | string        | Source platform |

#### PUBLIC FUNCTIONS:
1.  `scrapeAllInternships(apiKey: string): Promise<{ internships: ScrapedInternship[], errors: string[] }>`
    - Runs all sources and all categories
    - Adds 2000ms delay between requests
    - Normalizes all fields with defaults
    - Collects errors instead of failing whole operation

2.  `scrapeSingleUrl(url: string, apiKey: string): Promise<ScrapedInternship[]>`
    - Scrapes single page only
    - Returns normalized internship objects

---

## 🔹 CORE MODULE 3: SUPABASE ADMIN CLIENT (`lib/supabase/admin.ts`)
### Purpose: Privileged database client for server side operations
```typescript
FUNCTION: createAdminClient()
  INPUT: None (uses env vars)
  OUTPUT: Fully typed Supabase client with SERVICE_ROLE privileges
  ENV VARS REQUIRED:
    - NEXT_PUBLIC_SUPABASE_URL
    - SUPABASE_SERVICE_KEY
```

---

## 🔹 CORE MODULE 4: SCRAPER API ENDPOINT (`app/api/admin/scraper/route.ts`)
### HTTP Endpoint: `POST /api/admin/scraper`

#### FLOW DIAGRAM:
```
1.  Check GROQ_API_KEY environment variable exists
2.  Hardcoded test URL: https://internshala.com/internships/python
3.  Call scrapeSingleUrl() with GROQ API key
4.  Create admin Supabase client
5.  FOR EACH internship (first 10 only):
    5.1 Check if already exists in database using `external_url` unique check
    5.2 If exists: increment skipped counter
    5.3 If new: INSERT into `internships` table
    5.4 Set posted_date = today's date
    5.5 Set is_active = true
6.  Return result: { success, scraped, added, skipped }
```

#### LIMITATIONS:
- Currently only scrapes 1 test URL
- Only processes first 10 results to avoid Vercel timeout limits
- Duplicate check uses external_url field

---

## 🔹 FULL DATABASE SCHEMA (`types/database.ts`)
### DATABASE: `public` schema tables:

---

#### TABLE 1: `profiles`
User profile data - 1:1 with Supabase Auth users
| Field          | Type         |
|----------------|--------------|
| id             | uuid         | PRIMARY KEY (matches auth user id)
| full_name      | string       |
| email          | string       |
| college_name   | string       |
| phone          | string       |
| skills         | string[]     |
| avatar_url     | string       |
| created_at     | timestamp    |
| updated_at     | timestamp    |

---

#### TABLE 2: `internships`
All scraped internships stored here
| Field          | Type         |
|----------------|--------------|
| id             | uuid         | AUTO
| title          | string       |
| company        | string       |
| location       | string       |
| stipend        | string       |
| duration       | string       |
| description    | text         |
| skills_required| string[]     |
| source         | string       |
| external_url   | string       | ✅ UNIQUE KEY
| posted_date    | date         |
| deadline       | date         |
| is_active      | boolean      |
| created_at     | timestamp    |

---

#### TABLE 3: `resumes`
User uploaded resumes
| Field          | Type         |
|----------------|--------------|
| id             | uuid         |
| user_id        | uuid         |
| file_name      | string       |
| file_url       | string       |
| original_text  | text         |
| created_at     | timestamp    |

---

#### TABLE 4: `tailored_resumes`
AI generated tailored resumes for specific internships
| Field                  | Type         |
|------------------------|--------------|
| id                     | uuid         |
| user_id                | uuid         |
| resume_id              | uuid         |
| internship_id          | uuid         |
| original_resume_text   | text         |
| tailored_resume_text   | text         |
| job_description        | text         |
| match_score            | number       | 0-100
| missing_skills         | string[]     |
| suggestions            | string[]     |
| created_at             | timestamp    |

---

#### TABLE 5: `applications`
User internship application tracking
| Field                  | Type         |
|------------------------|--------------|
| id                     | uuid         |
| user_id                | uuid         |
| internship_id          | uuid         |
| resume_id              | uuid         |
| tailored_resume_id     | uuid         |
| status                 | string       |
| notes                  | text         |
| applied_at             | timestamp    |

---

#### TABLE 6: `subscriptions`
User plan and payment information
| Field                  | Type         |
|------------------------|--------------|
| id                     | uuid         |
| user_id                | uuid         |
| plan                   | string       |
| tailor_count           | number       |
| tailor_limit           | number       |
| razorpay_customer_id   | string       |
| razorpay_subscription_id| string      |
| current_period_start   | timestamp    |
| current_period_end     | timestamp    |
| is_active              | boolean      |

---

#### TABLE 7: `usage_logs`
Audit log for all user actions
| Field          | Type         |
|----------------|--------------|
| id             | uuid         |
| user_id        | uuid         |
| action         | string       |
| metadata       | json         |
| created_at     | timestamp    |

---

## 🔹 DATA FLOW MAP FOR SCRAPER
```
✅ START: POST /api/admin/scraper
       ↓
✅ scrapeSingleUrl(testUrl, GROQ_API_KEY)
       ↓
✅ scrapeUrl() -> returns raw HTML
       ↓
✅ extractInternships(html, apiKey) -> AI extracts structured data
       ↓
✅ Normalize fields with default values
       ↓
✅ For each internship:
       ├─ Check existence in database by external_url
       ├─ If new: INSERT into internships table
       └─ Else: skip
       ↓
✅ Return statistics
```

---

## 🔹 REQUIRED ENVIRONMENT VARIABLES
| Variable Name               | Purpose |
|-----------------------------|---------|
| NEXT_PUBLIC_SUPABASE_URL    | Public Supabase endpoint |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Public client key |
| SUPABASE_SERVICE_KEY        | Admin full access key |
| GROQ_API_KEY                | AI LLM API key for extraction |

---

## 🔹 CURRENT IMPLEMENTATION STATUS
✅ Working:
- Scraper HTTP client
- Internship scraper logic
- Database admin client
- Scraper API endpoint
- Duplicate detection
- Full database schema
- All types defined

⏳ Not implemented / partial:
- Full multi-source scraping (only test url active)
- Scheduled cron jobs
- AI resume tailoring logic
- Matching algorithm
- Payment integration

---

## 🔹 END OF DOCUMENT
All structures, interfaces, flows, relationships, fields, types and functionality are completely defined here. No external context required. Any AI can understand and work on this project using only this document.