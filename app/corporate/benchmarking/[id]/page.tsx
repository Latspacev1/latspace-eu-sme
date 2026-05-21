import { BenchmarkingResultsClient } from "./components/benchmarking-results-client";
import { BarChart3, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface BenchmarkingResultsPageProps {
  params: Promise<{ id: string }>;
}

export default async function BenchmarkingResultsPage({
  params,
}: BenchmarkingResultsPageProps) {
  const { id } = await params;

  return (
    <div className="bg-white min-h-screen">
      <div className="container mx-auto px-12 py-8 max-w-7xl">
        {/* Back link */}
        <div className="mb-6">
          <Button
            variant="ghost"
            asChild
            className="text-[#0A0A0A]/60 hover:text-[#0A0A0A] -ml-2"
          >
            <Link href="/corporate/benchmarking">
              <ChevronLeft className="w-4 h-4 mr-1" />
              All Projects
            </Link>
          </Button>
        </div>

        {/* Icon row */}
        <div className="flex items-center gap-3 mb-6">
          <BarChart3 className="w-7 h-7 text-[#074D47]" />
          <span className="text-sm text-[#0A0A0A]/40 uppercase tracking-wide font-medium">
            Benchmarking Results
          </span>
        </div>

        {/* Client component handles all data fetching and tabs */}
        <BenchmarkingResultsClient projectId={id} />
      </div>
    </div>
  );
}
