"use client";

// Dropzone + period/framework selectors that stage one or more documents and
// add them to the extraction queue. Several can be added at once (or more added
// while earlier runs are still extracting). The parent owns the streaming via
// useExtractionQueue.

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, FileText, X } from "lucide-react";

export interface UploadOptions {
  file: File;
  period?: string;
  framework: string;
}

const ACCEPT = {
  "application/pdf": [".pdf"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.ms-excel": [".xls"],
  "text/csv": [".csv"],
};

export function ExtractUploader({
  onAdd,
  disabled,
  remainingSlots,
}: {
  /** Called with every staged file (shared period/framework) when "Add" is clicked. */
  onAdd: (opts: UploadOptions[]) => void;
  disabled?: boolean;
  /** How many more files the queue can accept; staging is capped to this. */
  remainingSlots: number;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [period, setPeriod] = useState("");
  const [framework, setFramework] = useState("vsme");

  const onDrop = useCallback(
    (accepted: File[]) => {
      setFiles((prev) => {
        // Dedup by name+size; respect the remaining-slots cap.
        const seen = new Set(prev.map((f) => `${f.name}:${f.size}`));
        const merged = [...prev];
        for (const f of accepted) {
          const key = `${f.name}:${f.size}`;
          if (!seen.has(key)) {
            seen.add(key);
            merged.push(f);
          }
        }
        return merged.slice(0, Math.max(0, remainingSlots));
      });
    },
    [remainingSlots],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT,
    multiple: true,
    disabled: disabled || remainingSlots <= 0,
  });

  const removeStaged = (idx: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleAdd = () => {
    if (!files.length) return;
    onAdd(
      files.map((file) => ({
        file,
        period: period.trim() || undefined,
        framework,
      })),
    );
    setFiles([]);
  };

  const atCapacity = remainingSlots <= 0;

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed px-6 py-10 text-center transition-colors ${
          isDragActive ? "border-brand bg-brand/[0.03]" : "border-slate-300 hover:border-slate-400"
        } ${disabled || atCapacity ? "pointer-events-none opacity-50" : ""}`}
      >
        <input {...getInputProps()} />
        <UploadCloud className="h-7 w-7 text-slate-400" />
        <div className="text-sm font-medium text-slate-700">
          Drop utility bills, invoices, or PDFs here
        </div>
        <div className="text-xs text-slate-500">
          PDF, PNG, JPEG, Excel, or CSV · up to 20 MB each · multiple files supported
        </div>
        {atCapacity && (
          <div className="text-xs text-amber-600">
            Queue is full — let some runs finish before adding more.
          </div>
        )}
      </div>

      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((f, i) => (
            <li
              key={`${f.name}:${f.size}:${i}`}
              className="flex items-center gap-2 border border-slate-200 px-3 py-2 text-sm"
            >
              <FileText className="h-4 w-4 shrink-0 text-brand" />
              <span className="truncate font-medium text-slate-800">{f.name}</span>
              <span className="shrink-0 text-xs text-slate-400">
                {(f.size / 1024 / 1024).toFixed(2)} MB
              </span>
              <button
                type="button"
                onClick={() => removeStaged(i)}
                className="ml-auto shrink-0 text-slate-400 hover:text-slate-700"
                aria-label={`Remove ${f.name}`}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Period hint (optional)
          <input
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            placeholder="e.g. FY2025"
            disabled={disabled}
            className="w-40 border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-brand"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Framework
          <select
            value={framework}
            onChange={(e) => setFramework(e.target.value)}
            disabled={disabled}
            className="w-40 border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-brand"
          >
            <option value="vsme">VSME</option>
            <option value="cdp">CDP</option>
          </select>
        </label>
        <button
          type="button"
          disabled={!files.length || disabled}
          onClick={handleAdd}
          style={{ backgroundColor: "#074D47" }}
          className="ml-auto px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {files.length > 1 ? `Extract ${files.length} documents` : "Extract data"}
        </button>
      </div>
    </div>
  );
}
