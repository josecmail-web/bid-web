"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { acceptInvite } from "@/server/actions/account";
import { NewPasswordForm } from "@/components/NewPasswordForm";

export function AcceptForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const home = useRef("/");
  return (
    <NewPasswordForm
      email={email}
      submitLabel="Crear mi acceso"
      requireTerms
      onSubmit={async (p) => {
        const r = await acceptInvite(token, p, true);
        if (r.ok) home.current = r.home;
        return r;
      }}
      onDone={() => {
        router.replace(home.current);
        router.refresh();
      }}
    />
  );
}
