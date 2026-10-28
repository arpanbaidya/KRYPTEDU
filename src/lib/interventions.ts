import { type Scored, type Risk, dataCompleteness, SCORING_CONFIG } from "./scoring";

export type InterventionSuggestion = {
  issue: string;
  /** Which data field triggered this suggestion, or 'data_completeness' for missing-data warnings. */
  indicator: string;
  indicatorValue: number;
  threshold: number;
  action: string;
  why: string;
  followUp: string;
  priority: "High" | "Medium" | "Low";
  /** Academic, Placement, Skills, Engagement, Data Quality */
  category: string;
  requiresFacultyReview: true;
};

export function generateSuggestions(s: Scored): InterventionSuggestion[] {
  const suggestions: InterventionSuggestion[] = [];

  // Attendance
  if (s.attendance < 60) {
    suggestions.push({
      issue: "Critical attendance deficit",
      indicator: "attendance",
      indicatorValue: s.attendance,
      threshold: 60,
      action: "Schedule immediate faculty meeting to discuss attendance barriers",
      why: "Attendance below 60% correlates with academic failure risk and triggers High academic risk classification",
      followUp: "Monitor weekly attendance for 4 weeks; review again if <75%",
      priority: "High",
      category: "Attendance",
      requiresFacultyReview: true,
    });
  } else if (s.attendance < 75 && s.attendance >= 60) {
    suggestions.push({
      issue: "Attendance below institutional threshold",
      indicator: "attendance",
      indicatorValue: s.attendance,
      threshold: 75,
      action: "Faculty follow-up to identify attendance barriers",
      why: "Students below 75% attendance often face compounding academic difficulties",
      followUp: "Track attendance bi-weekly; escalate if decline continues",
      priority: "Medium",
      category: "Attendance",
      requiresFacultyReview: true,
    });
  }

  // Academic - CGPA (Authoritative Academics CGPA — only triggers when valid published results exist)
  if (s.rawCgpa !== null && s.rawCgpa !== undefined) {
    const cgpa = Number(s.rawCgpa);
    if (cgpa < 5) {
      suggestions.push({
        issue: "CGPA critically below passing threshold",
        indicator: "cgpa",
        indicatorValue: cgpa,
        threshold: 5,
        action: "Assign dedicated academic mentor for remedial support",
        why: "Authoritative Academics CGPA below 5.0 indicates severe academic difficulty requiring structured intervention",
        followUp: "Weekly mentoring sessions; reassess at mid-semester",
        priority: "High",
        category: "Academic",
        requiresFacultyReview: true,
      });
    } else if (cgpa < 6 && cgpa >= 5) {
      suggestions.push({
        issue: "Below-average academic performance",
        indicator: "cgpa",
        indicatorValue: cgpa,
        threshold: 6,
        action: "Enroll in peer tutoring or remedial coaching program",
        why: "Students with authoritative CGPA 5–6 benefit from targeted academic support before falling further",
        followUp: "Monthly CGPA tracking; check improvement at next semester",
        priority: "Medium",
        category: "Academic",
        requiresFacultyReview: true,
      });
    }
  }

  // Academic - Backlogs
  if (s.backlogs >= 2) {
    suggestions.push({
      issue: "Multiple active backlogs",
      indicator: "backlogs",
      indicatorValue: s.backlogs,
      threshold: 2,
      action: "Create structured backlog clearance plan with faculty advisor",
      why: "2+ backlogs triggers High academic risk and compounds semester difficulty",
      followUp: "Track backlog exam results; adjust plan after each attempt",
      priority: "High",
      category: "Academic",
      requiresFacultyReview: true,
    });
  } else if (s.backlogs === 1) {
    suggestions.push({
      issue: "Active backlog requiring attention",
      indicator: "backlogs",
      indicatorValue: s.backlogs,
      threshold: 1,
      action: "Schedule faculty discussion on backlog clearance timeline",
      why: "Early intervention on a single backlog prevents escalation",
      followUp: "Monitor next backlog exam result",
      priority: "Medium",
      category: "Academic",
      requiresFacultyReview: true,
    });
  }

  // LMS engagement — categorised under Academic (LMS is an academic learning activity)
  if (s.lms_activity < 45) {
    suggestions.push({
      issue: "Low LMS engagement",
      indicator: "lms_activity",
      indicatorValue: s.lms_activity,
      threshold: 45,
      action: "Verify LMS access and assign structured online learning activities",
      why: "Low LMS activity (below 45) suggests disengagement from course materials",
      followUp: "Review LMS usage logs monthly",
      priority: "Medium",
      category: "Academic",
      requiresFacultyReview: true,
    });
  }

  // Placement Risk (Independent multi-indicator model combining CGPA, skills, mock interview, readiness, attendance)
  if (s.placementRisk === "High") {
    suggestions.push({
      issue: "High placement risk detected",
      indicator: "placement_risk",
      indicatorValue: s.placementRiskScore ?? 0,
      threshold: 50,
      action: "Assign dedicated placement mentor to develop targeted career preparation roadmap",
      why: `Overall placement readiness score is ${s.placementReadinessScore ?? "—"}/100 (Risk Score: ${s.placementRiskScore ?? "—"}). Key factors: ${(s.placementRiskReasons || []).slice(0, 2).join("; ") || "Deficit across core placement metrics"}`,
      followUp: "Bi-weekly career mentoring and placement readiness review",
      priority: "High",
      category: "Placement",
      requiresFacultyReview: true,
    });
  }

  // Placement Readiness (Aptitude & preparation)
  if (s.placement_readiness < 50) {
    suggestions.push({
      issue: "Low placement readiness",
      indicator: "placement_readiness",
      indicatorValue: s.placement_readiness,
      threshold: 50,
      action: "Enroll in placement preparation program covering aptitude and professional skills",
      why: "Readiness below 50 indicates gaps in resume, aptitude, and career preparation",
      followUp: "Reassess readiness score after program completion",
      priority: "High",
      category: "Placement",
      requiresFacultyReview: true,
    });
  }

  // Skills
  if (s.skills_score < 50) {
    suggestions.push({
      issue: "Significant skill gaps identified",
      indicator: "skills_score",
      indicatorValue: s.skills_score,
      threshold: 50,
      action: "Assign coding/technical practice with mentorship",
      why: "Skills score below 50 indicates technical gaps that require dedicated practice to address",
      followUp: "Monthly skill assessment; track progress on specific competencies",
      priority: "High",
      category: "Skills",
      requiresFacultyReview: true,
    });
  }

  // Mock interview / feedback
  if (s.feedback_score < 50) {
    suggestions.push({
      issue: "Low mock interview feedback",
      indicator: "feedback_score",
      indicatorValue: s.feedback_score,
      threshold: 50,
      action: "Schedule mock interview sessions with industry mentors",
      why: "Mock interview score below 50 suggests interview communication or presentation gaps",
      followUp: "Schedule follow-up mock interviews; compare scores",
      priority: "Medium",
      category: "Placement",
      requiresFacultyReview: true,
    });
  }

  // Engagement
  if (s.engagement < 40) {
    suggestions.push({
      issue: "Low campus engagement",
      indicator: "engagement",
      indicatorValue: s.engagement,
      threshold: 40,
      action:
        "Encourage participation in clubs, events, or hackathons aligned with student interests",
      why: "Campus engagement below 40 may indicate social isolation or lack of awareness of opportunities",
      followUp: "Check engagement metrics next semester",
      priority: "Low",
      category: "Engagement",
      requiresFacultyReview: true,
    });
  }

  // Missing data warning — always check data completeness before acting
  const completeness = dataCompleteness(s);
  if (completeness.quality === "Low confidence") {
    suggestions.unshift({
      issue: "Incomplete student data",
      indicator: "data_completeness",
      indicatorValue: completeness.filled,
      threshold: completeness.total,
      action: `Verify and complete missing data fields before applying other interventions: ${completeness.missing.join(", ")}`,
      why: `Only ${completeness.filled} of ${completeness.total} indicators are available. Decisions based on incomplete data may be unreliable.`,
      followUp: "Re-run risk assessment once data is complete",
      priority: "High",
      category: "Data Quality",
      requiresFacultyReview: true,
    });
  }

  return suggestions;
}
