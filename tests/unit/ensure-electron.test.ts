import { describe, expect, it } from "vitest";
// Plain ESM helper, resolved through `allowJs` in tsconfig.node.json.
import { electronInstallState } from "../../scripts/ensure-electron.mjs";

/**
 * The case that matters is the third one: `path.txt` present, binary absent.
 *
 * Electron's postinstall writes that pointer before the extraction finishes, so
 * an interrupted install keeps the pointer and loses the binary. Windows CI hit
 * exactly that, with `os error 183` during extraction, and npm still reported
 * success. Checking only for `path.txt` would have called it healthy.
 */
describe("electron install state", () => {
  it("reports a usable install when the pointer and the binary are both there", () => {
    expect(
      electronInstallState({
        packageExists: true,
        pathTxt: "dist/Electron.app/Contents/MacOS/Electron",
        binaryExists: true
      })
    ).toBe("usable");
  });

  it("asks for a repair when the pointer exists but the binary does not", () => {
    expect(
      electronInstallState({
        packageExists: true,
        pathTxt: "dist/electron.exe",
        binaryExists: false
      })
    ).toBe("needs-repair");
  });

  it.each([null, "", "   ", "\n"])(
    "asks for a repair when path.txt is absent or blank (%j)",
    (pathTxt) => {
      expect(
        electronInstallState({ packageExists: true, pathTxt, binaryExists: false })
      ).toBe("needs-repair");
    }
  );

  // Distinguished from a broken install on purpose: there is nothing to repair
  // before `npm ci` has run, and reporting "repair" would send the caller into
  // a download that cannot succeed.
  it("distinguishes an absent package from a broken one", () => {
    expect(
      electronInstallState({ packageExists: false, pathTxt: null, binaryExists: false })
    ).toBe("missing-package");
  });
});
