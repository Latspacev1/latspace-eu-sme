"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNotificationSocket } from "@/lib/hooks/useNotificationSocket";

export interface JobStatusUpdate {
  job_id: string;
  status: string;
  progress: number;
  plant_id?: string;
}

interface JobStatusSocketOptions {
  onJobStatusUpdate?: (update: JobStatusUpdate) => void;
}

export function useJobStatusSocket(options: JobStatusSocketOptions = {}) {
  const { onJobStatusUpdate } = options;
  const queryClient = useQueryClient();

  const handleMessage = useCallback(
    (message: { type: string; data?: Record<string, unknown> }) => {
      if (message.type !== "job_status_update" || !message.data) {
        return;
      }

      const jobId = message.data.job_id;
      const status = message.data.status;
      const progress = message.data.progress;
      if (typeof jobId !== "string" || typeof status !== "string" || typeof progress !== "number") {
        return;
      }

      const update: JobStatusUpdate = {
        job_id: jobId,
        status,
        progress,
        plant_id: typeof message.data.plant_id === "string" ? message.data.plant_id : undefined,
      };

      queryClient.invalidateQueries({ queryKey: ["document-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["template-uploads"] });
      queryClient.invalidateQueries({ queryKey: ["parse-job", update.job_id] });
      onJobStatusUpdate?.(update);
    },
    [onJobStatusUpdate, queryClient]
  );

  return useNotificationSocket({
    showToasts: false,
    onMessage: handleMessage,
  });
}
