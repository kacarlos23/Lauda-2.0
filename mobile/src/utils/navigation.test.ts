import { goBackTo, safeReturnTo } from "./navigation";

describe("navigation", () => {
  it("volta para o pai lógico sem depender do histórico", () => {
    const router = { replace: jest.fn() };
    goBackTo(router, "/songs");
    expect(router.replace).toHaveBeenCalledWith("/songs");
  });

  it("aceita apenas destinos de retorno conhecidos", () => {
    expect(safeReturnTo("/church", ["/church", "/profile"], "/profile")).toBe("/church");
    expect(safeReturnTo("https://example.com", ["/church", "/profile"], "/profile")).toBe("/profile");
    expect(safeReturnTo(undefined, ["/church", "/profile"], "/profile")).toBe("/profile");
  });
});
