const {
  extractJavaScriptUrls,
  parseArguments,
  validateBundleSources,
  validateExpectedApiUrl,
} = require("../../../scripts/validate-frontend-api.cjs");

describe("frontend API build validation", () => {
  it("requires an absolute API URL", () => {
    expect(() => validateExpectedApiUrl(undefined)).toThrow("EXPO_PUBLIC_API_URL is required");
    expect(() => validateExpectedApiUrl("/api")).toThrow("absolute HTTP(S) URL");
  });

  it("requires HTTPS for non-loopback API URLs", () => {
    expect(() => validateExpectedApiUrl("http://api.example.com/api")).toThrow(
      "must use HTTPS outside loopback"
    );
    expect(validateExpectedApiUrl("http://localhost:3000/api").value).toBe(
      "http://localhost:3000/api"
    );
  });

  it("accepts a public bundle with the expected API and no local fallback", () => {
    expect(
      validateBundleSources(
        [{ name: "index.js", content: 'baseURL:"https://api.example.com/api"' }],
        "https://api.example.com/api"
      )
    ).toEqual({
      expectedApiUrl: "https://api.example.com/api",
      sourceCount: 1,
    });
  });

  it("rejects localhost leaked into a public bundle", () => {
    expect(() =>
      validateBundleSources(
        [
          {
            name: "index.js",
            content: '"https://api.example.com/api";"http://localhost:3000/api"',
          },
        ],
        "https://api.example.com/api"
      )
    ).toThrow("contains local API fallback");
  });

  it("extracts the Expo web bundle from public HTML", () => {
    const html =
      '<html><script src="/_expo/static/js/web/index-abc123.js"></script><script src="/other.js"></script></html>';

    expect(extractJavaScriptUrls(html, "https://laudaapp.com")).toEqual([
      "https://laudaapp.com/_expo/static/js/web/index-abc123.js",
    ]);
  });

  it("validates retry arguments", () => {
    expect(() => parseArguments(["--site-url", "https://laudaapp.com", "--retries", "0"])).toThrow(
      "positive integer"
    );
  });
});
