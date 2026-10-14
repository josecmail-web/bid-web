"use client";

import { useUI } from "@/lib/store";
import { Blueprint, Toast } from "./ui";

export function AuthFrame({ children, extra }: { children: React.ReactNode; extra?: React.ReactNode }) {
  const { toast } = useUI();
  return (
    <div className="auth-bg">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/bidra-logo.png" alt="Bidra Pro" style={{ height: 60, width: "auto", margin: "8px 0 32px" }} />
      <Blueprint style={{ width: "100%", maxWidth: 520, background: "var(--color-bg)", padding: "32px 28px" }}>
        {children}
      </Blueprint>
      {extra}
      <Toast msg={toast} />
    </div>
  );
}
