// Skill aliases — variations that should match
const SKILL_ALIASES: Record<string, string[]> = {
  'js': ['javascript', 'ecmascript'],
  'javascript': ['js', 'ecmascript'],
  'ts': ['typescript'],
  'typescript': ['ts'],
  'react': ['reactjs', 'react.js', 'reactjs'],
  'react native': ['reactnative', 'react-native'],
  'node': ['nodejs', 'node.js'],
  'node.js': ['node', 'nodejs'],
  'next': ['nextjs', 'next.js'],
  'python': ['py', 'python3'],
  'cpp': ['c++', 'cplusplus'],
  'csharp': ['c#', 'c sharp'],
  'postgres': ['postgresql', 'psql'],
  'mongo': ['mongodb'],
  'sql': ['mysql', 'postgresql', 'postgres', 'sqlite'],
  'aws': ['amazon web services', 'amazon aws'],
  'gcp': ['google cloud', 'google cloud platform'],
  'azure': ['microsoft azure'],
  'docker': ['containerization'],
  'k8s': ['kubernetes'],
  'kubernetes': ['k8s'],
  'git': ['github', 'gitlab', 'version control'],
  'html': ['html5', 'html 5'],
  'css': ['css3', 'css 3', 'scss', 'sass'],
  'tailwind': ['tailwindcss', 'tailwind css'],
  'figma': ['figma design'],
  'rest': ['restful', 'rest api', 'restful api'],
  'graphql': ['graph ql'],
  'ci/cd': ['cicd', 'continuous integration', 'continuous deployment'],
  'ml': ['machine learning'],
  'ai': ['artificial intelligence'],
  'dl': ['deep learning'],
  'nlp': ['natural language processing'],
  'cv': ['computer vision'],
};

function normalize(skill: string): string {
  return skill
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9/#\s]/g, '')  // keep alphanumeric, /, #, spaces
    .replace(/\s+/g, ' ')           // collapse whitespace
    .trim();
}

function isMatch(userSkill: string, requiredSkill: string): boolean {
  const u = normalize(userSkill);
  const r = normalize(requiredSkill);

  // Direct match
  if (u === r) return true;

  // Check aliases for user skill
  const userAliases = SKILL_ALIASES[u] || [];
  if (userAliases.includes(r)) return true;

  // Check aliases for required skill
  const reqAliases = SKILL_ALIASES[r] || [];
  if (reqAliases.includes(u)) return true;

  // Check if one contains the other
  if (u.includes(r) || r.includes(u)) {
    // Only if short enough to avoid false positives
    if (r.length > 2 && u.length > 2) return true;
  }

  return false;
}

export function calculateMatchScore(
  userSkills: string[],
  requiredSkills: string[]
): number {
  if (!requiredSkills || requiredSkills.length === 0) return 100;
  if (!userSkills || userSkills.length === 0) return 0;

  const matched = requiredSkills.filter(req =>
    userSkills.some(user => isMatch(user, req))
  ).length;

  return Math.round((matched / requiredSkills.length) * 100);
}

export function findMissingSkills(
  userSkills: string[],
  requiredSkills: string[]
): string[] {
  if (!requiredSkills || requiredSkills.length === 0) return [];
  if (!userSkills || userSkills.length === 0) return [...requiredSkills];

  return requiredSkills.filter(req =>
    !userSkills.some(user => isMatch(user, req))
  );
}

export function findMatchedSkills(
  userSkills: string[],
  requiredSkills: string[]
): string[] {
  if (!requiredSkills || requiredSkills.length === 0) return [];
  if (!userSkills || userSkills.length === 0) return [];

  return requiredSkills.filter(req =>
    userSkills.some(user => isMatch(user, req))
  );
}

export function getMatchGrade(score: number): {
  grade: string;
  color: string;
  label: string;
} {
  if (score >= 90) return { grade: 'A+', color: '#22c55e', label: 'Excellent match' };
  if (score >= 80) return { grade: 'A', color: '#22c55e', label: 'Great match' };
  if (score >= 70) return { grade: 'B+', color: '#84cc16', label: 'Good match' };
  if (score >= 60) return { grade: 'B', color: '#eab308', label: 'Fair match' };
  if (score >= 50) return { grade: 'C', color: '#f97316', label: 'Below average' };
  return { grade: 'D', color: '#ef4444', label: 'Low match' };
}

export function rankInternships(
  userSkills: string[],
  internships: Array<{ id: string; skills: string[] }>
): Array<{ id: string; score: number }> {
  return internships
    .map(i => ({
      id: i.id,
      score: calculateMatchScore(userSkills, i.skills),
    }))
    .sort((a, b) => b.score - a.score);
}
