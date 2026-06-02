// POST /api/extract  (multipart/form-data: file, period?, framework?)
//
// Uploads a document to private Supabase Storage, mints a short-TTL signed URL,
// records an extraction_documents row, then dispatches the agent-runner in
// `extract` mode and streams its NDJSON events (activity / text / proposal /
// done / error) straight to the browser — mirroring /api/reporting/chat.
//
// The runner only ever receives the signed URL, never the service key.

import { NextRequest } from "next/server";
import { dispatch } from "@/lib/dispatcher";
import { resolveRagFramework } from "@/lib/dispatcher/frameworks";
import { resolveOrgId } from "@/lib/dashboard/auth";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

const ALLOWED_MIME = new Set(["application/pdf", "image/png", "image/jpeg", "image/jpg"]);
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB
const SIGNED_URL_TTL = 600; // 10 minutes

function ndjsonError(message: string, status = 400): Response {
  return new Response(JSON.stringify({ event: "error", data: { message } }) + "\n", {
    status,
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
  });
}

export async function POST(req: NextRequest) {
  const orgId = await resolveOrgId(req);
  if (!orgId) return ndjsonError("Not authenticated", 401);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return ndjsonError("Expected multipart/form-data with a 'file' field");
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return ndjsonError("Missing 'file' field");
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return ndjsonError(`Unsupported file type: ${file.type || "unknown"}. Upload a PDF, PNG, or JPEG.`);
  }
  if (file.size > MAX_BYTES) {
    return ndjsonError(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 20 MB.`);
  }
  const mime = file.type === "image/jpg" ? "image/jpeg" : file.type;

  const periodHint = (form.get("period") as string | null)?.trim() || undefined;
  const framework = resolveRagFramework((form.get("framework") as string | null) ?? undefined);

  const supabase = getSupabaseServiceClient();

  // 1. Upload to the private documents bucket.
  const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
  const storagePath = `org/${orgId}/${periodHint ?? "inbox"}/${crypto.randomUUID()}-${safeName}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from("documents")
    .upload(storagePath, bytes, { contentType: mime, upsert: false });
  if (upErr) return ndjsonError(`Upload failed: ${upErr.message}`, 500);

  // 2. Signed URL the runner fetches from.
  const { data: signed, error: signErr } = await supabase.storage
    .from("documents")
    .createSignedUrl(storagePath, SIGNED_URL_TTL);
  if (signErr || !signed?.signedUrl) {
    return ndjsonError(`Could not sign document URL: ${signErr?.message ?? "unknown"}`, 500);
  }

  // 3. Existing parameters for dedup hints.
  const { data: existingParameters } = await supabase
    .from("parameters")
    .select("code, display_name, unit, section")
    .eq("org_id", orgId);

  // 4. Provenance row.
  const { data: docRow, error: docErr } = await supabase
    .from("extraction_documents")
    .insert({
      org_id: orgId,
      storage_path: storagePath,
      filename: file.name,
      mime_type: mime,
      status: "pending",
    })
    .select("id")
    .single();
  if (docErr) return ndjsonError(`Could not record document: ${docErr.message}`, 500);

  // 5. Dispatch + stream. Add the document id as a response header so the
  //    client can pass it back to /api/extract/commit.
  const streamed = await dispatch({
    job: {
      mode: "extract",
      documentUrl: signed.signedUrl,
      filename: file.name,
      mimeType: mime,
      framework,
      periodHint,
      existingParameters: existingParameters ?? [],
    },
  });

  const headers = new Headers(streamed.headers);
  headers.set("X-Extraction-Document-Id", docRow.id);
  return new Response(streamed.body, { status: streamed.status, headers });
}
