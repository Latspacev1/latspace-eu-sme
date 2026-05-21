"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";

import { useAppStore } from "@/lib/store/useAppStore";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const login = useAppStore((state) => state.login);
  const triggerWelcome = useAppStore((state) => state.triggerWelcome);
  const welcomeState = useAppStore((state) => state.welcomeState);
  const router = useRouter();

  const disabled = loading || welcomeState.isVisible;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (disabled) return;

    setError("");
    setLoading(true);

    try {
      const result = await login(email, password);

      if (result.success) {
        const currentUser = useAppStore.getState().user;
        triggerWelcome(currentUser?.username || "User");
        router.push("/corporate/overview");
        return;
      }

      setLoading(false);
      const message = (result.error || "Invalid email or password").toLowerCase();
      if (message.includes("invalid password") || message.includes("incorrect password")) {
        setError("Incorrect Password");
      } else if (message.includes("user not found")) {
        setError("User not found");
      } else {
        setError(result.error || "Invalid email or password");
      }
    } catch {
      setLoading(false);
      setError("An error occurred. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white relative overflow-hidden">
      <div className="w-full max-w-[420px] mx-4">
        <div className="bg-white border border-gray-200 rounded-sm p-12 shadow-sm">
          <div className="flex flex-col items-center mb-12">
            <Image
              src="/latspace-logo.svg"
              alt="LatSpace"
              width={60}
              height={60}
              priority
              className="mb-4"
            />
            <h1 className="font-semibold text-[24px] text-[#0A0A0A] tracking-[-0.01em]">
              LatSpace
            </h1>
            <p className="text-[11px] text-[#074D47] tracking-[0.15em] uppercase mt-1">
              CCTS Management System
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className="block text-[11px] font-medium text-gray-700 uppercase tracking-wide mb-2"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter email"
                className="w-full px-4 py-3 border border-gray-300 rounded-sm focus:border-[#074D47] focus:ring-1 focus:ring-[#074D47] focus:outline-none text-[#0A0A0A] placeholder:text-gray-400 text-[15px] transition-colors"
                required
                autoComplete="email"
                autoFocus
                disabled={disabled}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-[11px] font-medium text-gray-700 uppercase tracking-wide mb-2"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter password"
                  className="w-full px-4 py-3 border border-gray-300 rounded-sm focus:border-[#074D47] focus:ring-1 focus:ring-[#074D47] focus:outline-none text-[#0A0A0A] placeholder:text-gray-400 text-[15px] transition-colors pr-12"
                  required
                  autoComplete="current-password"
                  disabled={disabled}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#074D47] transition-colors focus:outline-none"
                  disabled={disabled}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {error && <div className="text-red-600 text-[13px]">{error}</div>}

            <button
              type="submit"
              disabled={disabled}
              className="w-full bg-[#074D47] hover:bg-[#22867C] disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-3.5 rounded-sm transition-colors text-[13px] tracking-wider uppercase font-medium"
            >
              {loading ? "Signing In..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
