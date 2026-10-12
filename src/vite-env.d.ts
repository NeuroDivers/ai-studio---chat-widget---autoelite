/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DIRECT_PLATFORM?: string;
}

declare module '*.css?inline' {
  const css: string;
  export default css;
}
