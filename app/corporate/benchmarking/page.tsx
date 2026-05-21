import { ProjectsTableClient } from "@/components/benchmarking/projects-table-client";
import { Button } from "@/components/ui/button";
import { BarChart3, PlusCircle } from "lucide-react";
import Link from "next/link";

export default function BenchmarkingPage() {
  return (
    <div className="bg-white min-h-screen">
      <div className="container mx-auto px-12 py-8">
        {/* Header */}
        <div className="mb-10 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <BarChart3 className="w-10 h-10 text-[#074D47]" />
              <h1 className="text-[#0A0A0A] text-5xl font-semibold tracking-tight">
                ESG Benchmarking
              </h1>
            </div>
            <p className="text-[#0A0A0A]/60 text-base leading-relaxed max-w-2xl">
              Compare your ESG performance against industry peers. Create a
              project, select peers, and run an automated analysis.
            </p>
          </div>

          <Button
            asChild
            className="bg-[#074D47] text-white hover:bg-[#074D47]/90 shrink-0"
          >
            <Link href="/corporate/benchmarking/new">
              <PlusCircle className="w-4 h-4 mr-2" />
              New Benchmarking Project
            </Link>
          </Button>
        </div>

        {/* Table — fetches data client-side via TanStack Query */}
        <ProjectsTableClient />
      </div>
    </div>
  );
}
