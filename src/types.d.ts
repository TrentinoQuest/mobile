/**
 * Dichiarazioni di tipo per moduli non-standard importati come asset.
 *
 * Pattern Vite/esbuild "?raw":
 * Permette di importare un file come stringa raw a build time.
 * Esempio: `import svg from './icon.svg?raw'` -> svg: string
 *
 * Senza questa dichiarazione TypeScript non riconosce la sintassi
 * `?raw` come modulo valido e segnala errore.
 */

declare module '*.svg?raw' {
  const content: string;
  export default content;
}

// In futuro, per altri tipi di asset raw, aggiungere qui:
// declare module '*.md?raw' { ... }
// declare module '*.glsl?raw' { ... }