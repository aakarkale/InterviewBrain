// Shared option lists for application sub-records. The values are the strings
// persisted to Postgres (see the SPEC Data Model); labels are display-only.

export const ROUND_TYPES = [
  { value: "recruiter", label: "Recruiter screen" },
  { value: "behavioral", label: "Behavioral" },
  { value: "product_sense", label: "Product sense" },
  { value: "execution", label: "Execution" },
  { value: "other", label: "Other" },
] as const;

export const ROUND_OUTCOMES = [
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
  { value: "passed", label: "Passed" },
  { value: "rejected", label: "Rejected" },
] as const;

export const DOCUMENT_TYPES = [
  {
    value: "note",
    label: "Note",
    hint: "Freeform research, company observations, prep bullets.",
  },
  {
    value: "call_summary",
    label: "Call summary",
    hint: "Your summary of a recruiter screen or informational interview.",
  },
  {
    value: "call_transcript",
    label: "Call transcript",
    hint: "Pasted raw transcript — the highest-signal context the interviewer gets.",
  },
  {
    value: "other",
    label: "Other",
    hint: "Anything that doesn't fit the buckets above.",
  },
] as const;

// Interview types a practice session can run (used from Phase 2 feature 3 on).
export const INTERVIEW_TYPES = [
  { value: "behavioral", label: "Behavioral" },
  { value: "product_sense", label: "Product sense" },
  { value: "execution", label: "Execution" },
] as const;

// Free-tier guardrail (doubles as an AI cost ceiling).
export const MAX_ACTIVE_APPLICATIONS = 3;

// Plain string arrays for server-side membership validation.
export const ROUND_TYPE_VALUES: string[] = ROUND_TYPES.map((t) => t.value);
export const ROUND_OUTCOME_VALUES: string[] = ROUND_OUTCOMES.map((t) => t.value);
export const DOCUMENT_TYPE_VALUES: string[] = DOCUMENT_TYPES.map((t) => t.value);
