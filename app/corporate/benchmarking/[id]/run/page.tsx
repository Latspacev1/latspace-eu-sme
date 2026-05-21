import { RunProgressPanel } from "@/components/benchmarking/run-progress-panel";
import { BarChart3 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

interface RunPageProps {
  params: Promise<{ id: string }>;
}

export default async function BenchmarkingRunPage({ params }: RunPageProps) {
  const { id } = await params;

  return (
    <div className="bg-white min-h-screen">
      <div className="container mx-auto px-12 py-8 max-w-2xl">
        {/* Back link */}
        <div className="mb-8">
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

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <BarChart3 className="w-8 h-8 text-[#074D47]" />
            <h1 className="text-3xl font-semibold text-[#0A0A0A] tracking-tight">
              Analysis Running
            </h1>
          </div>
          <p className="text-sm text-[#0A0A0A]/50">
            Your ESG peer benchmarking analysis is in progress. This page polls
            for updates every 5 seconds and will redirect automatically when
            complete.
          </p>
        </div>

        {/* Progress panel (client component) */}
        <div className="border border-[#0A0A0A]/10 rounded-xl p-8">
          <RunProgressPanel projectId={id} />
        </div>
      </div>
    </div>
  );
}
