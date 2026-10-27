/**
 * Local-only publish tooling (Import JSON, Figma REST API, Figma plugin).
 * Netlify sets VITE_ENABLE_PUBLISH=false at build time. Local `npm run dev`
 * leaves it unset, so these features stay available after cloning the repo.
 */
export const enablePublish = import.meta.env.VITE_ENABLE_PUBLISH !== "false";
