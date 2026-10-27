/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_PUBLISH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
