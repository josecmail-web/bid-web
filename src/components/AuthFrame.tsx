"use client";

import { useUI } from "@/lib/store";
import { Blueprint, Toast } from "./ui";

export function AuthFrame({ children, extra }: { children: React.ReactNode; extra?: React.ReactNode }) {
  const { toast } = useUI();
  return (
    <div className="auth-bg">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/bid-logo.png" alt="BID · Build Invest Direct" style={{ height: 44, width: "auto", margin: "8px 0 36px" }} />
      <Blueprint style={{ width: "100%", maxWidth: 520, background: "var(--color-bg)", padding: "32px 28px" }}>
        {children}
      </Blueprint>
      <div style={{ marginTop: 20, fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--color-neutral-600)" }}>
        Build · Invest · Direct
      </div>
      {extra}
      <Toast msg={toast} />
    </div>
  );
}
