import { describe, expect, test } from "bun:test";
import { defaultApiUrl } from "../src/url.ts";

describe("defaultApiUrl", () => {
  test("a bundle-time URL wins", () => {
    expect(defaultApiUrl({ envUrl: "192.168.1.10:8787/", os: "web", webHost: "localhost" })).toBe(
      "http://192.168.1.10:8787",
    );
  });

  test("the browser uses the host that served the page", () => {
    expect(defaultApiUrl({ os: "web", webHost: "10.70.196.39" })).toBe("http://10.70.196.39:8787");
    expect(defaultApiUrl({ os: "web", webHost: "localhost" })).toBe("http://localhost:8787");
    expect(defaultApiUrl({ os: "web", webHost: "::1" })).toBe("http://[::1]:8787");
  });

  test("native platforms keep their emulator defaults", () => {
    expect(defaultApiUrl({ os: "android" })).toBe("http://10.0.2.2:8787");
    expect(defaultApiUrl({ os: "ios", envUrl: " " })).toBe("http://localhost:8787");
  });
});
