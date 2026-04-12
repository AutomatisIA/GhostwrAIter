import { describe, expect, it } from "vitest";
import {
  buildCspMetaTag,
  cspForMode,
  developmentCsp,
  injectCspMetaTag,
  productionCsp
} from "../../app/build/csp";

const sampleHtml = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <title>GhostwrAIter</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;

describe("cspForMode", () => {
  it("returns the production policy for production", () => {
    expect(cspForMode("production")).toBe(productionCsp);
  });

  it("returns the development policy for development", () => {
    expect(cspForMode("development")).toBe(developmentCsp);
  });
});

describe("buildCspMetaTag", () => {
  it("wraps the production policy in a proper meta http-equiv tag", () => {
    const tag = buildCspMetaTag("production");
    expect(tag).toContain('<meta http-equiv="Content-Security-Policy"');
    expect(tag).toContain(`content="${productionCsp}"`);
    expect(tag).toMatch(/^<meta [^>]*\/?>$/);
  });

  it("wraps the development policy in a proper meta http-equiv tag", () => {
    const tag = buildCspMetaTag("development");
    expect(tag).toContain(`content="${developmentCsp}"`);
  });
});

describe("injectCspMetaTag — production", () => {
  const injected = injectCspMetaTag(sampleHtml, "production");

  it("inserts exactly one CSP meta element into the head", () => {
    const matches = injected.match(/<meta http-equiv="Content-Security-Policy"/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it("puts the CSP meta element inside the <head> block, not the body", () => {
    const headEnd = injected.indexOf("</head>");
    const metaPos = injected.indexOf("Content-Security-Policy");
    expect(metaPos).toBeGreaterThan(-1);
    expect(metaPos).toBeLessThan(headEnd);
  });

  it("contains the strict production directives", () => {
    expect(injected).toContain("script-src 'self'");
    expect(injected).toContain("object-src 'none'");
    expect(injected).toContain("form-action 'self'");
    expect(injected).not.toContain("'unsafe-eval'");
  });

  it("omits frame-ancestors because meta-tag delivery does not honor it", () => {
    // The CSP spec mandates that frame-ancestors is ignored when delivered via
    // <meta http-equiv>. Embedding protection for the Electron renderer is
    // enforced by the sandbox and navigation guards, not CSP.
    expect(injected).not.toContain("frame-ancestors");
  });

  it("preserves the existing HTML content", () => {
    expect(injected).toContain('<div id="root"></div>');
    expect(injected).toContain('<script type="module" src="/src/main.tsx"></script>');
    expect(injected).toContain("<title>GhostwrAIter</title>");
  });
});

describe("injectCspMetaTag — development", () => {
  const injected = injectCspMetaTag(sampleHtml, "development");

  it("contains the relaxed development directives including unsafe-eval and websockets", () => {
    expect(injected).toContain("'unsafe-eval'");
    expect(injected).toContain("'unsafe-inline'");
    expect(injected).toContain("ws:");
    expect(injected).toContain("connect-src 'self' ws:");
  });

  it("keeps object-src 'none' tight even in dev", () => {
    expect(injected).toContain("object-src 'none'");
  });
});

describe("injectCspMetaTag — safety", () => {
  it("throws if a CSP meta element is already present", () => {
    const withExistingCsp = sampleHtml.replace(
      "<title>",
      '<meta http-equiv="Content-Security-Policy" content="default-src none"><title>'
    );
    expect(() => injectCspMetaTag(withExistingCsp, "production")).toThrow();
  });

  it("throws if the input HTML has no <head> element", () => {
    const noHead = `<html><body><div id="root"></div></body></html>`;
    expect(() => injectCspMetaTag(noHead, "production")).toThrow();
  });
});
