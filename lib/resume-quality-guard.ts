/**
 * Silent resume / job-text hygiene: deterministic cleanup only.
 * Applied before returning tailored resumes and after PDF extract when appropriate.
 */

const RECRUITER_LINE =
  /please\s+mention\s+the\s+word|as\s+instructed\s+.{0,80}code\s+is|to\s+show\s+i\s+read|i\s+am\s+tagging|tagging\s+\[|screening\s+tag|beta\s+feature\s+to\s+avoid\s+spam|when\s+applying\s+.{0,40}show\s+you\s+read|#\s*RMjYw|RMjYwMD:/i;

const DISCLAIMER =
  /although\s+i\s+don'?t\s+have[\s\S]{0,220}eager\s+to\s+learn|i\s+don'?t\s+have[\s\S]{0,80}experience[\s\S]{0,160}eager\s+to\s+learn|i\s+am\s+eager\s+to\s+learn[\s\S]{0,120}although/i;

const SYSTEM_LEAK =
  /as\s+an\s+ai\s+language\s+model|i\s+cannot\s+fulfill|you\s+are\s+(a\s+)?chatgpt|per\s+my\s+last\s+instructions\s+from\s+the\s+user/i;

const PLACEHOLDER = /\[(your\s+name|insert\s+[^[\]]+|email|phone|address|company|title)\]/gi;

const TODO_MARKER = /\b(TODO|TBD|FIXME|\[X\])\b/gi;

const LUXURY = /\bLUXURIOUSLY\b/gi;

const TEMPLATE_TIP = /^\(Tip:.*?\)$|^\(?Tip:.*?\)?$/i;
const TEMPLATE_NOTE = /^\(Note:.*?\)$|^\(?Note:.*?\)?$/i;
const PAGE_MARKER = /^Page\s+\d+$/i;

/** Suspicious long tokens (tracking / encoded blobs), not normal words */
const LONG_BLOB = /\b[A-Za-z0-9+/]{36,}={0,2}\b/g;

const OPENAI_SK = /\bsk-[A-Za-z0-9]{20,}\b/g;

const AWS_KEY = /\bAKIA[0-9A-Z]{16}\b/g;

const SSN_LIKE = /\b\d{3}-\d{2}-\d{4}\b/g;

function stripMarkdown(text: string): string {
  let t = text;
  t = t.replace(/^#{1,6}\s+/gm, '');
  t = t.replace(/\*\*([^*]+)\*\*/g, '$1');
  t = t.replace(/\*([^*]+)\*/g, '$1');
  t = t.replace(/__([^_]+)__/g, '$1');
  t = t.replace(/_([^_]+)_/g, '$1');
  t = t.replace(/`{1,3}[^`]*`{1,3}/g, '');
  return t;
}

/** Only collapse clearly invalid calendar years (OCR/LLM glitches). */
function stripAbsurdYears(text: string, now: Date): string {
  const y = now.getFullYear();
  return text.replace(/\b(20\d{2})\b/g, (m) => {
    const n = parseInt(m, 10);
    if (n >= 2090) return String(y);
    return m;
  });
}

function paragraphIsJunk(block: string): boolean {
  const s = block.trim();
  if (!s) return false;
  const lower = s.toLowerCase();
  if (RECRUITER_LINE.test(s)) return true;
  if (DISCLAIMER.test(lower)) return true;
  if (SYSTEM_LEAK.test(lower)) return true;
  if (/^lorem ipsum\b/i.test(s)) return true;
  if (TEMPLATE_TIP.test(s) || TEMPLATE_NOTE.test(s)) return true;
  return false;
}

function lineIsJunk(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (RECRUITER_LINE.test(t)) return true;
  if (SYSTEM_LEAK.test(t)) return true;
  if (LONG_BLOB.test(t) && !t.includes('http')) return true;
  if (TEMPLATE_TIP.test(t) || TEMPLATE_NOTE.test(t) || PAGE_MARKER.test(t)) return true;
  const low = t.toLowerCase();
  if (
    /eager\s+to\s+learn/.test(low) &&
    (/although\s+i\s+don'?t\s+have/i.test(low) || /i\s+don'?t\s+have\s+(much\s+)?experience/i.test(low))
  ) {
    return true;
  }
  return false;
}

function removeJunkParagraphs(text: string): string {
  const parts = text.split(/\n{2,}/);
  const kept = parts.filter((p) => !paragraphIsJunk(p));
  return kept.join('\n\n');
}

function removeJunkLines(text: string): string {
  return text
    .split('\n')
    .filter((ln) => !lineIsJunk(ln))
    .join('\n');
}

/**
 * Job board / ATS noise that should not be echoed into a resume.
 */
export function sanitizeJobPostingForTailor(jobText: string): string {
  let t = jobText.normalize('NFC');
  t = removeJunkLines(t);
  t = removeJunkParagraphs(t);
  t = t.replace(LONG_BLOB, ' ');
  t = t.replace(OPENAI_SK, '');
  t = t.replace(AWS_KEY, '');
  t = t.replace(/\n{3,}/g, '\n\n').trim();
  return t;
}

/**
 * Full silent guard on resume-like output (tailored resume, optional extracted PDF).
 */
export function applyResumeQualityGuard(resume: string, isResume: boolean = false, now: Date = new Date()): string {
  let t = resume.normalize('NFC');
  t = t.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  if (!isResume) {
    t = removeJunkLines(t);
    t = removeJunkParagraphs(t);
    t = t.replace(LONG_BLOB, ' ');
    t = t.replace(SSN_LIKE, '');
  } else {
    // For resumes, only strip markdown, placeholders, and TODOs
    // Keep lines/paragraphs as they might contain legitimate data
    // Keep potential phone numbers (SSN_LIKE)
  }
  
  t = t.replace(OPENAI_SK, '');
  t = t.replace(AWS_KEY, '');
  
  if (!isResume) {
    t = t.replace(PLACEHOLDER, '');
  } else {
    // Keep brackets in resumes unless they match specific placeholder patterns
    t = t.replace(/\[(your\s+name|insert\s+[^[\]]+|email|phone|address|company|title)\]/gi, '');
  }
  
  t = t.replace(TODO_MARKER, '');
  t = t.replace(LUXURY, '');
  t = stripMarkdown(t);
  t = stripAbsurdYears(t, now);
  t = t.replace(/\n{3,}/g, '\n\n').trim();
  return t;
}
