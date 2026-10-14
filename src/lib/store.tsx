"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { isStaleDeploy, reloadForNewVersion } from "./stale";

/** Estado de interfaz compartido: toast y drawer de perfil. Los datos vienen del servidor. */

interface Ctx {
  toast: string;
  flash: (msg: string) => void;
  profileId: string | null;
  openProfile: (id: string | null) => void;
}

const UIContext = createContext<Ctx | null>(null);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState("");
  const [profileId, openProfile] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 3200);
  }, []);

  // Página abierta desde antes de publicar una versión nueva: avisar y recargar
  useEffect(() => {
    const onError = (e: PromiseRejectionEvent | ErrorEvent) => {
      const err = "reason" in e ? e.reason : e.error;
      if (isStaleDeploy(err) && reloadForNewVersion()) {
        e.preventDefault();
        flash("Hay una versión nueva de Bidra. Recargando la página…");
      }
    };
    window.addEventListener("unhandledrejection", onError);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onError);
      window.removeEventListener("error", onError);
    };
  }, [flash]);

  const value = useMemo(() => ({ toast, flash, profileId, openProfile }), [toast, flash, profileId]);
  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI fuera de UIProvider");
  return ctx;
}

export function readImage(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
