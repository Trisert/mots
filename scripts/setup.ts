#!/usr/bin/env bun
/**
 * Prepares local development in one step:
 * - creates apps/server/.dev.vars from the example when it is missing;
 * - fills MOTS_SESSION_SECRET and MOTS_CREATE_TOKEN with random values when empty or too short;
 * - writes the same create token to apps/mobile/.env.local, which Expo loads automatically.
 *
 * Safe to rerun: working values are kept. Both files are gitignored. Secrets are never printed.
 *
 * Usage: bun run setup
 */
import { randomBytes } from "node:crypto";
import { chmodSync, copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fillSecrets, readVar, setVar } from "./dev-env.ts";

const root = join(import.meta.dir, "..");
const devVars = join(root, "apps/server/.dev.vars");
const example = join(root, "apps/server/.dev.vars.example");
const mobileEnv = join(root, "apps/mobile/.env.local");

export function setup(): void {
  if (!existsSync(devVars)) {
    copyFileSync(example, devVars);
    console.log("Created apps/server/.dev.vars from the example.");
  }

  const random = () => randomBytes(32).toString("base64");
  const { text, filled } = fillSecrets(readFileSync(devVars, "utf8"), random);
  if (filled.length > 0) {
    writeFileSync(devVars, text);
    console.log(`Generated in apps/server/.dev.vars: ${filled.join(", ")}.`);
  }
  try {
    chmodSync(devVars, 0o600);
  } catch {
    // Windows has no POSIX modes; the file is gitignored either way.
  }

  const token = readVar(text, "MOTS_CREATE_TOKEN");
  if (token === undefined) throw new Error("MOTS_CREATE_TOKEN is still missing from .dev.vars");
  const current = existsSync(mobileEnv) ? readFileSync(mobileEnv, "utf8") : "";
  if (readVar(current, "EXPO_PUBLIC_MOTS_CREATE_TOKEN") !== token) {
    writeFileSync(mobileEnv, setVar(current, "EXPO_PUBLIC_MOTS_CREATE_TOKEN", token));
    console.log("Copied the creation token to apps/mobile/.env.local.");
  }

  const provider = readVar(text, "MOTS_PROVIDER") ?? "kilo";
  console.log(`Environment ready. Provider: ${provider}.`);
}

if (import.meta.main) setup();
