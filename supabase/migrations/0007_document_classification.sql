-- Document classification — the extraction agent classifies each uploaded
-- document into a top-level Category and a Subcategory (see
-- lib/types/document-classification.ts). Stored as a small JSONB blob on the
-- extraction_documents row and shown in the upload history.
--
-- Shape:
--   {
--     "category":    "general_information" | "environmental" | "social" | "governance",
--     "subcategory": text   -- one of that category's allowed subcategories
--   }
--
-- JSONB (not two text columns) keeps it flexible as the taxonomy grows and
-- mirrors how proposal/onboarding_profile are stored.

alter table extraction_documents
  add column if not exists classification jsonb;
