// LocalStorage persistence for the reporting frameworks (CDP, VSME Digital
// Template). The VSME Narrative report uses its own qualitative storage layer
// (lib/reporting/qualitative).

export const CDP_ANSWERS_KEY = "cdp-app/v1";
export const VSME_ANSWERS_KEY = "vsme-app/v1";
const ASSIGNEES_KEY_PREFIX = "reporting-app/assignees/v1";

export type Status = "not-started" | "in-progress" | "completed";

export interface SavedAnswer {
  values: Record<string, unknown>;
  rows: Record<string, unknown>[];
  status: Status;
  updatedAt?: string;
}

export type Answers = Record<string, SavedAnswer>;

export function readAnswers(key: string): Answers {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Answers) : {};
  } catch {
    return {};
  }
}

export type Assignees = Record<string, string[]>;

export function readAssignees(frameworkId: string): Assignees {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(`${ASSIGNEES_KEY_PREFIX}/${frameworkId}`);
    return raw ? (JSON.parse(raw) as Assignees) : {};
  } catch {
    return {};
  }
}

export function writeAssignees(frameworkId: string, a: Assignees): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${ASSIGNEES_KEY_PREFIX}/${frameworkId}`, JSON.stringify(a));
}

export const mockUsers = [
  { id: "u1", name: "Ishan Mehta", email: "ishan@latspace.in" },
  { id: "u2", name: "Kshitiz Nigam", email: "kn@latspace.in" },
  { id: "u3", name: "Priya Sharma", email: "priya@latspace.in" },
  { id: "u4", name: "Arjun Rao", email: "arjun@latspace.in" },
  { id: "u5", name: "Meera Iyer", email: "meera@latspace.in" },
  { id: "u6", name: "Rohan Gupta", email: "rohan@latspace.in" },
] as const;

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function formatUpdated(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
