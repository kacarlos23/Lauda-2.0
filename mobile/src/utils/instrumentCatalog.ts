import { Role, User } from "../types";
import { can } from "./permissions";

export const instrumentColorPattern = /^#[0-9A-Fa-f]{6}$/;

export type InstrumentFormValues = {
  name: string;
  colorHex?: string;
};

export function canManageInstrumentCatalog(subject?: Pick<User, "role" | "permissions"> | Role | string | null): boolean {
  return can(subject, "instrument:create") || can(subject, "instrument:edit") || can(subject, "instrument:delete");
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
