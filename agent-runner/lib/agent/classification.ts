// Document classification taxonomy — re-declaration of
// lib/types/document-classification.ts (the app cannot be imported from here;
// the runner ships standalone into the sandbox). Keep the two lists in sync;
// this mirrors the param-sections.ts / frameworks.ts duplication convention.

export const CATEGORIES = [
  "general_information",
  "environmental",
  "social",
  "governance",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const SUBCATEGORIES: Record<Category, readonly string[]> = {
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
};

export interface DocumentClassification {
  category: Category;
  subcategory: string;
}

/** A compact description of the taxonomy for the agent's system prompt. */
export function classificationGuide(): string {
  return CATEGORIES.map((c) => `- ${c}: ${SUBCATEGORIES[c].join(", ")}`).join("\n");
}
