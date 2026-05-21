"use client";

import { BenchmarkingProjectListItem, ProjectStatus } from "@/lib/api/benchmarking";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Eye } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

// ── Status badge ──────────────────────────────────────────────────────────────

type BadgeVariant = "secondary" | "default" | "success" | "warning" | "destructive";

const STATUS_CONFIG: Record<
  ProjectStatus,
  { label: string; variant: BadgeVariant }
> = {
  draft: { label: "Draft", variant: "secondary" },
  running: { label: "Running", variant: "warning" },
  complete: { label: "Complete", variant: "success" },
  failed: { label: "Failed", variant: "destructive" },
};

function StatusBadge({ status }: { status: ProjectStatus }) {
  const { label, variant } = STATUS_CONFIG[status] ?? {
    label: status,
    variant: "secondary" as BadgeVariant,
  };
  return <Badge variant={variant}>{label}</Badge>;
}

// ── Skeleton rows ─────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {[...Array(3)].map((_, i) => (
        <TableRow key={i}>
          {[...Array(5)].map((__, j) => (
            <TableCell key={j}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <BarChart3 className="w-14 h-14 text-[#0A0A0A]/20 mb-4" />
      <p className="text-[#0A0A0A]/60 font-medium mb-1">
        No benchmarking projects yet
      </p>
      <p className="text-sm text-[#0A0A0A]/40">
        Create your first project to compare ESG performance against peers.
      </p>
    </div>
  );
}

// ── Main table component ──────────────────────────────────────────────────────

interface ProjectsTableProps {
  projects: BenchmarkingProjectListItem[];
  isLoading: boolean;
}

export function ProjectsTable({ projects, isLoading }: ProjectsTableProps) {
  if (!isLoading && projects.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="border border-[#0A0A0A]/10 rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-[#074D47]/5">
            <TableHead>Project Name</TableHead>
            <TableHead>Segment</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Peers</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <SkeletonRows />
          ) : (
            projects.map((project) => (
              <TableRow key={project.project_id} className="hover:bg-[#074D47]/5">
                <TableCell className="font-medium text-[#0A0A0A]">
                  {project.name}
                </TableCell>
                <TableCell className="text-[#0A0A0A]/70 capitalize">
                  {project.segment.replace(/_/g, " ")}
                </TableCell>
                <TableCell>
                  <StatusBadge status={project.status} />
                </TableCell>
                <TableCell className="text-[#0A0A0A]/70">
                  {project.peer_count}
                </TableCell>
                <TableCell className="text-[#0A0A0A]/70 text-sm">
                  {format(new Date(project.created_at), "MMM dd, yyyy")}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="text-[#074D47] hover:text-[#074D47] hover:bg-[#074D47]/10"
                  >
                    <Link
                      href={`/corporate/benchmarking/${project.project_id}`}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
