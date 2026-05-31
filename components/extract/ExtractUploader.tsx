"use client";

// Dropzone + period/framework selectors that kick off an extraction run.
// Calls back with the chosen file and options; the parent owns the streaming.

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, FileText } from "lucide-react";

export interface UploadOptions {
  file: File;
  period?: string;
  framework: string;
}

const ACCEPT = {
  "application/pdf": [".pdf"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
};

export function ExtractUploader({
  onStart,
  disabled,
}: {
  onStart: (opts: UploadOptions) => void;
  disabled?: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [period, setPeriod] = useState("");
  const [framework, setFramework] = useState("vsme");

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) setFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT,
    maxFiles: 1,
    multiple: false,
    disabled,
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed px-6 py-10 text-center transition-colors ${
          isDragActive ? "border-brand bg-brand/[0.03]" : "border-slate-300 hover:border-slate-400"
        } ${disabled ? "pointer-events-none opacity-50" : ""}`}
      >
        <input {...getInputProps()} />
        {file ? (
          <>
            <FileText className="h-7 w-7 text-brand" />
            <div className="text-sm font-medium text-slate-800">{file.name}</div>
            <div className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB — click to replace</div>
          </>
        ) : (
          <>
            <UploadCloud className="h-7 w-7 text-slate-400" />
            <div className="text-sm font-medium text-slate-700">Drop a utility bill, invoice, or PDF here</div>
            <div className="text-xs text-slate-500">PDF, PNG, or JPEG · up to 20 MB</div>
          </>
        )}
      </div>

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
          disabled={!file || disabled}
          onClick={() => file && onStart({ file, period: period.trim() || undefined, framework })}
          className="ml-auto bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Extract data
        </button>
      </div>
    </div>
  );
}
