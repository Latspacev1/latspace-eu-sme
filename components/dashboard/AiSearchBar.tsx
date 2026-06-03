"use client";

// AiSearchBar — the omnibar mounted at the top of /corporate/overview.
//
// Collapsed state: a single dark pill input with a glow halo (matches the
// reference design). Click / focus / submit / arriving messages expand it
// into a dropdown that contains the chat thread and inline charts. Pressing
// Escape or clicking outside collapses it (the thread is preserved until
// the user explicitly clears it via the X button).

import { useEffect, useRef, useState } from "react";
import { Sparkles, AlertCircle, X, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

import { ChartMessage } from "@/components/dashboard/ChartMessage";
import { useDashboardChat } from "@/components/dashboard/use-dashboard-chat";
import { MessageContent } from "@/components/reporting/message-content";
import { specKey } from "@/lib/dashboard/spec-key";

const FALLBACK_SUGGESTIONS = [
  "What's our renewable energy share?",
  "Show me scope 1 emissions through the year",
  "Compare scope 1, 2 and 3 totals",
  "Plot water withdrawal monthly",
];

interface AiSearchBarProps {
  onPinned?: () => void;
  pinnedSpecKeys?: Set<string>;
  /** When true, render the tall centered hero variant (used on /corporate/overview). */
  hero?: boolean;
  /** Data-aware prompts surfaced as starter chips so users know what they can ask. */
  suggestions?: string[];
}

export function AiSearchBar({ onPinned, pinnedSpecKeys, hero = false, suggestions }: AiSearchBarProps) {
  const starters = suggestions && suggestions.length > 0 ? suggestions : FALLBACK_SUGGESTIONS;
  const { messages, sending, send, reset } = useDashboardChat();
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll thread on new content.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Click-outside closes the dropdown (keeps the thread intact for next open).
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function submit(text: string) {
    if (!text.trim() || sending) return;
    setOpen(true);
    setInput("");
    await send(text);
  }

  function clearThread() {
    reset();
    setOpen(false);
    setInput("");
    inputRef.current?.blur();
  }

  // Enter submits; Shift+Enter inserts a newline (textarea in the hero box).
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(input);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {/* ── Input bar ────────────────────────────────────────────────
          Hero variant: a large, rounded, gradient-haloed box (mirrors the
          reference design) for the centered overview hero. Compact variant:
          the original slim pill. Both share the brand teal accent. */}
      <form
        onSubmit={(e) => { e.preventDefault(); submit(input); }}
        className={cn(
          "relative bg-white transition-all",
          hero
            ? cn(
                "rounded-2xl px-5 pt-4 pb-3 shadow-[0_10px_40px_-16px_rgba(31,95,91,0.30)]",
                // Soft teal gradient ring that intensifies on focus.
                "border border-[#1F5F5B]/15",
                open
                  ? "border-[#1F5F5B]/40 shadow-[0_14px_50px_-14px_rgba(31,95,91,0.40)]"
                  : "hover:border-[#1F5F5B]/30 focus-within:border-[#1F5F5B]/40",
              )
            : cn(
                "flex items-center gap-3 h-12 px-4 border border-[#0A0A0A]/15",
                open
                  ? "border-[#1F5F5B] shadow-[0_0_0_3px_rgba(31,95,91,0.08)]"
                  : "hover:border-[#0A0A0A]/30 focus-within:border-[#1F5F5B] focus-within:shadow-[0_0_0_3px_rgba(31,95,91,0.08)]",
              ),
        )}
      >
        {hero ? (
          <>
            <textarea
              ref={inputRef}
              value={input}
              rows={2}
              onFocus={() => { if (messages.length > 0) setOpen(true); }}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask anything about your sustainability data — try “show scope 1 emissions through the year”"
              disabled={sending}
              className={cn(
                "w-full bg-transparent outline-none resize-none text-[15px] leading-relaxed",
                "text-[#0A0A0A] placeholder-[#0A0A0A]/40 disabled:opacity-50",
              )}
            />
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="flex items-center gap-1.5 text-[11px] text-[#1F5F5B]/70">
                <Sparkles className="w-3.5 h-3.5" strokeWidth={2} />
                AI assistant
              </span>
              <div className="flex items-center gap-1.5">
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={clearThread}
                    className="flex-shrink-0 p-1.5 text-[#0A0A0A]/40 hover:text-[#0A0A0A] hover:bg-[#0A0A0A]/[0.04] rounded-lg transition-colors"
                    aria-label="Clear conversation"
                    title="Clear conversation"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  className={cn(
                    "flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all",
                    input.trim() && !sending
                      ? "bg-gradient-to-br from-[#22867C] to-[#1F5F5B] text-white shadow-sm hover:shadow-md"
                      : "bg-[#1F5F5B]/10 text-[#1F5F5B]/30 cursor-not-allowed",
                  )}
                  aria-label="Send"
                >
                  {sending ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <ArrowUp className="w-5 h-5" strokeWidth={2.25} />
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 text-[#1F5F5B] flex-shrink-0" strokeWidth={2} />
            <textarea
              ref={inputRef}
              value={input}
              rows={1}
              onFocus={() => { if (messages.length > 0) setOpen(true); }}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask for a chart — try “show scope 1 through the year”"
              disabled={sending}
              className={cn(
                "flex-1 bg-transparent outline-none resize-none text-sm text-[#0A0A0A] placeholder-[#0A0A0A]/40 self-center",
                "disabled:opacity-50",
              )}
            />
            {messages.length > 0 && (
              <button
                type="button"
                onClick={clearThread}
                className="flex-shrink-0 p-1.5 text-[#0A0A0A]/40 hover:text-[#0A0A0A] hover:bg-[#0A0A0A]/[0.04] transition-colors"
                aria-label="Clear conversation"
                title="Clear conversation"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className={cn(
                "flex-shrink-0 w-9 h-9 flex items-center justify-center transition-colors",
                input.trim() && !sending
                  ? "bg-[#1F5F5B] text-white hover:bg-[#22867C]"
                  : "bg-[#0A0A0A]/[0.04] text-[#0A0A0A]/30 cursor-not-allowed",
              )}
              aria-label="Send"
            >
              {sending ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <ArrowUp className="w-4 h-4" strokeWidth={2.25} />
              )}
            </button>
          </>
        )}
      </form>

      {/* ── Hero starter chips (always visible — show users what they can ask) ── */}
      {hero && messages.length === 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {starters.slice(0, 5).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => submit(s)}
              className={cn(
                "px-3.5 py-2 rounded-full text-[13px] text-[#1F5F5B] transition-all",
                "bg-white border border-[#1F5F5B]/20 hover:border-[#1F5F5B]/50",
                "hover:bg-gradient-to-r hover:from-[#22867C]/[0.06] hover:to-[#1F5F5B]/[0.06] shadow-sm",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* ── Dropdown panel (chat thread + suggestions) ───────────────── */}
      {open && (
        <div
          className={cn(
            "absolute left-0 right-0 top-[calc(100%+6px)] z-30",
            "bg-white border border-[#0A0A0A]/15 shadow-[0_12px_40px_-12px_rgba(10,10,10,0.18)]",
            "overflow-hidden",
          )}
        >
          <div className="px-4 py-2.5 border-b border-[#0A0A0A]/[0.06] flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#1F5F5B]" strokeWidth={2} />
            <span className="text-[11px] uppercase tracking-[0.12em] text-[#0A0A0A]/55 font-medium">
              AI assistant
            </span>
            <span className="text-[11px] text-[#0A0A0A]/35 ml-auto">Press Esc to close</span>
          </div>

          <div ref={scrollRef} className="max-h-[60vh] overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 ? (
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-wider text-[#0A0A0A]/45 mb-2">Try one of these</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {starters.map(s => (
                    <button
                      key={s}
                      onClick={() => submit(s)}
                      className="text-left px-3 py-2.5 border border-[#0A0A0A]/10 hover:border-[#1F5F5B]/40 hover:bg-[#1F5F5B]/[0.02] text-sm text-[#0A0A0A]/75 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map(m => (
                // User messages bubble on the right (capped width). Assistant
                // turns take the full pane so charts can fill the dropdown.
                <div key={m.id} className={cn(m.role === "user" ? "flex justify-end" : "block")}>
                  <div className={cn(
                    "space-y-2",
                    m.role === "user" ? "max-w-[92%] ml-auto" : "w-full",
                  )}>
                    {m.role === "user" ? (
                      <div className="bg-[#1F5F5B] text-white text-sm px-3.5 py-2 leading-relaxed">
                        {m.text}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {m.blocks.length === 0 && m.streaming && (
                          <div className="text-xs text-[#0A0A0A]/40 italic">Thinking…</div>
                        )}
                        {m.blocks.length === 0 && !m.streaming && (
                          <div className="text-xs text-[#0A0A0A]/40 italic">No response. Try rephrasing.</div>
                        )}
                        {m.blocks.map((b, i) => {
                          if (b.kind === "text") {
                            return (
                              <div key={i} className="text-sm text-[#0A0A0A]/85 leading-relaxed">
                                <MessageContent content={b.text} />
                              </div>
                            );
                          }
                          if (b.kind === "error") {
                            return (
                              <div key={i} className="flex items-start gap-2 border border-amber-200 bg-amber-50 text-amber-900 text-[13px] px-3 py-2">
                                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span>{b.message}</span>
                              </div>
                            );
                          }
                          const key = specKey(b.spec);
                          return (
                            <ChartMessage
                              key={i}
                              spec={b.spec}
                              data={b.data}
                              pinned={pinnedSpecKeys?.has(key)}
                              onPinned={onPinned}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
