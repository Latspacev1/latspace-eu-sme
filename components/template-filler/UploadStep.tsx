"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  uploadTemplateForPreview,
  PreviewResponse,
} from "@/lib/api/template-filler";
import { Upload, FileSpreadsheet, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadStepProps {
  onComplete: (data: PreviewResponse) => void;
}

export function UploadStep({ onComplete }: UploadStepProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const validateFile = (f: File): string | null => {
    if (!f.name.endsWith(".xlsx") && !f.name.endsWith(".xlsm")) {
      return "Only .xlsx and .xlsm files are supported";
    }
    if (f.size > 30 * 1024 * 1024) {
      return "File size must be less than 30MB";
    }
    return null;
  };

  const handleFile = useCallback((f: File) => {
    const validationError = validateFile(f);
    if (validationError) {
      setError(validationError);
      return;
    }
    setFile(f);
    setError(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        handleFile(droppedFile);
      }
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const data = await uploadTemplateForPreview(file);
      onComplete(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setError(null);
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-8 transition-colors",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25",
            "hover:border-primary/50"
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="flex flex-col items-center space-y-4">
            <FileSpreadsheet className="w-16 h-16 text-muted-foreground" />

            <div className="text-center">
              <h3 className="text-lg font-semibold">Upload Excel Template</h3>
              <p className="text-sm text-muted-foreground">
                Drag and drop or click to browse. Supports .xlsx files up to
                30MB.
              </p>
            </div>

            <input
              type="file"
              id="template-upload"
              accept=".xlsx,.xlsm"
              onChange={handleFileChange}
              disabled={isUploading}
              className="hidden"
            />

            {!file ? (
              <label htmlFor="template-upload">
                <Button
                  variant="outline"
                  className="cursor-pointer"
                  asChild
                  disabled={isUploading}
                >
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    Choose File
                  </span>
                </Button>
              </label>
            ) : (
              <div className="flex items-center gap-2 bg-accent p-3 rounded-lg">
                <FileSpreadsheet className="w-5 h-5 text-primary" />
                <div className="text-sm">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearFile}
                  disabled={isUploading}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}

            {error && <div className="text-sm text-destructive">{error}</div>}

            {file && (
              <Button
                onClick={handleUpload}
                disabled={isUploading}
                className="w-full max-w-xs"
              >
                {isUploading ? (
                  <>Uploading...</>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload and Preview
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
