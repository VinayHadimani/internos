/**
 * Builds JSON for ReportLab resume PDF (two-column layout).
 * Parses tailored free-text when structured sections are missing.
 */

export interface ResumeEducation {
  degree: string;
  school: string;
  year: string;
  details?: string;
}

export interface ResumeProject {
  name: string;
  bullets: string[];
  tech: string[];
  date?: string;
}

export interface ResumeExperience {
  title: string;
  company: string;
  duration: string;
  bullets: string[];
}

export interface ResumePdfPayload {
  name: string;
  jobTitle: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  kaggle?: string;
  skills: string[];
  skillCategories?: { category: string; items: string[] }[];
  certifications: string[];
  achievements: string[];
  summary: string;
  education: ResumeEducation[];
  projects: ResumeProject[];
  experience: ResumeExperience[];
  /** Unparsed remainder shown under Experience if needed */
  experienceNarrative?: string;
}

const HEADER_SOURCE =
  '^(PROFESSIONAL\\s+SUMMARY|SUMMARY|OBJECTIVE|WORK\\s+EXPERIENCE|EXPERIENCE|EMPLOYMENT|EDUCATION|ACADEMIC|PROJECTS?|SKILLS|TECHNICAL\\s+SKILLS|CERTIFICATIONS?|ACHIEVEMENTS?|AWARDS?|CONTACT)\\s*:?\\s*$';

function splitSections(raw: string): Map<string, string> {
  const text = raw.replace(/\r\n/g, '\n').trim();
  const map = new Map<string, string>();
  const re = new RegExp(HEADER_SOURCE, 'gim');
  const matches: { key: string; index: number; headerLen: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const key = m[1].toUpperCase().replace(/\s+/g, ' ');
    matches.push({ key, index: m.index, headerLen: m[0].length });
  }
  if (matches.length === 0) {
    map.set('SUMMARY', text);
    return map;
  }
  const pre = text.slice(0, matches[0].index).trim();
  if (pre) map.set('_PREAMBLE', pre);

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i].headerLen;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    map.set(matches[i].key, text.slice(start, end).trim());
  }
  return map;
}

function firstLineName(text: string, preamble?: string): string {
  const src = preamble?.trim() || text;
  const lines = src.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 6)) {
    if (line.length > 60 || line.includes('@') || /^(http|www\.)/i.test(line)) continue;
    if (/^(PROFESSIONAL|SUMMARY|EXPERIENCE|EDUCATION|PROJECTS|SKILLS)/i.test(line)) continue;
    if (/^[•\-\*]/.test(line)) continue;
    return line;
  }
  return 'Candidate';
}

function extractContact(text: string): Pick<ResumePdfPayload, 'email' | 'phone' | 'location'> {
  const email = text.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0];
  const phone = text.match(/\+?\d[\d\s().-]{8,}\d/)?.[0]?.trim();
  const locLine = text.split('\n').find((l) => /,\s*[A-Z][a-z]+/.test(l) && l.length < 80 && !l.includes('@'));
  return { email, phone, location: locLine?.trim() };
}

function parseExperienceBlock(block: string): ResumeExperience[] {
  if (!block.trim()) return [];
  const chunks = block.split(/\n{2,}/).map((c) => c.trim()).filter(Boolean);
  const out: ResumeExperience[] = [];
  for (const ch of chunks) {
    const lines = ch.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    const title = lines[0];
    let company = '';
    let duration = '';
    const bullets: string[] = [];
    if (lines[1]) {
      const m = lines[1].match(/^(.+?)\s*[|·]\s*(.+)$/) || lines[1].match(/^(.+?)\s+(\d{4}\s*[-–]\s*.+)$/);
      if (m) {
        company = m[1].trim();
        duration = m[2].trim();
      } else {
        company = lines[1];
      }
    }
    for (let i = 2; i < lines.length; i++) {
      const b = lines[i].replace(/^[•\-\*]\s*/, '').trim();
      if (b) bullets.push(b);
    }
    if (bullets.length === 0 && lines.length > 1) {
      for (let i = 2; i < lines.length; i++) bullets.push(lines[i]);
    }
    out.push({ title, company, duration, bullets });
  }
  if (out.length === 0 && block.trim()) {
    return [{ title: 'Experience', company: '', duration: '', bullets: [block.trim().slice(0, 2000)] }];
  }
  return out;
}

function parseEducationBlock(block: string): ResumeEducation[] {
  if (!block.trim()) return [];
  const chunks = block.split(/\n{2,}/).map((c) => c.trim()).filter(Boolean);
  return chunks.map((ch) => {
    const lines = ch.split('\n').map((l) => l.trim()).filter(Boolean);
    const degree = lines[0] || 'Program';
    const school = lines[1] || '';
    const year = lines.find((l) => /\d{4}/.test(l)) || '';
    const details = lines.slice(2).filter((l) => l !== year).join(' ');
    return { degree, school, year, details };
  });
}

function parseProjectsBlock(block: string): ResumeProject[] {
  if (!block.trim()) return [];
  const chunks = block.split(/\n{2,}/).map((c) => c.trim()).filter(Boolean);
  return chunks.map((ch) => {
    const lines = ch.split('\n').map((l) => l.trim()).filter(Boolean);
    const name = lines[0] || 'Project';
    const bullets: string[] = [];
    const tech: string[] = [];
    let date = '';
    for (let i = 1; i < lines.length; i++) {
      const l = lines[i];
      if (/tech|stack|tools/i.test(l) && /:/.test(l)) {
        tech.push(
          ...l
            .split(':')[1]
            .split(/[,|]/)
            .map((s) => s.trim())
            .filter(Boolean)
        );
      } else if (/^\d{4}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/i.test(l) && l.length < 40) {
        date = l;
      } else if (/^[•\-\*]/.test(l)) {
        bullets.push(l.replace(/^[•\-\*]\s*/, ''));
      } else {
        bullets.push(l);
      }
    }
    return { name, bullets, tech, date };
  });
}

function parseSkillsBlock(block: string): string[] {
  const parts = block.split(/[,|•\n]/).map((s) => s.trim()).filter(Boolean);
  return [...new Set(parts)].slice(0, 40);
}

export function buildResumePdfPayloadFromText(
  tailoredText: string,
  meta: {
    jobTitle?: string;
    skills?: string[];
    nameHint?: string;
  }
): ResumePdfPayload {
  const sections = splitSections(tailoredText);
  const preamble = sections.get('_PREAMBLE');
  if (preamble) sections.delete('_PREAMBLE');
  const contact = extractContact(tailoredText);
  const name =
    meta.nameHint?.trim() ||
    firstLineName(tailoredText, preamble) ||
    'Candidate';
  const jobTitle = meta.jobTitle?.trim() || 'Professional';

  const summary =
    sections.get('SUMMARY') ||
    sections.get('PROFESSIONAL SUMMARY') ||
    sections.get('OBJECTIVE') ||
    '';

  let experience = parseExperienceBlock(
    sections.get('WORK EXPERIENCE') || sections.get('EXPERIENCE') || sections.get('EMPLOYMENT') || ''
  );
  const education = parseEducationBlock(sections.get('EDUCATION') || sections.get('ACADEMIC') || '');
  const projects = parseProjectsBlock(sections.get('PROJECT') || sections.get('PROJECTS') || '');
  const fromSection = parseSkillsBlock(sections.get('SKILLS') || sections.get('TECHNICAL SKILLS') || '');
  const skills = [...new Set([...(meta.skills || []), ...fromSection])].slice(0, 45);

  const certifications = (sections.get('CERTIFICATION') || sections.get('CERTIFICATIONS') || '')
    .split('\n')
    .map((l) => l.replace(/^[✦•\-\*]\s*/, '').trim())
    .filter(Boolean);

  const achievements = (sections.get('ACHIEVEMENT') || sections.get('ACHIEVEMENTS') || sections.get('AWARDS') || '')
    .split('\n')
    .map((l) => l.replace(/^[✦•\-\*]\s*/, '').trim())
    .filter(Boolean);

  const linkedin = tailoredText.match(/https?:\/\/(www\.)?linkedin\.com\/[^\s)]+/i)?.[0];
  const github = tailoredText.match(/https?:\/\/(www\.)?github\.com\/[^\s)]+/i)?.[0];
  const kaggle = tailoredText.match(/https?:\/\/(www\.)?kaggle\.com\/[^\s)]+/i)?.[0];

  let experienceNarrative: string | undefined;
  if (experience.length === 0 && tailoredText.length > 0) {
    experienceNarrative = tailoredText.slice(0, 8000);
  }

  return {
    name,
    jobTitle,
    ...contact,
    linkedin,
    github,
    kaggle,
    skills,
    certifications,
    achievements,
    summary: summary || tailoredText.slice(0, 1200),
    education,
    projects,
    experience,
    experienceNarrative,
  };
}
