import {
  constantTimeEqual,
  createPasswordResetChallengeId,
  createPasswordResetPin,
  passwordResetHmac,
} from "../../security/passwordReset";

describe("password reset primitives", () => {
  it("generates six-digit PINs and unpredictable challenge identifiers", () => {
    const pins = Array.from({ length: 1_000 }, () => createPasswordResetPin());
    expect(pins).toEqual(expect.arrayContaining([expect.stringMatching(/^\d{6}$/)]));
    expect(pins.every((pin) => /^\d{6}$/.test(pin))).toBe(true);
    expect(new Set(pins).size).toBeGreaterThan(1);
    const first = createPasswordResetChallengeId();
    const second = createPasswordResetChallengeId();
    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(40);
  });

  it("binds the HMAC to pepper, challenge, user, and PIN", () => {
    const base = { pepper: "pepper-a", challengeId: "challenge-a", userId: "user-a", pin: "123456" };
    const digest = passwordResetHmac(base);
    expect(digest).not.toContain("123456");
    expect(passwordResetHmac(base)).toBe(digest);
    expect(passwordResetHmac({ ...base, pepper: "pepper-b" })).not.toBe(digest);
    expect(passwordResetHmac({ ...base, challengeId: "challenge-b" })).not.toBe(digest);
    expect(passwordResetHmac({ ...base, userId: "user-b" })).not.toBe(digest);
    expect(passwordResetHmac({ ...base, pin: "654321" })).not.toBe(digest);

    const attackerDigest = passwordResetHmac({ ...base, pepper: "database-dump-does-not-contain-this" });
    expect(constantTimeEqual(attackerDigest, digest)).toBe(false);
  });

  it("compares equal digests without accepting different lengths", () => {
    expect(constantTimeEqual("same", "same")).toBe(true);
    expect(constantTimeEqual("same", "different")).toBe(false);
  });
});
