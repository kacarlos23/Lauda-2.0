import { effectivePermissionsFromOverrides, nextPermissionEffect } from "./permissionOverrides";

describe("permission override editor", () => {
  it("cycles through inherited, allowed and denied", () => {
    expect(nextPermissionEffect(undefined)).toBe("ALLOW");
    expect(nextPermissionEffect("ALLOW")).toBe("DENY");
    expect(nextPermissionEffect("DENY")).toBeUndefined();
  });

  it("previews ALLOW and DENY over the role baseline", () => {
    expect(effectivePermissionsFromOverrides(
      ["song:view", "schedule:respond"],
      { "song:view": "DENY", "song:create": "ALLOW" }
    )).toEqual(expect.arrayContaining(["schedule:respond", "song:create"]));
    expect(effectivePermissionsFromOverrides(
      ["song:view"],
      { "song:view": "DENY" }
    )).not.toContain("song:view");
  });
});
