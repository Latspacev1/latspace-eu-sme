"use client";

// Shared chat state + streaming logic for the AI Dashboard.
// Currently consumed by AiSearchBar (omnibar on /corporate/overview); kept
// as a standalone hook so we can add new chat surfaces without re-implementing
// the ndjson/event-shape plumbing.

import { useCallback, useRef, useState } from "react";

import type { ChartSpec, ChartData } from "@/lib/dashboard/chart-spec";
import { dashboardFetch } from "@/lib/dashboard/client-fetch";

export type AssistantBlock =
  | { kind: "text"; text: string }
  | { kind: "error"; message: string }
  | { kind: "chart"; spec: ChartSpec; data: ChartData };

export interface UserMsg { id: string; role: "user"; text: string }
export interface AssistantMsg { id: string; role: "assistant"; blocks: AssistantBlock[]; streaming: boolean }
export type Msg = UserMsg | AssistantMsg;

function uid() { return Math.random().toString(36).slice(2, 10); }

export interface UseDashboardChat {
  messages: Msg[];
  sending: boolean;
  send: (text: string) => Promise<void>;
  reset: () => void;
}

export function useDashboardChat(): UseDashboardChat {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [sending, setSending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const applyEvent = useCallback((asstId: string, evt: { type: string; [k: string]: unknown }) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== asstId || m.role !== "assistant") return m;
      const blocks = [...m.blocks];
      if (evt.type === "text" && typeof evt.text === "string") {
        const last = blocks[blocks.length - 1];
        if (last?.kind === "text") {
          blocks[blocks.length - 1] = { kind: "text", text: last.text + evt.text };
        } else {
          blocks.push({ kind: "text", text: evt.text });
        }
      } else if (evt.type === "chart" && evt.spec && evt.data) {
        blocks.push({ kind: "chart", spec: evt.spec as ChartSpec, data: evt.data as ChartData });
      } else if (evt.type === "error" && typeof evt.message === "string") {
        blocks.push({ kind: "error", message: evt.message });
      }
      return { ...m, blocks };
    }));
  }, []);

  const finalize = useCallback((asstId: string) => {
    setMessages(prev => prev.map(m =>
      m.id === asstId && m.role === "assistant" ? { ...m, streaming: false } : m
    ));
  }, []);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);

    const userMsg: UserMsg = { id: uid(), role: "user", text: trimmed };
    const asstId = uid();
    const asstMsg: AssistantMsg = { id: asstId, role: "assistant", blocks: [], streaming: true };

    // Capture history at call-time so the request body is consistent even if
    // the state changes underneath us between renders.
    let historyForRequest: Msg[] = [];
    setMessages(prev => {
      historyForRequest = prev;
      return [...prev, userMsg, asstMsg];
    });

    const payloadMessages = [
      ...historyForRequest.map(m => m.role === "user"
        ? { role: "user" as const, content: m.text }
        : {
            role: "assistant" as const,
            content: m.blocks
              .filter(b => b.kind === "text")
              .map(b => (b as { kind: "text"; text: string }).text)
              .join("").trim() || "[chart rendered]",
          }
      ),
      { role: "user" as const, content: trimmed },
    ];

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await dashboardFetch("/api/dashboard/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payloadMessages }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "");
        throw new Error(errText || `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          let evt: { type: string; [k: string]: unknown };
          try { evt = JSON.parse(line); } catch { continue; }
          applyEvent(asstId, evt);
        }
      }
    } catch (err) {
      applyEvent(asstId, { type: "error", message: (err as Error).message ?? "Request failed" });
    } finally {
      finalize(asstId);
      setSending(false);
      abortRef.current = null;
    }
  }, [applyEvent, finalize]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
  }, []);

  return { messages, sending, send, reset };
}
