"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/store/useAppStore";
import { streamChat, type ChatMessage } from "@/lib/api/chat";
import { MessageContent } from "@/components/reporting/message-content";

interface AssistantPaneProps {
  width: number;
  onCollapse: () => void;
  plantId?: string;
  financialYear?: number;
  instanceId?: string;
  sectionId?: string;
  /** When true, the pane is rendered for a local-mode framework (no instance). */
  localMode?: boolean;
}

export function AssistantPane({ width, onCollapse, plantId, financialYear, instanceId, sectionId, localMode }: AssistantPaneProps) {
  const { token } = useAppStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streamingContent]);

  // Abort any in-flight stream on unmount to prevent state updates on a dead component.
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text, timestamp: Date.now() }]);
    setIsStreaming(true);
    setStreamingContent("");

    abortRef.current = streamChat({
      message: text,
      threadId,
      plantId: plantId ?? "",
      financialYear,
      instanceId,
      sectionId,
      token,
      onToken: (t) => setStreamingContent((prev) => prev + t),
      onDone: (reply, tid) => {
        setMessages((prev) => [...prev, { role: "assistant", content: reply, timestamp: Date.now() }]);
        setThreadId(tid);
        setStreamingContent("");
        setIsStreaming(false);
      },
      onError: (err) => {
        setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${err}`, timestamp: Date.now() }]);
        setStreamingContent("");
        setIsStreaming(false);
      },
    });
  }, [input, isStreaming, threadId, plantId, financialYear, instanceId, sectionId, token]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <aside className="shrink-0 border-l border-slate-200 bg-white flex flex-col" style={{ width }}>
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="text-sm font-medium text-slate-800">AI Assistant</div>
        <button onClick={onCollapse} title="Collapse panel" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <div className="px-4 py-3 border-b border-slate-200">
        <div className="flex gap-4 text-sm">
          <span className="border-b-2 border-brand pb-1 font-medium text-slate-900">Ask</span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && !isStreaming && (
          <div className="h-full grid place-items-center text-center text-sm text-slate-500">
            <div>
              <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-slate-100 grid place-items-center">🤖</div>
              Ask questions about your data
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`text-sm rounded-md px-3 py-2 ${msg.role === "user" ? "bg-slate-100 text-slate-800 ml-4" : "bg-white border border-slate-200 text-slate-700 mr-4"}`}>
            {msg.role === "assistant" ? (
              <MessageContent content={msg.content} />
            ) : (
              msg.content
            )}
          </div>
        ))}
        {isStreaming && streamingContent && (
          <div className="text-sm rounded-md px-3 py-2 bg-white border border-slate-200 text-slate-700 mr-4">
            <MessageContent content={streamingContent} /><span className="animate-pulse">▌</span>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 p-3">
        <div className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 focus-within:border-brand">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question..."
            className="flex-1 bg-transparent text-sm outline-none"
            disabled={isStreaming}
          />
          <button onClick={handleSend} disabled={isStreaming || !input.trim()} className="text-brand disabled:opacity-40" aria-label="send">
            ➤
          </button>
        </div>
      </div>
    </aside>
  );
}

