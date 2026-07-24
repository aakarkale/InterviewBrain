// Vault/Interviews constants. Shared sub-record option lists (round types,
// outcomes, document types, interview types) still live in
// applications/constants.ts and are re-exported here so new code has one import.

export {
  ROUND_TYPES,
  ROUND_OUTCOMES,
  DOCUMENT_TYPES,
  INTERVIEW_TYPES,
  ROUND_TYPE_VALUES,
  ROUND_OUTCOME_VALUES,
  DOCUMENT_TYPE_VALUES,
} from "@/lib/applications/constants";

// Free-tier guardrail. A role is the closest analog to the old "application"
// (company + role + JD + resume), so the cap moves to active roles. Companies
// (vaults) are uncapped; the standing demo rule's "3 active applications"
// becomes 3 active roles.
export const MAX_ACTIVE_ROLES = 3;

// Web search is billed per call and multi-hop slow, so company-insight
// generation is both fingerprint-cached and rate-limited per month.
export const MAX_COMPANY_INSIGHT_GENERATIONS_PER_MONTH = 15;

export const INTERVIEW_STATUSES = [
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
] as const;

export const INTERVIEW_STATUS_VALUES: string[] = INTERVIEW_STATUSES.map(
  (s) => s.value
);

// Shown next to the LinkedIn field so users know how to produce the PDF export.
export const LINKEDIN_PDF_HINT =
  "On your LinkedIn profile, open the “More” menu → “Save to PDF”, then upload it here. We only store the extracted text.";

// Shown next to the resume upload so users know what to expect.
export const RESUME_PDF_HINT =
  "Upload your resume as a PDF and we’ll pull out the text for you to review before saving. We only store the extracted text, and a stronger resume ↔ JD match runs the next time you analyze fit.";
