#!/usr/bin/env bun
/**
 * One command for local testing, on the computer and on a phone on the same Wi-Fi:
 * 1. runs `setup` (secrets in .dev.vars, create token for the app);
 * 2. starts the Worker under Node on 0.0.0.0:8787 and waits for /api/health;
 * 3. starts Expo with the server URL set to this computer's LAN address, so the app on the phone
 *    finds the server without typing anything in onboarding.
 *
 * Usage: bun run dev        (Expo: QR code for Expo Go, press w for the browser)
 *        bun run dev --web  (opens the web preview directly)
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { networkInterfaces } from "node:os";
import { join } from "node:path";
import { lanAddress } from "./dev-env.ts";
import { setup } from "./setup.ts";

const root = join(import.meta.dir, "..");
const PORT = 8787;
const web = process.argv.includes("--web");

const fail = (message: string): never => {
  console.error(`\n${message}`);
  process.exit(1);
};

const health = async (): Promise<number | undefined> => {
  try {
    const response = await fetch(`http://localhost:${PORT}/api/health`, {
      signal: AbortSignal.timeout(2_000),
    });
    return response.status;
  } catch {
    return undefined;
  }
};

setup();

// Wrangler dev answers 503 when Bun launches it, so it must run on Node 22+.
const node = spawnSync("node", ["--version"], { encoding: "utf8" });
const major = Number(/^v(\d+)/.exec(node.stdout?.trim() ?? "")?.[1]);
if (node.error !== undefined || !(major >= 22)) {
  fail("Serve Node.js 22 o successivo nel PATH (https://nodejs.org). Il server non parte con Bun.");
}

let server: ChildProcess | undefined;
let stopping = false;
if ((await health()) === 200) {
  console.log(`Uso il server già avviato su http://localhost:${PORT}.`);
} else {
  const wrangler = join(root, "apps/server/node_modules/wrangler/bin/wrangler.js");
  server = spawn("node", [wrangler, "dev", "--ip", "0.0.0.0", "--port", String(PORT)], {
    cwd: join(root, "apps/server"),
    stdio: ["ignore", "pipe", "pipe"],
  });
  const prefix = (chunk: Buffer) =>
    chunk
      .toString()
      .split(/\r?\n/)
      .filter((line) => line.length > 0)
      .map((line) => `[server] ${line}\n`)
      .join("");
  server.stdout?.on("data", (chunk: Buffer) => process.stdout.write(prefix(chunk)));
  server.stderr?.on("data", (chunk: Buffer) => process.stderr.write(prefix(chunk)));
  server.on("exit", (code) => {
    if (!stopping && code !== 0 && code !== null) fail(`Il server si è fermato (codice ${code}).`);
  });

  let status: number | undefined;
  for (let attempt = 0; attempt < 90 && status !== 200; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    status = await health();
  }
  if (status !== 200) {
    server.kill();
    fail(`Il server non risponde su http://localhost:${PORT}/api/health (stato ${status ?? "nessuno"}).`);
  }
}

const lan = lanAddress(networkInterfaces());
const env: NodeJS.ProcessEnv = { ...process.env };
if (lan !== undefined) {
  // Both the QR code and the app's default server point at the same LAN address.
  env.EXPO_PUBLIC_MOTS_API_URL = `http://${lan}:${PORT}`;
  env.REACT_NATIVE_PACKAGER_HOSTNAME = lan;
}

console.log("");
console.log(`Server pronto: http://localhost:${PORT}`);
if (lan !== undefined) {
  console.log(`Dal telefono (stessa Wi-Fi): app su http://${lan}:8081, server su http://${lan}:${PORT}`);
  console.log("Se il telefono non si collega, consenti Node.js nel firewall per le reti private.");
} else {
  console.log("Nessun indirizzo di rete locale trovato: il telefono non potrà raggiungere il server.");
}
console.log("");

const expo = spawn(process.execPath, ["run", web ? "web" : "start"], {
  cwd: join(root, "apps/mobile"),
  env,
  stdio: "inherit",
});

const stop = () => {
  stopping = true;
  server?.kill();
  expo.kill();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
expo.on("exit", (code) => {
  stopping = true;
  server?.kill();
  process.exit(code ?? 0);
});
