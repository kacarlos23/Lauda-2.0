import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { config } from "../../config/unifiedConfig";
import {
  refreshTokenHash,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "../../security/tokenService";

const identity = {
  id: "user-1",
  email: "user@example.com",
  role: "MEMBER",
  tenantId: "tenant-1",
};

function forgedAccess(overrides: {
  algorithm?: "HS256" | "HS384";
  issuer?: string;
  audience?: string;
  type?: string;
  sid?: string;
} = {}): string {
  return jwt.sign(
    {
      type: overrides.type ?? "access",
      userId: identity.id,
      sid: overrides.sid === "missing" ? undefined : overrides.sid ?? "session-1",
      email: identity.email,
      role: identity.role,
      tenantId: identity.tenantId,
    },
    config.auth.jwtSecret,
    {
      algorithm: overrides.algorithm ?? "HS256",
      expiresIn: "15m",
      issuer: overrides.issuer ?? config.auth.issuer,
      audience: overrides.audience ?? config.auth.accessAudience,
      subject: identity.id,
      jwtid: crypto.randomUUID(),
    },
  );
}

describe("strict JWT token contract", () => {
  it("emite e valida access e refresh com propósito, sid, jti, issuer, audience e HS256", () => {
    const accessToken = signAccessToken(identity, "session-1");
    const refreshToken = signRefreshToken(identity.id, "session-1");

    expect(verifyAccessToken(accessToken)).toMatchObject({ type: "access", sid: "session-1", userId: identity.id });
    expect(verifyRefreshToken(refreshToken)).toMatchObject({ type: "refresh", sid: "session-1", userId: identity.id });
    expect(jwt.decode(accessToken, { complete: true })?.header.alg).toBe("HS256");
    expect(jwt.decode(refreshToken, { complete: true })?.header.alg).toBe("HS256");
  });

  it("separa inequivocamente access e refresh", () => {
    expect(() => verifyAccessToken(signRefreshToken(identity.id, "session-1"))).toThrow();
    expect(() => verifyRefreshToken(signAccessToken(identity, "session-1"))).toThrow();
  });

  it.each([
    ["issuer", { issuer: "wrong-issuer" }],
    ["audience", { audience: "wrong-audience" }],
    ["type", { type: "refresh" }],
    ["sid", { sid: "missing" }],
    ["algorithm", { algorithm: "HS384" as const }],
  ])("rejeita access com %s inválido", (_label, overrides) => {
    expect(() => verifyAccessToken(forgedAccess(overrides))).toThrow();
  });

  it("gera hash determinístico sem armazenar o refresh em claro", () => {
    const token = signRefreshToken(identity.id, "session-1");
    expect(refreshTokenHash(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(refreshTokenHash(token)).not.toBe(token);
    expect(refreshTokenHash(token)).toBe(refreshTokenHash(token));
  });
});
