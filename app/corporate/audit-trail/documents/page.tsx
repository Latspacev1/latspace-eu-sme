"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Upload, FolderOpen, Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CorporateDocumentsPage() {
  const router = useRouter();

  const plannedFeatures = [
    {
      icon: Upload,
      title: "Document Upload & Storage",
      description: "Upload PDFs, Excel files, images, and other supporting documents",
    },
    {
      icon: FolderOpen,
      title: "Category Management",
      description:
        "Organize documents by type: calibration certificates, invoices, lab reports, etc.",
    },
    {
      icon: Clock,
      title: "Validity Tracking",
      description: "Track document validity periods and receive alerts for expiring documents",
    },
    {
      icon: CheckCircle,
      title: "Verification Workflow",
      description: "Submit documents for verification and track approval status",
    },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Page Header */}
      <div className="bg-white border-b border-[#050505]/6">
        <div className="px-8 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/corporate/audit-trail")}
              className="p-2 -ml-2 rounded-lg hover:bg-[#050505]/5 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-[#0A0A0A]/60" />
            </button>
            <div>
              <h1 className="text-[24px] font-semibold text-[#0A0A0A] tracking-[-0.02em]">
                Document Repository
              </h1>
              <p className="text-[13px] text-[#0A0A0A]/60 mt-0.5">
                Manage calibration certificates, invoices, and supporting documents across all
                plants
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Coming Soon Card */}
          <div className="bg-white rounded-2xl border border-[#050505]/6 p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-6">
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
            <h2 className="text-[20px] font-semibold text-[#0A0A0A] mb-2">Coming Soon</h2>
            <p className="text-[14px] text-[#0A0A0A]/60 leading-relaxed max-w-md mx-auto">
              Document repository is currently under development. This feature will allow you to
              upload, manage, and organize supporting documents across all your plants for
              EU - SME Sustainability Reporting compliance.
            </p>
            <div className="flex justify-center gap-3 mt-8">
              <Button
                variant="outline"
                onClick={() => router.push("/corporate/audit-trail")}
                className="h-10 px-5 border-[#050505]/10"
              >
                Back to Audit Trail
              </Button>
              <Button
                onClick={() => router.push("/corporate/audit-trail/activity-logs")}
                className="h-10 px-5 bg-[#074D47] hover:bg-[#074D47]/90"
              >
                View Activity Logs
              </Button>
            </div>
          </div>

          {/* Planned Features */}
          <div className="mt-8">
            <h3 className="text-[12px] font-semibold text-[#0A0A0A]/50 uppercase tracking-wide mb-4">
              Planned Features
            </h3>
            <div className="space-y-3">
              {plannedFeatures.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={index}
                    className="bg-white rounded-xl border border-[#050505]/6 p-4 flex items-start gap-4"
                  >
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Icon className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-[14px] font-medium text-[#0A0A0A]">{feature.title}</p>
                      <p className="text-[13px] text-[#0A0A0A]/60 mt-0.5">{feature.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
