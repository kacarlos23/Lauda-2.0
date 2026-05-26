import {
  buildDeleteInstrumentConfirmation,
  canManageInstrumentCatalog,
  normalizeColorHex,
  normalizeInstrumentName,
  validateInstrumentForm,
} from "./instrumentCatalog";

describe("instrumentCatalog utils", () => {
  it("permite acesso apenas para admins", () => {
    expect(canManageInstrumentCatalog("TENANT_ADMIN")).toBe(true);
    expect(canManageInstrumentCatalog("GLOBAL_ADMIN")).toBe(true);
    expect(canManageInstrumentCatalog("MEMBER")).toBe(false);
    expect(canManageInstrumentCatalog("MINISTRY_LEADER")).toBe(false);
  });

  it("normaliza nome e cor", () => {
    expect(normalizeInstrumentName("  Teclado  ")).toBe("Teclado");
    expect(normalizeColorHex(" #22c55e ")).toBe("#22C55E");
    expect(normalizeColorHex(" ")).toBeNull();
  });

  it("valida nome minimo e cor hexadecimal opcional", () => {
    expect(validateInstrumentForm({ name: "A" })).toBe("Nome deve ter ao menos 2 caracteres.");
    expect(validateInstrumentForm({ name: "Baixo", colorHex: "verde" })).toBe("Cor deve estar no formato #RRGGBB.");
    expect(validateInstrumentForm({ name: "Baixo", colorHex: "#22C55E" })).toBeNull();
    expect(validateInstrumentForm({ name: "Baixo" })).toBeNull();
  });

  it("monta confirmacao de delete com cancelar e excluir", () => {
    const onConfirm = jest.fn();
    const confirmation = buildDeleteInstrumentConfirmation(onConfirm);

    expect(confirmation.title).toBe("Excluir instrumento?");
    expect(confirmation.message).toBe("Os vínculos existentes com membros serão removidos.");
    expect(confirmation.buttons[0]).toMatchObject({ text: "Cancelar", style: "cancel" });
    expect(confirmation.buttons[1]).toMatchObject({ text: "Excluir", style: "destructive" });

    confirmation.buttons[1].onPress?.();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
