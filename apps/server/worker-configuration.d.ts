interface __BaseEnv_Env {
  KILO_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  AI_GATEWAY_API_KEY?: string;
  NVIDIA_API_KEY?: string;
  MOTS_PROVIDER?: string;
  MOTS_MODEL?: string;
  /** HMAC key for join codes. At least 16 characters. Rotating it invalidates every code. */
  MOTS_SESSION_SECRET?: string;
  /** Bearer token required on POST /api/sessions. At least 16 characters. */
  MOTS_CREATE_TOKEN?: string;
  /** Comma-separated browser origins. Unset or `*` allows every origin. */
  MOTS_CORS_ORIGINS?: string;
  MOTS_CREATE_LIMIT?: string;
  MOTS_CREATE_WINDOW_SECONDS?: string;
  MOTS_CONNECT_LIMIT?: string;
  MOTS_CONNECT_WINDOW_SECONDS?: string;
  MOTS_MAX_SCHEDULES?: string;
  MOTS_MIN_RECURRENCE_SECONDS?: string;
  /** Optional Expo access token for reminder pushes. See apps/server/.dev.vars.example. */
  EXPO_ACCESS_TOKEN?: string;
  SESSIONS: DurableObjectNamespace<import("./src/index").Session>;
}

declare namespace Cloudflare {
  interface GlobalProps {
    mainModule: typeof import("./src/index");
    durableNamespaces: "Session";
  }
  interface Env extends __BaseEnv_Env {}
}

interface Env extends __BaseEnv_Env {}

type StringifyValues<EnvType extends Record<string, unknown>> = {
  [Binding in keyof EnvType]: EnvType[Binding] extends string ? EnvType[Binding] : string;
};

declare namespace NodeJS {
  interface ProcessEnv extends StringifyValues<
    Pick<
      Cloudflare.Env,
      "OPENROUTER_API_KEY" | "AI_GATEWAY_API_KEY" | "NVIDIA_API_KEY" | "MOTS_PROVIDER" | "MOTS_MODEL"
    >
  > {}
}

declare module "*.txt" {
  const value: string;
  export default value;
}
declare module "*.html" {
  const value: string;
  export default value;
}
declare module "*.sql" {
  const value: string;
  export default value;
}
declare module "*.bin" {
  const value: ArrayBuffer;
  export default value;
}
declare module "*.wasm" {
  const value: WebAssembly.Module;
  export default value;
}
declare module "*.wasm?module" {
  const value: WebAssembly.Module;
  export default value;
}
