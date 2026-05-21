import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import React from "react";

interface ChartCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  isLoading?: boolean;
  className?: string;
}

export function ChartCard({
  title,
  description,
  children,
  action,
  isLoading = false,
  className,
}: ChartCardProps) {
  return (
    <Card
      className={cn(
        "bg-white border-[0.5px] border-foreground/8 transition-all duration-500 hover:border-primary/20 hover:shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
        className,
      )}
    >
      {/* Generous padding - let content breathe */}
      <CardHeader className="px-10 pt-10 pb-8">
        <div className="flex items-start justify-between gap-8">
          <div className="space-y-3">
            <CardTitle>
              <h3 className="text-base font-normal tracking-[-0.01em] text-foreground">
                {title}
              </h3>
            </CardTitle>
            {description && (
              <CardDescription className="text-[11px] text-foreground/65 leading-relaxed font-normal">
                {description}
              </CardDescription>
            )}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      </CardHeader>

      {/* Symmetrical padding for grid alignment */}
      <CardContent className="px-10 pb-10 pt-0">
        {isLoading ? (
          <div className="h-[350px] flex items-center justify-center">
            <Skeleton className="h-full w-full bg-primary/5" />
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
