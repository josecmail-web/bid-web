/**
 * Tras publicar una versión nueva, las páginas que ya estaban abiertas llaman a Server Actions que el
 * servidor ya no reconoce (Next cambia sus identificadores en cada build) y la acción no se ejecuta.
 * Lo detectamos y recargamos la página, como mucho una vez por minuto para no entrar en bucle.
 */
export function isStaleDeploy(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /Server Action .* was not found on the server|failed-to-find-server-action/i.test(msg);
}

export function reloadForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem("bidra-reload") || 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem("bidra-reload", String(Date.now()));
  } catch {
    // sin sessionStorage: recargamos igualmente
  }
  setTimeout(() => window.location.reload(), 1200);
  return true;
}
