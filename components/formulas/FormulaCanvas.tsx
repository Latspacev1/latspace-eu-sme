import React, {
  useRef,
  useImperativeHandle,
  forwardRef,
  useState,
  useEffect,
} from "react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";

interface FormulaCanvasProps {
  expression: string;
  setExpression: (expr: string) => void;
  isValid?: boolean;
  previewResult?: string | null;
  availableParams?: string[];
}

export interface FormulaCanvasRef {
  insert: (text: string) => void;
}

export const FormulaCanvas = forwardRef<FormulaCanvasRef, FormulaCanvasProps>(
  (
    { expression, setExpression, isValid, previewResult, availableParams = [] },
    ref,
  ) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestionPosition, setSuggestionPosition] = useState({
      top: 0,
      left: 0,
    });

    const insertAtCursor = (text: string) => {
      if (textareaRef.current) {
        const start = textareaRef.current.selectionStart;
        const end = textareaRef.current.selectionEnd;
        const newValue =
          expression.substring(0, start) + text + expression.substring(end);
        setExpression(newValue);

        // Restore cursor position after update
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart =
              textareaRef.current.selectionEnd = start + text.length;
            textareaRef.current.focus();
          }
        }, 0);
      } else {
        // Fallback if ref not ready
        setExpression(expression + text);
      }
    };

    useImperativeHandle(ref, () => ({
      insert: insertAtCursor,
    }));

    // Handle suggestion logic
    const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
      const target = e.currentTarget;
      const value = target.value;
      const cursor = target.selectionStart;

      // Find the word being typed before cursor
      const textBeforeCursor = value.slice(0, cursor);
      // Regex to find the partial token at the end of string
      const match = textBeforeCursor.match(/([a-z0-9_]+)$/i);

      if (match) {
        const partial = match[1];
        const filtered = availableParams.filter(
          (p) =>
            p.toLowerCase().includes(partial.toLowerCase()) && p !== partial,
        );

        if (filtered.length > 0) {
          setSuggestions(filtered);
          setShowSuggestions(true);
          setActiveIndex(0);
        } else {
          setShowSuggestions(false);
        }
      } else {
        setShowSuggestions(false);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!showSuggestions) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % suggestions.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex(
          (prev) => (prev - 1 + suggestions.length) % suggestions.length,
        );
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        confirmSuggestion(suggestions[activeIndex]);
      } else if (e.key === "Escape") {
        setShowSuggestions(false);
      }
    };

    const confirmSuggestion = (suggestion: string) => {
      if (!textareaRef.current) return;

      const cursor = textareaRef.current.selectionStart;
      const textBeforeCursor = expression.slice(0, cursor);
      // Replace the partial word with full suggestion
      // This is tricky because we need to find how much to replace
      const match = textBeforeCursor.match(/([a-z0-9_]+)$/i);

      if (match) {
        const partial = match[1];
        const start = cursor - partial.length;

        const newValue =
          expression.slice(0, start) + suggestion + expression.slice(cursor);

        setExpression(newValue);
        setShowSuggestions(false);

        // Restore cursor position after update
        setTimeout(() => {
          if (textareaRef.current) {
            const newCursorPos = start + suggestion.length;
            textareaRef.current.selectionStart =
              textareaRef.current.selectionEnd = newCursorPos;
            textareaRef.current.focus();
          }
        }, 0);
      }
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      const param = e.dataTransfer.getData("text/plain");
      if (param) {
        insertAtCursor(param);
      }
    };

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
    };

    return (
      <section className="space-y-3 relative">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Formula Canvas
          </h2>
          <button
            onClick={() => setExpression("")}
            className="text-xs text-slate-400 hover:text-slate-600 underline"
          >
            Clear
          </button>
        </div>
        <div
          className={cn(
            "relative w-full bg-white border-2 rounded-lg shadow-sm flex flex-col p-4 transition-colors group",
            isValid === true
              ? "border-emerald-200"
              : isValid === false
                ? "border-red-200"
                : "border-slate-200 focus-within:border-primary",
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <Textarea
            ref={textareaRef}
            value={expression}
            onChange={(e) => {
              setExpression(e.target.value);
              handleInput(e);
            }}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              // Delay hiding so clicks work
              setTimeout(() => setShowSuggestions(false), 200);
            }}
            className="min-h-[160px] resize-none border-0 focus-visible:ring-0 p-0 font-mono text-lg bg-transparent text-slate-800"
            placeholder="Drag parameters here, click above, or type to search..."
          />

          <div className="mt-4 pt-4 border-t border-dashed border-slate-200">
            <div className="text-xs text-slate-400 flex justify-between items-center font-sans">
              <span>
                Preview result:{" "}
                <span className="text-slate-900 font-mono font-medium ml-2 text-sm">
                  {previewResult || "--"}
                </span>
              </span>
              {isValid === true && (
                <Badge
                  variant="outline"
                  className="bg-emerald-50 text-emerald-600 border-emerald-100 gap-1 pl-1.5"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Valid Formula
                </Badge>
              )}
              {isValid === false && (
                <Badge
                  variant="outline"
                  className="bg-red-50 text-red-600 border-red-100 gap-1 pl-1.5"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Invalid Formula
                </Badge>
              )}
            </div>
          </div>

          {/* Suggestions Popover */}
          {showSuggestions && suggestions.length > 0 && (
            <Card className="absolute top-16 left-4 z-50 w-64 max-h-48 overflow-y-auto border-slate-200 shadow-lg">
              <ul className="py-1">
                {suggestions.map((s, i) => (
                  <li
                    key={s}
                    className={cn(
                      "px-3 py-2 text-sm font-mono cursor-pointer transition-colors",
                      i === activeIndex
                        ? "bg-teal-50 text-teal-700"
                        : "hover:bg-slate-50 text-slate-700",
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault(); // Prevent blur
                      confirmSuggestion(s);
                    }}
                  >
                    {s}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </section>
    );
  },
);

FormulaCanvas.displayName = "FormulaCanvas";
