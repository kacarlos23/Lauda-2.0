import type { Router } from "expo-router";

type BackRouter = Pick<Router, "replace">;

export function goBackTo(router: BackRouter, fallback: string): void {
  router.replace(fallback as never);
}

export function safeReturnTo(value: string | string[] | undefined, allowed: readonly string[], fallback: string): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && allowed.includes(candidate) ? candidate : fallback;
}
