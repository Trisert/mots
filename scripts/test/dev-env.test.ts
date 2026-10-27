import { describe, expect, test } from "bun:test";
import { devServerPlan, fillSecrets, lanAddress, readVar, setVar } from "../dev-env.ts";

const random = () => "r".repeat(44);

describe("fillSecrets", () => {
  test("fills empty secrets from the example file", () => {
    const { text, filled } = fillSecrets("MOTS_SESSION_SECRET=\nMOTS_CREATE_TOKEN=\n# KILO_API_KEY=\n", random);
    expect(filled).toEqual(["MOTS_SESSION_SECRET", "MOTS_CREATE_TOKEN"]);
    expect(readVar(text, "MOTS_SESSION_SECRET")).toBe("r".repeat(44));
    expect(readVar(text, "MOTS_CREATE_TOKEN")).toBe("r".repeat(44));
    expect(text).toContain("# KILO_API_KEY=");
  });

  test("keeps secrets that already work", () => {
    const original = "MOTS_SESSION_SECRET=0123456789abcdef\nMOTS_CREATE_TOKEN=fedcba9876543210xx\n";
    const { text, filled } = fillSecrets(original, random);
    expect(filled).toEqual([]);
    expect(text).toBe(original);
  });

  test("replaces a value shorter than 16 characters and appends a missing line", () => {
    const { text, filled } = fillSecrets("MOTS_SESSION_SECRET=short", random);
    expect(filled).toEqual(["MOTS_SESSION_SECRET", "MOTS_CREATE_TOKEN"]);
    expect(text).toBe(`MOTS_SESSION_SECRET=${"r".repeat(44)}\nMOTS_CREATE_TOKEN=${"r".repeat(44)}\n`);
  });

  test("ignores commented lines", () => {
    expect(readVar("# MOTS_CREATE_TOKEN=abc\n", "MOTS_CREATE_TOKEN")).toBeUndefined();
  });

  test("keeps base64 padding in values", () => {
    expect(readVar("MOTS_CREATE_TOKEN=abc+/def==\n", "MOTS_CREATE_TOKEN")).toBe("abc+/def==");
  });
});

describe("setVar", () => {
  test("creates, replaces and appends", () => {
    expect(setVar("", "A", "1")).toBe("A=1\n");
    expect(setVar("A=1\nB=2\n", "A", "3")).toBe("A=3\nB=2\n");
    expect(setVar("B=2", "A", "1")).toBe("B=2\nA=1\n");
  });
});

describe("lanAddress", () => {
  const v4 = (address: string, internal = false) => ({ address, family: "IPv4", internal });

  test("prefers Wi-Fi ranges over virtual adapters", () => {
    expect(
      lanAddress({
        "vEthernet (WSL)": [v4("172.24.112.1")],
        lo: [v4("127.0.0.1", true)],
        "Wi-Fi": [v4("192.168.1.10"), { address: "fe80::1", family: "IPv6", internal: false }],
      }),
    ).toBe("192.168.1.10");
  });

  test("accepts 10.x and numeric families", () => {
    expect(lanAddress({ eth0: [{ address: "10.70.196.39", family: 4, internal: false }] })).toBe("10.70.196.39");
  });

  test("ignores public and loopback addresses", () => {
    expect(lanAddress({ eth0: [v4("8.8.8.8")], lo: [v4("127.0.0.1", true)] })).toBeUndefined();
  });
});

describe("devServerPlan", () => {
  test("starts a local Worker and points the app at the LAN address", () => {
    expect(devServerPlan({ lan: "192.168.1.10", port: 8787 })).toEqual({
      apiUrl: "http://192.168.1.10:8787",
      localWorker: true,
    });
  });

  test("starts a local Worker without a LAN address and sets no URL", () => {
    const plan = devServerPlan({ port: 8787 });
    expect(plan.localWorker).toBe(true);
    expect(plan.apiUrl).toBeUndefined();
  });

  test("uses a deployed server from the environment and starts no local Worker", () => {
    expect(
      devServerPlan({ remoteUrl: "https://mots.example.workers.dev/", lan: "192.168.1.10", port: 8787 }),
    ).toEqual({ apiUrl: "https://mots.example.workers.dev", localWorker: false });
  });

  test("takes a bare host from the environment as https", () => {
    expect(devServerPlan({ remoteUrl: "  mots.example.workers.dev ", port: 8787 }).apiUrl).toBe(
      "https://mots.example.workers.dev",
    );
  });

  test("ignores an empty variable", () => {
    const plan = devServerPlan({ remoteUrl: "   ", port: 8787 });
    expect(plan.localWorker).toBe(true);
    expect(plan.apiUrl).toBeUndefined();
  });
});
