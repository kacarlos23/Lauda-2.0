import { createThemeTokens, darkColors, isThemePreference, resolveColorMode } from "./colorModes";
import { printTheme } from "./print";

function luminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((channel) => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}
function contrast(first: string, second: string) {
  const a = luminance(first), b = luminance(second);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

describe("dark preview color roles", () => {
  it("keeps the ordinary build's colors unchanged", () => {
    const light = { background: "#F4F2EC", ink: "#13231D" };
    expect(createThemeTokens(light, "color", false)).toBe(light);
    expect(createThemeTokens(light, "color", true).background).toBe("var(--lauda-color-background, #F4F2EC)");
  });
  it.each(["light", "dark", "system"])("accepts preference %s", (value) => expect(isThemePreference(value)).toBe(true));
  it.each([null, undefined, "auto", "invalid"])("rejects preference %j", (value) => expect(isThemePreference(value)).toBe(false));
  it("uses the system only when explicitly selected", () => {
    expect(resolveColorMode("system", true)).toBe("dark");
    expect(resolveColorMode("system", false)).toBe("light");
    expect(resolveColorMode("light", true)).toBe("light");
    expect(resolveColorMode("dark", false)).toBe("dark");
  });
  it.each(["ink", "text", "muted", "primary", "primaryDark", "danger", "warning", "success", "accentText"])("maintains readable contrast for %s on dark surfaces", (key) => {
    expect(contrast(darkColors[key], darkColors.surface)).toBeGreaterThanOrEqual(4.5);
  });
  it("keeps paper white independently of the screen theme", () => expect(printTheme.colors.surface).toBe("#FFFFFF"));
});
