"use client";

import { useEffect } from "react";

/** Registra el service worker (página «Sin conexión» de la app instalada). Solo en producción. */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
