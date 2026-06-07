"use client";

// Side-by-side document preview for the extraction review screen. PDFs render
// via the existing PDFRenderer; images render directly; spreadsheets (which we
// can't embed) get an on-brand placeholder card. Takes the dropped File so we
// don't round-trip through storage for the preview.

import { useEffect, useMemo } from "react";
import { FileSpreadsheet } from "lucide-react";
import { PDFRenderer } from "@/components/pdf-renderer";

const SPREADSHEET_MIME = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
]);

export function DocumentPreview({ file, className = "" }: { file: File; className?: string }) {
  const isPdf = file.type === "application/pdf";
  const isSpreadsheet =
    SPREADSHEET_MIME.has(file.type) || /\.(xlsx|xls|csv)$/i.test(file.name);

  // Object URL for the image preview, derived from the file (not effect state)
  // so there's no setState-in-effect. Revoked on unmount / file change. Only
  // images get an object URL — PDFs and spreadsheets don't need one.
  const needsImgUrl = !isPdf && !isSpreadsheet;
  const imgUrl = useMemo(
    () => (needsImgUrl ? URL.createObjectURL(file) : null),
    [file, needsImgUrl],
  );
  useEffect(() => {
    return () => {
      if (imgUrl) URL.revokeObjectURL(imgUrl);
    };
  }, [imgUrl]);

  if (isPdf) {
    return <PDFRenderer pdfBlob={file} className={className} />;
  }
  if (isSpreadsheet) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className="flex flex-col items-center gap-3 border-2 border-dashed border-slate-300 px-8 py-12 text-center">
          <FileSpreadsheet className="h-10 w-10 text-brand" />
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Spreadsheet
          </div>
          <div className="max-w-xs truncate text-sm font-medium text-slate-800">
            {file.name}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className={`overflow-auto ${className}`}>
      {imgUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imgUrl} alt={file.name} className="max-w-full" />
      )}
    </div>
  );
}
