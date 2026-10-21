interface __BaseEnv_Env {
  OPENROUTER_API_KEY: string;
  MOTS_MODEL?: string;
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
  interface ProcessEnv extends StringifyValues<Pick<Cloudflare.Env, "OPENROUTER_API_KEY" | "MOTS_MODEL">> {}
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
