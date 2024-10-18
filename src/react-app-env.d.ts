/// <reference types="react-scripts" />

declare namespace NodeJS {
  interface ProcessEnv {
    REACT_APP_WEBPACK_RESOLVE_FALLBACK: string;
  }
}
