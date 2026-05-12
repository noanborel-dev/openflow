// Image asset imports — vite hashes + bundles these at build time and
// resolves them as URL strings at runtime. These declarations have to
// live in a file with NO imports/exports so they're treated as
// ambient (global) by TypeScript. Putting them in global.d.ts didn't
// work because that file imports Settings and so its module
// declarations are scoped to that file's module.
declare module '*.png' {
  const src: string
  export default src
}
declare module '*.webp' {
  const src: string
  export default src
}
declare module '*.jpg' {
  const src: string
  export default src
}
declare module '*.jpeg' {
  const src: string
  export default src
}
declare module '*.svg' {
  const src: string
  export default src
}
