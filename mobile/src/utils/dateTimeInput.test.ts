import { combineDisplayDateTimeToIso, isValidTime, maskDateInput, maskTimeInput, parseDisplayDate } from "./dateTimeInput";

describe("dateTimeInput", () => {
  it("aplica máscara de data e hora", () => {
    expect(maskDateInput("30062026")).toBe("30/06/2026");
    expect(maskDateInput("30/0")).toBe("30/0");
    expect(maskTimeInput("1930")).toBe("19:30");
  });

  it("valida datas reais no formato DD/MM/AAAA", () => {
    expect(parseDisplayDate("30/06/2026")?.getFullYear()).toBe(2026);
    expect(parseDisplayDate("31/02/2026")).toBeNull();
    expect(parseDisplayDate("2026-06-30")).toBeNull();
  });

  it("valida horário HH:mm e combina para ISO", () => {
    expect(isValidTime("23:59")).toBe(true);
    expect(isValidTime("24:00")).toBe(false);
    expect(combineDisplayDateTimeToIso("30/06/2026", "19:30")).toContain("2026");
    expect(combineDisplayDateTimeToIso("30/06/2026", "99:30")).toBeNull();
  });
});
