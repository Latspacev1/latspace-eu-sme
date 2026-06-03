// Document classification taxonomy. Each uploaded document is classified by the
// extraction agent into a top-level Category and a Subcategory drawn from that
// category's list. Stored on extraction_documents.classification (migration
// 0007) and shown in the upload history.
//
// NOTE: the agent runner ships standalone into the sandbox and cannot import
// from here, so it re-declares this taxonomy in
// agent-runner/lib/agent/classification.ts. Keep the two in sync (same
// convention as param-sections.ts / frameworks.ts).

export const CATEGORIES = [
  "general_information",
  "environmental",
  "social",
  "governance",
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Subcategories per category. General Information has a single "General". */
export const SUBCATEGORIES = {
  general_information: ["General"],
  environmental: [
    "Electricity",
    "Water",
    "Waste",
    "Fuel Use",
    "Feedstock",
    "Logistics",
    "Packaging",
    "Purchased Goods",
    "Biodiversity",
  ],
  social: [
    "Employee",
    "Workforce turnover",
    "Health and Safety accidents",
    "Worker representation",
  ],
  governance: [
    "Ownership and governance structure",
    "Business conduct policies",
    "Legal proceedings",
    "Certifications/Audits/Permits",
  ],
} as const satisfies Record<Category, readonly string[]>;

export type Subcategory =
  (typeof SUBCATEGORIES)[Category][number];

export interface DocumentClassification {
  category: Category;
  subcategory: string;
}

/** Human-readable label for a category. */
export const CATEGORY_LABELS: Record<Category, string> = {
  general_information: "General Information",
  environmental: "Environmental",
  social: "Social",
  governance: "Governance",
};

/** Default subcategory for a category (first in the list). */
export function defaultSubcategory(category: Category): string {
  return SUBCATEGORIES[category][0];
}

/** Whether a (category, subcategory) pair is valid. */
export function isValidClassification(
  category: unknown,
  subcategory: unknown,
): category is Category {
  if (!CATEGORIES.includes(category as Category)) return false;
  const list = SUBCATEGORIES[category as Category] as readonly string[];
  return typeof subcategory === "string" && list.includes(subcategory);
}

/**
 * Coerce an unknown value into a valid DocumentClassification, or return null
 * when it can't be made valid. Used when reading possibly-legacy/partial blobs.
 */
export function normalizeClassification(
  input: unknown,
): DocumentClassification | null {
  if (typeof input !== "object" || input === null) return null;
  const raw = input as Record<string, unknown>;
  const category = raw.category;
  if (!CATEGORIES.includes(category as Category)) return null;
  const list = SUBCATEGORIES[category as Category] as readonly string[];
  const subcategory =
    typeof raw.subcategory === "string" && list.includes(raw.subcategory)
      ? raw.subcategory
      : defaultSubcategory(category as Category);
  return { category: category as Category, subcategory };
}
