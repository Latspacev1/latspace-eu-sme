import React from "react";
import { Button } from "@/components/ui/button";

interface OperatorToolbarProps {
  onInsert: (operator: string) => void;
}

export function OperatorToolbar({ onInsert }: OperatorToolbarProps) {
  const operators = ["+", "-", "/", "*", "%", "^"];

  return (
    <div className="flex flex-wrap items-center justify-center gap-4 p-6 bg-slate-50 border border-slate-200 rounded-lg">
      {operators.map((op) => (
        <Button
          key={op}
          variant="outline"
          onClick={() => onInsert(op)}
          className="w-10 h-10 rounded-full font-mono text-lg shadow-sm hover:border-primary hover:text-primary hover:bg-emerald-50"
        >
          {op}
        </Button>
      ))}
      <div className="w-px h-8 bg-slate-300 mx-4"></div>
      <Button
        variant="outline"
        onClick={() => onInsert("(")}
        className="w-10 h-10 rounded-full font-mono text-lg shadow-sm hover:border-primary hover:text-primary hover:bg-emerald-50"
      >
        (
      </Button>
      <Button
        variant="outline"
        onClick={() => onInsert(")")}
        className="w-10 h-10 rounded-full font-mono text-lg shadow-sm hover:border-primary hover:text-primary hover:bg-emerald-50"
      >
        )
      </Button>
    </div>
  );
}
