"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";

interface PDFRendererProps {
  pdfBlob: Blob;
  className?: string;
}

export function PDFRenderer({ pdfBlob, className = "" }: PDFRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.5);
  const [useIframe, setUseIframe] = useState(false);

  useEffect(() => {
    const renderPDF = async () => {
      if (!pdfBlob) {
        return;
      }

      // Wait for canvas to be available
      if (!canvasRef.current) {
        // Retry after a short delay
        setTimeout(() => {
          if (canvasRef.current) {
            renderPDF();
          }
        }, 100);
        return;
      }

      setIsLoading(true);
      setError(null);

      // Set a timeout to prevent infinite loading - fallback to iframe after 10 seconds
      const timeoutId = setTimeout(() => {
        console.warn(
          "PDF.js rendering timeout after 10 seconds, falling back to iframe",
        );
        setUseIframe(true);
        setIsLoading(false);
      }, 10000);

      try {
        // Dynamically import PDF.js
        const pdfjsLib = await import("pdfjs-dist");

        // Set worker source - use local worker from public folder (faster and more reliable)
        // Fallback to CDN if local worker not available
        if (typeof window !== "undefined") {
          // Try local worker first (copied to public folder)
          pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        } else {
          // Server-side fallback to CDN
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
        }
        // Load PDF from blob
        const arrayBuffer = await pdfBlob.arrayBuffer();

        if (arrayBuffer.byteLength === 0) {
          throw new Error("PDF blob is empty");
        }

        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        setNumPages(pdf.numPages);

        // Double-check canvas is still available
        if (!canvasRef.current) {
          throw new Error("Canvas element not available");
        }

        // Render first page
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error("Could not get canvas context");
        }

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
        clearTimeout(timeoutId);
        setIsLoading(false);
      } catch (err) {
        clearTimeout(timeoutId);
        console.error("PDF rendering error:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Failed to render PDF document";
        console.error("Error details:", {
          message: errorMessage,
          stack: err instanceof Error ? err.stack : undefined,
        });
        setError(errorMessage);
        setIsLoading(false);
      }
    };

    renderPDF();
  }, [pdfBlob, scale]);

  const renderPage = async (pageNum: number) => {
    if (!canvasRef.current) return;

    try {
      const pdfjsLib = await import("pdfjs-dist");
      if (typeof window !== "undefined") {
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      } else {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
      }

      const arrayBuffer = await pdfBlob.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      if (!context) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;
      setCurrentPage(pageNum);
    } catch (err) {
      console.error("Error rendering page:", err);
    }
  };

  // Use iframe fallback if PDF.js fails or times out
  if (useIframe || error) {
    const pdfUrl = pdfBlob ? URL.createObjectURL(pdfBlob) : null;
    if (!pdfUrl) {
      return (
        <div
          className={`p-4 bg-red-50 border border-red-200 rounded-lg ${className}`}
        >
          <p className="text-sm text-red-800">No PDF data available</p>
        </div>
      );
    }

    return (
      <div className={`space-y-2 ${className}`}>
        {error && (
          <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
            PDF.js rendering failed, using browser's built-in viewer
          </div>
        )}
        <iframe
          src={pdfUrl}
          className="w-full h-[600px] border border-[#0A0A0A]/10 rounded-lg"
          title="PDF Preview"
          onLoad={() => {
            // Clean up object URL after iframe loads
            setTimeout(() => URL.revokeObjectURL(pdfUrl), 1000);
          }}
        />
      </div>
    );
  }

  // Always render canvas so ref is available
  return (
    <div ref={containerRef} className={`pdf-viewer ${className}`}>
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#074D47]" />
          <span className="mt-3 text-sm text-[#0A0A0A]/60">Loading PDF...</span>
          <p className="mt-2 text-xs text-[#0A0A0A]/40">
            If this takes too long, using browser viewer...
          </p>
        </div>
      )}

      {/* Always render canvas (hidden when loading) so ref is available */}
      <div className={isLoading ? "hidden" : ""}>
        {/* PDF Controls */}
        {numPages > 1 && (
          <div className="flex items-center justify-between mb-4 p-2 bg-[#0A0A0A]/5 rounded-lg">
            <div className="flex items-center gap-2">
              <button
                onClick={() => renderPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm bg-white border border-[#0A0A0A]/20 rounded hover:bg-[#074D47]/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-[#0A0A0A]/80">
                Page {currentPage} of {numPages}
              </span>
              <button
                onClick={() => renderPage(Math.min(numPages, currentPage + 1))}
                disabled={currentPage === numPages}
                className="px-3 py-1 text-sm bg-white border border-[#0A0A0A]/20 rounded hover:bg-[#074D47]/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setScale(Math.max(0.5, scale - 0.25))}
                className="px-2 py-1 text-xs bg-white border border-[#0A0A0A]/20 rounded hover:bg-[#074D47]/10"
              >
                -
              </button>
              <span className="text-xs text-[#0A0A0A]/60">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={() => setScale(Math.min(3, scale + 0.25))}
                className="px-2 py-1 text-xs bg-white border border-[#0A0A0A]/20 rounded hover:bg-[#074D47]/10"
              >
                +
              </button>
            </div>
          </div>
        )}

        {/* PDF Canvas */}
        <div className="overflow-auto border border-[#0A0A0A]/10 rounded-lg bg-white p-4">
          <canvas ref={canvasRef} className="mx-auto" />
        </div>
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className={`pdf-viewer ${className}`}>
      {/* PDF Controls */}
      {numPages > 1 && (
        <div className="flex items-center justify-between mb-4 p-2 bg-[#0A0A0A]/5 rounded-lg">
          <div className="flex items-center gap-2">
            <button
              onClick={() => renderPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm bg-white border border-[#0A0A0A]/20 rounded hover:bg-[#074D47]/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-[#0A0A0A]/80">
              Page {currentPage} of {numPages}
            </span>
            <button
              onClick={() => renderPage(Math.min(numPages, currentPage + 1))}
              disabled={currentPage === numPages}
              className="px-3 py-1 text-sm bg-white border border-[#0A0A0A]/20 rounded hover:bg-[#074D47]/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setScale(Math.max(0.5, scale - 0.25))}
              className="px-2 py-1 text-xs bg-white border border-[#0A0A0A]/20 rounded hover:bg-[#074D47]/10"
            >
              -
            </button>
            <span className="text-xs text-[#0A0A0A]/60">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale(Math.min(3, scale + 0.25))}
              className="px-2 py-1 text-xs bg-white border border-[#0A0A0A]/20 rounded hover:bg-[#074D47]/10"
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* PDF Canvas */}
      <div className="overflow-auto border border-[#0A0A0A]/10 rounded-lg bg-white p-4">
        <canvas ref={canvasRef} className="mx-auto" />
      </div>
    </div>
  );
}
