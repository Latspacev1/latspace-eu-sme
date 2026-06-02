"use client";

// Side-by-side document preview for the extraction review screen. PDFs render
// via the existing PDFRenderer; images render directly. Takes the dropped File
// so we don't round-trip through storage for the preview.

import { useEffect, useMemo } from "react";
import { PDFRenderer } from "@/components/pdf-renderer";

export function DocumentPreview({ file, className = "" }: { file: File; className?: string }) {
  const isPdf = file.type === "application/pdf";

  // Object URL for the image preview, derived from the file (not effect state)
  // so there's no setState-in-effect. Revoked on unmount / file change.
  const imgUrl = useMemo(() => (isPdf ? null : URL.createObjectURL(file)), [file, isPdf]);
  useEffect(() => {
    return () => {
      if (imgUrl) URL.revokeObjectURL(imgUrl);
    };
  }, [imgUrl]);

  if (isPdf) {
    return <PDFRenderer pdfBlob={file} className={className} />;
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
