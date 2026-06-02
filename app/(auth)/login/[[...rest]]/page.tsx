import Image from "next/image";
import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <div className="flex flex-col items-center mb-8">
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
          EU - SME Sustainability Reporting
        </p>
      </div>

      <SignIn path="/login" routing="path" signUpUrl="/sign-up" />
    </div>
  );
}
