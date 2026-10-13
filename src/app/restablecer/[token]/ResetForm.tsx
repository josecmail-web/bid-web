"use client";

import { useRouter } from "next/navigation";
import { useUI } from "@/lib/store";
import { resetPassword } from "@/server/actions/auth";
import { NewPasswordForm } from "@/components/NewPasswordForm";

export function ResetForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const { flash } = useUI();
  return (
    <NewPasswordForm
      email={email}
      submitLabel="Guardar contraseña"
      onSubmit={(p) => resetPassword(token, p)}
      onDone={() => {
        flash("Contraseña cambiada. Ya puedes entrar con la nueva.");
        router.replace("/login");
      }}
    />
  );
}
