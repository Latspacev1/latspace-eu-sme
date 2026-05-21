import React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface DraggableParamProps {
  label: string;
  type: "input" | "output";
  onClick?: () => void;
}

export function DraggableParam({ label, type, onClick }: DraggableParamProps) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", label);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <Badge
      draggable
      onDragStart={handleDragStart}
      onClick={onClick}
      variant="outline"
      className={cn(
        "cursor-move select-none gap-2 px-3 py-1.5 text-xs font-mono font-normal transition-all hover:border-primary hover:text-primary active:scale-95",
        type === "input"
          ? "border-blue-200 text-slate-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300"
          : "border-purple-200 text-slate-600 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300",
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          type === "input" ? "bg-blue-400" : "bg-purple-400",
        )}
      ></span>
      {label}
    </Badge>
  );
}
