/**
 * Content Security Policy for the LinkedIn Poster renderer.
 *
 * Two environment-aware policies:
 * - production: strict, forbids external scripts, inline scripts, eval, and
 *   remote style/image/font origins.
 * - development: relaxed to permit the Vite hot-module-replacement pipeline,
 *   which requires websockets, inline scripts injected by the dev server,
 *   and eval-based module replacement.
 *
 * This module is pure TypeScript with no Electron, React, or DOM dependencies,
 * so it can be imported safely from both the electron-vite build config and
 * from unit tests.
 *
 * See contracts/webpreferences-baseline.md for the authoritative policy
 * specification.
 */

export type CspMode = "production" | "development";

export const productionCsp: string = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'"
].join("; ");

export const developmentCsp: string = [
  "default-src 'self' ws:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self' ws: http://localhost:* http://127.0.0.1:*",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'"
].join("; ");

/**
 * Returns the CSP content string for the given mode.
 */
export function cspForMode(mode: CspMode): string {
  return mode === "production" ? productionCsp : developmentCsp;
}

/**
 * Returns the <meta http-equiv="Content-Security-Policy"> tag for the given mode.
 */
export function buildCspMetaTag(mode: CspMode): string {
  const content = cspForMode(mode);
  return `<meta http-equiv="Content-Security-Policy" content="${content}" />`;
}

const EXISTING_CSP_META_REGEX = /<meta\s+http-equiv\s*=\s*["']Content-Security-Policy["']/i;
const HEAD_OPEN_REGEX = /<head(\s[^>]*)?>/i;

/**
 * Injects a CSP meta tag into the <head> of an HTML document, right after the
 * opening <head> element. If a CSP meta tag is already present, the function
 * throws to avoid silent duplication. If the input HTML has no <head> element,
 * the function also throws.
 */
export function injectCspMetaTag(html: string, mode: CspMode): string {
  if (EXISTING_CSP_META_REGEX.test(html)) {
    throw new Error(
      "injectCspMetaTag: the input HTML already contains a Content-Security-Policy meta element"
    );
  }

  const headMatch = html.match(HEAD_OPEN_REGEX);
  if (!headMatch || headMatch.index === undefined) {
    throw new Error("injectCspMetaTag: the input HTML has no <head> element");
  }

  const insertionPoint = headMatch.index + headMatch[0].length;
  const metaTag = buildCspMetaTag(mode);

  return `${html.slice(0, insertionPoint)}\n    ${metaTag}${html.slice(insertionPoint)}`;
}
