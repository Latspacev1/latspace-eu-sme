/**
 * Chat API client — proxies to backend /api/chat which forwards to agents_v1.
 *
 * Thread IDs are managed by the caller (React state). Pass thread_id on every
 * turn after the first to maintain conversation context in agents_v1 MemorySaver.
 */

import { apiClient, getBackendUrl } from "./client";
import type { APIResponse } from "./client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  /** Client-generated timestamp (ms since epoch) */
  timestamp: number;
}

export interface ChatInvokeResponse {
  thread_id: string;
  answer: string;
}

export interface StreamChatOptions {
  message: string;
  threadId?: string;
  plantId?: string;
  financialYear?: number;
  instanceId?: string;
  sectionId?: string;
  /** Called with each streamed token as it arrives. */
  onToken: (token: string) => void;
  /** Called when streaming completes. Returns the full accumulated reply. */
  onDone: (reply: string, threadId: string) => void;
  /** Called on network / agent error. */
  onError: (error: string) => void;
  /** Auth token — obtained from useAppStore. */
  token: string | null;
}

// ---------------------------------------------------------------------------
// Streaming helper
// ---------------------------------------------------------------------------

/**
 * Stream a chat message via SSE.
 *
 * Returns an AbortController so the caller can cancel the stream
 * (e.g. when the component unmounts or the user clicks Stop).
 */
export function streamChat(options: StreamChatOptions): AbortController {
  const {
    message,
    threadId,
    plantId = "",
    financialYear,
    instanceId,
    sectionId,
    onToken,
    onDone,
    onError,
    token,
  } = options;

  const controller = new AbortController();
  const baseURL = getBackendUrl();
  const url = baseURL ? `${baseURL.replace(/\/$/, "")}/api/chat/stream` : "/api/chat/stream";

  const body = JSON.stringify({
    message,
    thread_id: threadId ?? null,
    plant_id: plantId,
    financial_year: financialYear ?? null,
    instance_id: instanceId ?? null,
    section_id: sectionId ?? null,
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  (async () => {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        onError(`HTTP ${response.status}: ${response.statusText}`);
        return;
      }

      const returnedThreadId = response.headers.get("X-Thread-ID") ?? threadId ?? "";
      const reader = response.body?.getReader();
      if (!reader) {
        onError("No response body");
        return;
      }

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        // Each SSE event is "data: <payload>\n\n".
        // Payload is JSON-encoded so multi-line content (markdown, code blocks)
        // survives SSE line splitting. "[DONE]" and "Error:..." are plain strings.
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6);
          if (raw === "[DONE]") {
            onDone(accumulated, returnedThreadId);
            return;
          }
          if (raw.startsWith("Error:")) {
            onError(raw.slice(7));
            return;
          }
          // Attempt JSON parse; agents_v1 sends structured events like
          // {"type":"token","content":"..."} and {"type":"action",...}.
          let text: string | null = null;
          try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") {
              if (parsed.type === "token" && typeof parsed.content === "string") {
                text = parsed.content;
              } else if (parsed.type === "action") {
                // Action events are handled by other consumers; skip in chat stream
                continue;
              } else if (parsed.error) {
                onError(String(parsed.error));
                return;
              }
            }
            if (text === null && typeof parsed === "string") {
              text = parsed;
            }
          } catch {
            text = raw;
          }
          if (text !== null) {
            accumulated += text;
            onToken(text);
          }
        }
      }

      // Stream ended without [DONE] — treat accumulated content as done
      onDone(accumulated, returnedThreadId);
    } catch (err) {
      if ((err as Error).name === "AbortError") return; // cancelled by caller
      onError((err as Error).message ?? "Unknown error");
    }
  })();

  return controller;
}

// ---------------------------------------------------------------------------
// Non-streaming invoke (for testing / programmatic use)
// ---------------------------------------------------------------------------

export const chatApi = {
  invoke: (body: {
    message: string;
    thread_id?: string;
    plant_id?: string;
    financial_year?: number;
  }): Promise<APIResponse<ChatInvokeResponse>> =>
    apiClient.post<ChatInvokeResponse>("/api/chat/invoke", body),
};
