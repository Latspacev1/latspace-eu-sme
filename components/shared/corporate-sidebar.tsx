"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store/useAppStore";
import {
  LayoutDashboard,
  LogOut,
  FileBarChart,
  BarChart3,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FileEdit,
  Users,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface NavItem {
  href?: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/corporate/overview",
    icon: LayoutDashboard,
  },
  {
    label: "Data Collection",
    icon: FileEdit,
    children: [
      { href: "/approvals", label: "Logbook", icon: ClipboardCheck },
    ],
  },
  {
    label: "Reporting",
    href: "/reporting",
    icon: FileBarChart,
    children: [
      { href: "/corporate/benchmarking", label: "Benchmarking", icon: BarChart3 },
      { href: "/reporting/assignees", label: "Assignees", icon: Users },
    ],
  },
];

export function CorporateSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, sidebarCollapsed, toggleSidebar } = useAppStore();

  const [openGroups, setOpenGroups] = React.useState<Set<string>>(() => new Set());
  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  React.useEffect(() => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const item of navItems) {
        const hasActiveChild = item.children?.some(
          (c) =>
            c.href &&
            (pathname === c.href || pathname.startsWith(`${c.href}/`))
        );
        if (hasActiveChild && !next.has(item.label)) {
          next.add(item.label);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [pathname, navItems]);

  const parentNavClass = (isActive: boolean) =>
    cn(
      "flex items-center cursor-pointer py-3 mb-1 text-[14px] font-medium tracking-[-0.01em] transition-all duration-200 rounded-md overflow-hidden px-3",
      isActive
        ? "text-[#074D47] bg-[#074D47]/[0.04]"
        : "text-[#0A0A0A]/60 hover:text-[#074D47] hover:bg-[#074D47]/[0.02] hover:underline"
    );

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-white border-r border-[#0A0A0A]/[0.06] flex flex-col transition-[width] duration-300 ease-in-out z-40",
        sidebarCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo and Toggle Button */}
      <div className="h-24 flex items-center justify-between px-4 flex-shrink-0 border-b border-[#0A0A0A]/[0.06] overflow-hidden">
        <Link
          href="/corporate/overview"
          className="flex items-center group overflow-hidden"
        >
          <div className="flex-shrink-0 w-8 flex justify-center">
            <Image
              src="/latspace-logo.svg"
              alt="LatSpace"
              width={32}
              height={32}
              className="transition-opacity duration-200 group-hover:opacity-80"
              priority
            />
          </div>
          <span className={cn(
            "font-semibold text-[18px] text-[#0A0A0A] tracking-[-0.01em] transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden",
            sidebarCollapsed ? "max-w-0 opacity-0 ml-0" : "max-w-[150px] opacity-100 ml-3"
          )}>
            LatSpace
          </span>
        </Link>
        {!sidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-md hover:bg-[#0A0A0A]/[0.04] transition-colors duration-200 flex-shrink-0"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="w-4 h-4 text-[#0A0A0A]/60" />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      <div className={cn(
        "flex justify-center border-b border-[#0A0A0A]/[0.06] transition-all duration-300 overflow-hidden",
        sidebarCollapsed ? "h-auto py-3 opacity-100" : "h-0 py-0 opacity-0"
      )}>
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-md hover:bg-[#0A0A0A]/[0.04] transition-colors duration-200"
          aria-label="Expand sidebar"
        >
          <ChevronRight className="w-4 h-4 text-[#0A0A0A]/60" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-12 px-2 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isChildRouteActive = item.children?.some(
            (c) =>
              c.href &&
              (pathname === c.href || pathname.startsWith(`${c.href}/`))
          );
          const isParentActive =
            (item.href &&
              (pathname === item.href || pathname.startsWith(`${item.href}/`))) ||
            isChildRouteActive;
          const isGroupOpen = openGroups.has(item.label) || !!isChildRouteActive;

          const parentRow = item.href ? (
            <Link href={item.href} className={parentNavClass(!!isParentActive)}>
              <div className="flex-shrink-0 w-6 flex justify-center">
                <Icon className={cn("w-[18px] h-[18px]", isParentActive ? "text-[#074D47]" : "text-[#0A0A0A]/40")} />
              </div>
              <span className={cn("transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden", sidebarCollapsed ? "max-w-0 opacity-0 ml-0" : "max-w-[120px] opacity-100 ml-4")}>
                {item.label}
              </span>
              {!sidebarCollapsed && item.children && (
                <button
                  type="button"
                  className="ml-auto cursor-pointer p-1 rounded hover:bg-[#0A0A0A]/[0.04]"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleGroup(item.label); }}
                  aria-label={isGroupOpen ? "Collapse group" : "Expand group"}
                >
                  {isGroupOpen ? <ChevronUp className="w-3.5 h-3.5 text-[#0A0A0A]/40" /> : <ChevronDown className="w-3.5 h-3.5 text-[#0A0A0A]/40" />}
                </button>
              )}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => !sidebarCollapsed && item.children && toggleGroup(item.label)}
              className={cn("w-full", parentNavClass(!!isParentActive))}
            >
              <div className="flex-shrink-0 w-6 flex justify-center">
                <Icon className={cn("w-[18px] h-[18px]", isParentActive ? "text-[#074D47]" : "text-[#0A0A0A]/40")} />
              </div>
              <span className={cn("transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden", sidebarCollapsed ? "max-w-0 opacity-0 ml-0" : "max-w-[120px] opacity-100 ml-4")}>
                {item.label}
              </span>
              {!sidebarCollapsed && item.children && (
                <span className="ml-auto">
                  {isGroupOpen ? <ChevronUp className="w-3.5 h-3.5 text-[#0A0A0A]/40" /> : <ChevronDown className="w-3.5 h-3.5 text-[#0A0A0A]/40" />}
                </span>
              )}
            </button>
          );

          const childrenPanel = !sidebarCollapsed && item.children && (
            <div className={cn("overflow-hidden transition-all duration-300", isGroupOpen ? "max-h-60 opacity-100" : "max-h-0 opacity-0")}>
              {item.children.map((child) => {
                if (!child.href) return null;
                const ChildIcon = child.icon;
                const isChildActive = pathname === child.href || pathname.startsWith(child.href + "/");
                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={cn(
                      "flex items-center py-2.5 mb-0.5 text-[13px] font-medium tracking-[-0.01em] transition-all duration-200 rounded-md pl-9 pr-3",
                      isChildActive
                        ? "text-[#074D47] bg-[#074D47]/[0.04]"
                        : "text-[#0A0A0A]/50 hover:text-[#074D47] hover:bg-[#074D47]/[0.02]"
                    )}
                  >
                    <ChildIcon className={cn("w-[15px] h-[15px] mr-3 flex-shrink-0", isChildActive ? "text-[#074D47]" : "text-[#0A0A0A]/30")} />
                    {child.label}
                  </Link>
                );
              })}
            </div>
          );

          const wrappedParent = sidebarCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>{parentRow}</TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>{item.label}</TooltipContent>
            </Tooltip>
          ) : (
            <>{parentRow}</>
          );

          return (
            <div key={item.label}>
              {wrappedParent}
              {childrenPanel}
            </div>
          );
        })}
      </nav>

      {/* User Info - Clean minimal footer */}
      <div
        className={cn(
          "border-t border-[#0A0A0A]/[0.06] flex-shrink-0 transition-all duration-300",
          sidebarCollapsed ? "p-3" : "p-8"
        )}
      >
        <div className={cn(
          "transition-all duration-300 overflow-hidden",
          sidebarCollapsed ? "max-h-0 mb-0 opacity-0" : "max-h-20 mb-6 opacity-100"
        )}>
          <div className="text-[12px] font-semibold tracking-[0.02em] text-[#074D47] mb-1 whitespace-nowrap">
            {user?.username || "User"}
          </div>
          <div className="text-[11px] text-[#0A0A0A]/70 uppercase tracking-[0.08em] whitespace-nowrap">
            {user?.displayName || "Corporate Head"}
          </div>
        </div>

        {/* TODO: add Settings icon here once /corporate/settings route exists */}
        {sidebarCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center p-2 text-[#0A0A0A]/80 hover:text-[#074D47] rounded-md hover:bg-[#0A0A0A]/[0.04] transition-all duration-200"
                aria-label="Logout"
              >
                <LogOut className="w-[18px] h-[18px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Logout
            </TooltipContent>
          </Tooltip>
        ) : (
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-4 py-3 text-[11px] font-medium uppercase tracking-[0.1em] text-[#0A0A0A]/80 hover:text-[#074D47] border border-[#0A0A0A]/20 hover:border-[#074D47]/50 transition-all duration-200 whitespace-nowrap overflow-hidden"
          >
            <div className="flex-shrink-0 w-4 flex justify-center ml-[-4px]">
              <LogOut className="w-[14px] h-[14px]" />
            </div>
            <span className={cn(
              "transition-all duration-300 ease-in-out overflow-hidden",
              sidebarCollapsed ? "max-w-0 opacity-0 ml-0" : "max-w-[100px] opacity-100 ml-2"
            )}>
              Logout
            </span>
          </button>
        )}
      </div>
    </aside>
  );
}
