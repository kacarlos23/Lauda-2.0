import { createConfig } from "../../config/unifiedConfig";

const VALID_ACCESS_SECRET = "a".repeat(32);
const VALID_REFRESH_SECRET = "r".repeat(32);

describe("unifiedConfig JWT secrets", () => {
  it("fails in production without JWT_SECRET", () => {
    expect(() =>
      createConfig({
        NODE_ENV: "production",
        REFRESH_JWT_SECRET: VALID_REFRESH_SECRET,
      }),
    ).toThrow("JWT_SECRET is required in production");
  });

  it("fails in production without REFRESH_JWT_SECRET", () => {
    expect(() =>
      createConfig({
        NODE_ENV: "production",
        JWT_SECRET: VALID_ACCESS_SECRET,
      }),
    ).toThrow("REFRESH_JWT_SECRET is required in production");
  });

  it("initializes in production with independent valid secrets", () => {
    const productionConfig = createConfig({
      NODE_ENV: "production",
      JWT_SECRET: VALID_ACCESS_SECRET,
      REFRESH_JWT_SECRET: VALID_REFRESH_SECRET,
    });

    expect(productionConfig.auth.jwtSecret).toBe(VALID_ACCESS_SECRET);
    expect(productionConfig.auth.refreshJwtSecret).toBe(VALID_REFRESH_SECRET);
  });

  it("rejects equal access and refresh secrets in production", () => {
    expect(() =>
      createConfig({
        NODE_ENV: "production",
        JWT_SECRET: VALID_ACCESS_SECRET,
        REFRESH_JWT_SECRET: VALID_ACCESS_SECRET,
      }),
    ).toThrow(
      "JWT_SECRET and REFRESH_JWT_SECRET must use independent values in production",
    );
  });

  it.each(["JWT_SECRET", "REFRESH_JWT_SECRET"] as const)(
    "rejects a production %s shorter than 32 bytes",
    (variableName) => {
      expect(() =>
        createConfig({
          NODE_ENV: "production",
          JWT_SECRET: VALID_ACCESS_SECRET,
          REFRESH_JWT_SECRET: VALID_REFRESH_SECRET,
          [variableName]: "short-secret",
        }),
      ).toThrow(`${variableName} must be at least 32 bytes in production`);
    },
  );

  it.each(["development", "test"])(
    "initializes in %s with distinct local defaults",
    (nodeEnv) => {
      const localConfig = createConfig({ NODE_ENV: nodeEnv });

      expect(localConfig.auth.jwtSecret).toBeTruthy();
      expect(localConfig.auth.refreshJwtSecret).toBeTruthy();
      expect(localConfig.auth.refreshJwtSecret).not.toBe(
        localConfig.auth.jwtSecret,
      );
    },
  );

  it("does not reuse JWT_SECRET as the local refresh secret", () => {
    const developmentConfig = createConfig({
      NODE_ENV: "development",
      JWT_SECRET: "custom-local-access-secret",
    });

    expect(developmentConfig.auth.jwtSecret).toBe(
      "custom-local-access-secret",
    );
    expect(developmentConfig.auth.refreshJwtSecret).not.toBe(
      developmentConfig.auth.jwtSecret,
    );
  });
});
