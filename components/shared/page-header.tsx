"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { NotificationsBell } from "./notifications-bell";

interface PageHeaderProps {
  showBackButton?: boolean;
  backButtonLabel?: string;
  backButtonHref?: string;
  onBackClick?: () => void;
}

export function PageHeader({
  showBackButton = false,
  backButtonLabel = "Back to Overview",
  backButtonHref = "/corporate/overview",
  onBackClick,
}: PageHeaderProps) {
  const router = useRouter();

  const handleBackClick = () => {
    if (onBackClick) {
      onBackClick();
    } else if (backButtonHref) {
      router.push(backButtonHref);
    } else {
      router.back();
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-[#0A0A0A]/[0.06] h-24 flex items-center px-8">
      <div className="flex items-center justify-between w-full">
        {/* Left side - Back button or empty space */}
        <div className="flex items-center">
          {showBackButton && (
            <Button
              variant="ghost"
              onClick={handleBackClick}
              className="h-10 px-4 -ml-4 text-gray-600 hover:text-latspace-dark hover:bg-transparent"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {backButtonLabel}
            </Button>
          )}
        </div>

        {/* Right side - Notifications */}
        <div className="flex items-center">
          <NotificationsBell />
        </div>
      </div>
    </header>
  );
}
