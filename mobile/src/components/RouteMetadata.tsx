import Head from "expo-router/head";
import { usePathname } from "expo-router";

const staticTitles: Record<string, string> = {
  "/": "Visão geral | Lauda",
  "/login": "Entrar | Lauda",
  "/register": "Criar igreja | Lauda",
  "/member-register": "Entrar por convite | Lauda",
  "/convite": "Entrar por convite | Lauda",
  "/forgot-password": "Recuperar senha | Lauda",
  "/reset-password": "Redefinir senha | Lauda",
  "/schedules": "Escalas | Lauda",
  "/schedules/new": "Nova escala | Lauda",
  "/ministries": "Ministérios | Lauda",
  "/ministries/assign": "Atribuir membro | Lauda",
  "/songs": "Músicas | Lauda",
  "/songs/new": "Nova música | Lauda",
  "/artists": "Artistas | Lauda",
  "/more": "Mais | Lauda",
  "/members": "Membros | Lauda",
  "/members/new": "Novo membro | Lauda",
  "/global-admin": "Admin global | Lauda",
  "/church": "Igreja | Lauda",
  "/instruments": "Instrumentos e cargos | Lauda",
  "/profile": "Perfil | Lauda",
};

function normalizePathname(pathname: string) {
  const withoutGroup = pathname.replace(/^\/\((auth|tabs)\)/, "");
  return withoutGroup || "/";
}

function titleForPathname(pathname: string) {
  const normalized = normalizePathname(pathname);
  const staticTitle = staticTitles[normalized];
  if (staticTitle) return staticTitle;
  if (/^\/schedules\/[^/]+\/edit$/.test(normalized)) return "Editar escala | Lauda";
  if (/^\/ministries\/[^/]+\/members$/.test(normalized)) return "Membros do ministério | Lauda";
  if (/^\/ministries\/[^/]+$/.test(normalized)) return "Ministério | Lauda";
  if (/^\/songs\/[^/]+\/edit$/.test(normalized)) return "Editar música | Lauda";
  if (/^\/songs\/[^/]+$/.test(normalized)) return "Cifra | Lauda";
  return "Lauda";
}

export function RouteMetadata() {
  const pathname = usePathname();

  return (
    <Head>
      <title>{titleForPathname(pathname)}</title>
    </Head>
  );
}
