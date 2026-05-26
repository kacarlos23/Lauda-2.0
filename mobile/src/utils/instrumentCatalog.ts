import { Role } from "../types";

export const instrumentColorPattern = /^#[0-9A-Fa-f]{6}$/;

export type InstrumentFormValues = {
  name: string;
  colorHex?: string;
};

export function canManageInstrumentCatalog(role?: Role | string | null): boolean {
  return role === "TENANT_ADMIN" || role === "GLOBAL_ADMIN";
}

export function normalizeInstrumentName(name: string): string {
  return name.trim();
}

export function normalizeColorHex(colorHex?: string | null): string | null {
  const value = colorHex?.trim();
  return value ? value.toUpperCase() : null;
}

export function validateInstrumentForm(values: InstrumentFormValues): string | null {
  if (normalizeInstrumentName(values.name).length < 2) {
    return "Nome deve ter ao menos 2 caracteres.";
  }

  const colorHex = values.colorHex?.trim();
  if (colorHex && !instrumentColorPattern.test(colorHex)) {
    return "Cor deve estar no formato #RRGGBB.";
  }

  return null;
}

export function buildDeleteInstrumentConfirmation(onConfirm: () => void | Promise<void>) {
  return {
    title: "Excluir instrumento?",
    message: "Os vínculos existentes com membros serão removidos.",
    buttons: [
      { text: "Cancelar", style: "cancel" as const },
      {
        text: "Excluir",
        style: "destructive" as const,
        onPress: () => {
          void onConfirm();
        },
      },
    ],
  };
}
