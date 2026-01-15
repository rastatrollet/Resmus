/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_VASTTRAFIK_AUTH: string
    readonly VITE_TRAFIKLAB_API_KEY: string
    readonly VITE_TRAFIKLAB_STATIC_KEY: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
