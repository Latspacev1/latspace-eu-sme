"use client";

import { useAppStore } from "@/lib/store/useAppStore";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function WelcomeOverlay() {
    const { welcomeState, dismissWelcome } = useAppStore();
    const { isVisible, isExiting, userName } = welcomeState;
    const pathname = usePathname();

    useEffect(() => {
        if (isVisible && !isExiting && pathname !== "/login") {
            // Once we've navigated away from login, wait a bit for the UI to be ready
            // then trigger the exit animation
            const timer = setTimeout(() => {
                dismissWelcome();
            }, 1500); // Overlay stays for 1.5s after landing on the new page

            return () => clearTimeout(timer);
        }
    }, [isVisible, isExiting, pathname, dismissWelcome]);

    if (!isVisible) return null;

    return (
        <div
            className={cn(
                "fixed inset-0 z-[9999] flex items-center justify-center bg-white",
                !isExiting ? "animate-welcome-popup" : "animate-welcome-exit"
            )}
        >
            <div className="text-center">
                <h2 className="text-4xl font-semibold text-[#074D47] mb-2 tracking-tight">
                    Welcome, {userName}
                </h2>
                <div className="w-12 h-1 bg-[#074D47]/20 mx-auto rounded-full overflow-hidden">
                    <div className="w-full h-full bg-[#074D47] origin-left animate-[loading_2.5s_ease-in-out_infinite]" />
                </div>
            </div>
        </div>
    );
}
