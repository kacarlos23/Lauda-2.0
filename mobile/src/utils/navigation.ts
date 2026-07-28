import type { Href, Router } from "expo-router";

type BackRouter = Pick<Router, "replace">;

export function goBackTo(router: BackRouter, fallback: Href): void {
  router.replace(fallback);
}

export function safeReturnTo<const TAllowed extends readonly string[]>(
  value: string | string[] | undefined,
  allowed: TAllowed,
  fallback: TAllowed[number]
): TAllowed[number] {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && allowed.includes(candidate) ? candidate as TAllowed[number] : fallback;
}
