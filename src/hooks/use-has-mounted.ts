import { useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}
function getSnapshot() {
  return true;
}
function getServerSnapshot() {
  return false;
}

/**
 * `true` só depois que o componente hidratou no cliente. Usar quando o
 * markup depende de algo que só existe no browser (ex: tema resolvido
 * pelo next-themes) — evita mismatch de hidratação sem o anti-padrão de
 * `useEffect(() => setState(true), [])`.
 */
export function useHasMounted(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
