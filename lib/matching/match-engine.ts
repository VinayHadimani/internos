import { StudentProfile } from "../resume-parser";

export interface JobListing {
  title: string;
  company: string;
  location: string;
  description: string;
  requirements: string[];
  role_type?: "internship" | "entry-level" | "junior" | "mid-level" | "senior" | "lead" | "manager";
  stipend?: boolean;
  structured_learning?: boolean;
}

export interface MatchedListing {
  title: string;
  company: string;
  location: string;
  role_type: "internship" | "entry-level" | "junior" | "mid-level";
  match_score: number;
  score_breakdown: {
    skill_overlap: number;
    seniority_fit: number;
    location_fit: number;
    domain_fit: number;
  };
  matched_skills: string[];
  missing_skills: string[];
  why_apply: string;
  apply_priority: "high" | "medium" | "low";
  red_flags: string[];
}

export function matchJobListings(studentProfile: StudentProfile, listings: JobListing[]): MatchedListing[] {
  const matchedResults: MatchedListing[] = [];

  for (const listing of listings) {
    const redFlags: string[] = [];
    let discard = false;

    // HARD FILTERS
    const titleLower = listing.title.toLowerCase();
    const seniorKeywords = ["senior", "sr.", "staff", "lead", "manager", "director", "principal", "head of", "vp", "chief", "architect"];
    if (seniorKeywords.some(keyword => titleLower.includes(keyword))) {
      discard = true;
      redFlags.push("Role title indicates senior level.");
    }

    const experienceRequirementMatch = listing.requirements.join(" ").match(/(\d+)\+\s*years\s*experience/i);
    if (experienceRequirementMatch) {
      const years = parseInt(experienceRequirementMatch[1]);
      if (years >= 2) {
        discard = true;
        redFlags.push(`Requires ${years}+ years experience.`);
      }
    }

    // Assuming a simple check for completed degree requirement for now.
    // A more robust implementation would involve checking the student's graduation_year against the job's requirement.
    if (listing.requirements.join(" ").toLowerCase().includes("completed degree required") && studentProfile.education.graduation_year > new Date().getFullYear()) {
      discard = true;
      redFlags.push("Requires a completed degree.");
    }

    if (listing.requirements.join(" ").toLowerCase().includes("full-time permanent") && !listing.title.toLowerCase().includes("intern")) {
      discard = true;
      redFlags.push("Is a full-time permanent role with no student pathway.");
    }

    // Location check
    if (studentProfile.availability.remote_only && !listing.description.toLowerCase().includes("remote")) {
      discard = true;
      redFlags.push("Student requires remote only, but job is not remote-friendly.");
    } else if (listing.location.toLowerCase() !== studentProfile.availability.location.toLowerCase() && !listing.description.toLowerCase().includes("remote")) {
        // More sophisticated location matching would be needed for country/city checks
        // For now, a direct string comparison for location
        // Discard if on-site and location doesn't match and not remote friendly
        discard = true;
        redFlags.push("Location mismatch and not remote-friendly.");
    }

    if (discard) {
      continue; // Discard this listing
    }

    // SOFT BOOST and SCORING BREAKDOWN
    let skillOverlapScore = 0;
    let seniorityFitScore = 0;
    let locationFitScore = 0;
    let domainFitScore = 0;
    let totalMatchScore = 0;

    const matchedSkills: string[] = [];
    const missingSkills: string[] = [];
    const allStudentSkills = [
      ...studentProfile.verified_skills.languages,
      ...studentProfile.verified_skills.frameworks,
      ...studentProfile.verified_skills.tools,
      ...studentProfile.verified_skills.ai_ml,
    ];

    // Skill Overlap Scoring
    let skillMatchCount = 0;
    const listingSkills = listing.requirements.join(" ").toLowerCase().split(/[,\s\/\.]+/).filter(s => s.length > 1);
    for (const studentSkill of allStudentSkills) {
      if (listingSkills.some(ls => ls.includes(studentSkill.toLowerCase()))) {
        skillMatchCount++;
        matchedSkills.push(studentSkill);
      }
    }
    for (const listingSkill of listingSkills) {
      if (!allStudentSkills.some(ss => ss.toLowerCase().includes(listingSkill))) {
        missingSkills.push(listingSkill);
      }
    }

    if (skillMatchCount >= 4) skillOverlapScore = 40;
    else if (skillMatchCount === 3) skillOverlapScore = 30;
    else if (skillMatchCount === 2) skillOverlapScore = 20;
    else if (skillMatchCount === 1) skillOverlapScore = 10;
    else skillOverlapScore = 0;

    // ── HARD SKILL BONUS (Blocker 3) ──
    // Give extra weight to domain-specific skills. Soft skills match everything and add no signal.
    const softSkillPatterns = /^(communication|teamwork|leadership|organisation|organization|numeracy|problem.?solving|time.?management|interpersonal|adaptability|critical.?thinking|attention.?to.?detail|presentation|negotiation|customer service)$/i;
    const hardSkills = allStudentSkills.filter(s => !softSkillPatterns.test(s.toLowerCase().trim()));

    if (hardSkills.length > 0) {
      // If user HAS hard skills, penalize jobs that don't contain ANY of them in title or description
      const hasHardMatch = hardSkills.some(hs => {
        const lower = hs.toLowerCase().trim();
        return listing.title.toLowerCase().includes(lower) || listing.description.toLowerCase().includes(lower);
      });
      if (!hasHardMatch) {
        skillOverlapScore -= 20; // Significant penalty for no hard skill match
      } else {
        skillOverlapScore += 5; // Small bonus for hard skill match
      }
    }

    // Seniority Fit Scoring
    let inferredRoleType: MatchedListing["role_type"] = "junior"; // Default to junior if nothing specific
    if (["intern", "internship", "trainee", "co-op", "fresher", "entry level", "apprentice", "student developer"].some(keyword => titleLower.includes(keyword))) {
      seniorityFitScore = 25;
      inferredRoleType = "internship";
    } else if (["junior", "new grad"].some(keyword => titleLower.includes(keyword))) {
      seniorityFitScore = 18;
      inferredRoleType = "junior";
    } else if (listing.requirements.join(" ").toLowerCase().includes("0-1 years") || listing.requirements.join(" ").toLowerCase().includes("no experience required") || listing.description.toLowerCase().includes("currently pursuing degree welcome")) {
      seniorityFitScore = 25; // Treat as entry-level
      inferredRoleType = "entry-level";
    } else if (["mid-level"].some(keyword => titleLower.includes(keyword))) {
      seniorityFitScore = 8;
      inferredRoleType = "mid-level";
    } else {
        seniorityFitScore = 8; // Default to mid-level if no clear indicators for students
        inferredRoleType = "mid-level";
    }

    // Location Fit Scoring
    if (studentProfile.availability.remote_only && listing.description.toLowerCase().includes("remote")) {
      locationFitScore = 20;
    } else if (!studentProfile.availability.remote_only && listing.location.toLowerCase() === studentProfile.availability.location.toLowerCase()) {
      locationFitScore = 20;
    } else if (!studentProfile.availability.remote_only && listing.description.toLowerCase().includes("remote")) {
        locationFitScore = 10; // Student is flexible, job is remote
    } else {
      locationFitScore = 0;
    }

    // Domain/Interest Alignment (placeholder - needs studentProfile.verified_skills.domains)
    // For now, a very basic check against job description
    let domainMatchCount = 0;
    const allStudentDomains = studentProfile.verified_skills.domains.map(d => d.toLowerCase());
    const descriptionLower = listing.description.toLowerCase();
    for (const domain of allStudentDomains) {
      if (descriptionLower.includes(domain)) {
        domainMatchCount++;
      }
    }
    if (domainMatchCount > 0) domainFitScore = Math.min(domainMatchCount * 5, 15); // Max 15
    else domainFitScore = 0;

    // Total Score Calculation
    totalMatchScore = skillOverlapScore + seniorityFitScore + locationFitScore + domainFitScore;

    // IMPORTANT: If seniority score = 0, CAP total score at 25
    if (seniorityFitScore === 0) {
        totalMatchScore = Math.min(totalMatchScore, 25);
    }

    // Why Apply & Apply Priority
    let whyApply = "This role aligns well with your profile.";
    let applyPriority: MatchedListing["apply_priority"] = "low";

    if (seniorityFitScore === 25 && skillOverlapScore >= 20) {
      applyPriority = "high";
      whyApply = "This is a great match! The role is entry-level/internship and aligns with your skills.";
    } else if (seniorityFitScore >= 18 && skillOverlapScore >= 10) {
      applyPriority = "medium";
      whyApply = "A good potential match, offering relevant experience and skill overlap.";
    }

    matchedResults.push({
      title: listing.title,
      company: listing.company,
      location: listing.location,
      role_type: inferredRoleType,
      match_score: totalMatchScore,
      score_breakdown: {
        skill_overlap: skillOverlapScore,
        seniority_fit: seniorityFitScore,
        location_fit: locationFitScore,
        domain_fit: domainFitScore
      },
      matched_skills: matchedSkills,
      missing_skills: missingSkills.filter((value, index, self) => self.indexOf(value) === index), // Deduplicate
      why_apply: whyApply,
      apply_priority: applyPriority,
      red_flags: redFlags,
    });
  }

  // FINAL OUTPUT ORDER
  matchedResults.sort((a, b) => {
    const priorityOrder = { "high": 3, "medium": 2, "low": 1 };
    if (priorityOrder[a.apply_priority] !== priorityOrder[b.apply_priority]) {
      return priorityOrder[b.apply_priority] - priorityOrder[a.apply_priority];
    }
    return b.match_score - a.match_score;
  });

  // NEVER show a senior/manager role in top 10 results (already handled by hard filters and seniority score cap)

  return matchedResults;
}
