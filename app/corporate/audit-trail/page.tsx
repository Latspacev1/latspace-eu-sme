"use client";

import Link from "next/link";
import { History, FileText, GitBranch, Shield, ArrowRight, LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuditLogStats } from "@/lib/hooks/useAuditLogs";

interface AuditTrailMode {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  color: string;
  bgColor: string;
  stats?: string | null;
  comingSoon?: boolean;
}

function AuditCard({ mode }: { mode: AuditTrailMode }) {
  const Icon = mode.icon;
  const isDisabled = mode.comingSoon;

  const cardContent = (
    <Card
      className={`flex flex-col h-full transition-all duration-200 ${
        isDisabled
          ? "opacity-60 cursor-not-allowed"
          : "hover:shadow-lg hover:border-[#074D47]/30 cursor-pointer"
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between mb-4">
          <div
            className={`w-12 h-12 rounded-xl ${mode.bgColor} flex items-center justify-center transition-transform ${
              !isDisabled ? "group-hover:scale-110" : ""
            }`}
          >
            <Icon className={`h-6 w-6 ${mode.color}`} />
          </div>
          {mode.comingSoon && (
            <Badge variant="secondary" className="text-[10px] font-medium">
              Coming Soon
            </Badge>
          )}
          {mode.stats && !mode.comingSoon && (
            <Badge
              variant="outline"
              className="text-[10px] font-medium text-[#074D47] border-[#074D47]/20"
            >
              {mode.stats}
            </Badge>
          )}
        </div>
        <CardTitle className="text-[18px] font-semibold text-[#0A0A0A]">{mode.title}</CardTitle>
        <CardDescription className="text-[13px] text-[#0A0A0A]/60 leading-relaxed">
          {mode.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 mt-auto">
        {!isDisabled && (
          <div className="flex items-center text-[13px] font-medium text-[#074D47] group-hover:gap-2 transition-all">
            <span>View details</span>
            <ArrowRight className="h-4 w-4 ml-1 transition-transform group-hover:translate-x-1" />
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (isDisabled) {
    return <div>{cardContent}</div>;
  }

  return (
    <Link href={mode.href} className="block group">
      {cardContent}
    </Link>
  );
}

export default function CorporateAuditTrailPage() {
  const { data: auditStats } = useAuditLogStats();

  const auditTrailModes: AuditTrailMode[] = [
    {
      id: "activity-logs",
      title: "Activity Logs",
      description:
        "View all system changes, data modifications, and user activities across all plants",
      icon: History,
      href: "/corporate/audit-trail/activity-logs",
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      stats: auditStats?.total ? `${auditStats.total} records` : null,
    },
    {
      id: "documents",
      title: "Document Repository",
      description:
        "Manage calibration certificates, invoices, lab reports, and supporting documents",
      icon: FileText,
      href: "/corporate/audit-trail/documents",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      comingSoon: true,
    },
    {
      id: "data-lineage",
      title: "Data Lineage",
      description: "Trace emissions data back to source documents and view calculation chains",
      icon: GitBranch,
      href: "/corporate/audit-trail/data-lineage",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      comingSoon: true,
    },
    {
      id: "verification",
      title: "Verification Packages",
      description: "Generate and manage ACVA verification packages for compliance",
      icon: Shield,
      href: "/corporate/audit-trail/verification",
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      comingSoon: true,
    },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Page Header */}
      <div className="bg-white border-b border-[#050505]/6">
        <div className="px-8 py-8">
          <h1 className="text-[24px] font-semibold text-[#0A0A0A] tracking-[-0.02em]">
            Audit Trail
          </h1>
          <p className="text-[13px] text-[#0A0A0A]/60 mt-1">
            Maintain comprehensive documentation and traceability for EU - SME Sustainability
            Reporting compliance across all plants
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {auditTrailModes.map((mode) => (
            <AuditCard key={mode.id} mode={mode} />
          ))}
        </div>
      </div>
    </div>
  );
}
