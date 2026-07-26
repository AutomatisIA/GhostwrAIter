import { describe, expect, it, vi } from "vitest";
import { migrateStoredEngineName } from "../../app/main/domains/execution/engine-registry";

/**
 * Migration du nom de moteur enregistre.
 *
 * Gemini CLI a ete retire par Google aux particuliers le 25 juillet 2026 et
 * remplace par la suite Antigravity. Le nom de moteur est passe de « gemini » a
 * « antigravity », mais le choix de l utilisateur est PERSISTE dans
 * `app_settings` : une installation existante porte encore l ancienne chaine.
 *
 * Sans traduction, deux choses cassent, et aucune n est visible a la lecture du
 * diff de renommage :
 *   - `cliEngineNameSchema` rejette « gemini », donc la validation du canal IPC
 *     echoue sur une valeur pourtant ecrite par l application elle-meme ;
 *   - `getEngineByName("gemini")` ne trouve rien, la resolution retombe sur
 *     l ordre de priorite, et l application bascule EN SILENCE sur un autre
 *     moteur. C est precisement le comportement corrige le meme jour, ou le
 *     reglage des Parametres n etait qu un decor.
 */
describe("migrateStoredEngineName", () => {
  it("traduit le moteur retire vers son remplacant", () => {
    expect(migrateStoredEngineName("gemini")).toBe("antigravity");
  });

  it("signale la traduction pour que l appelant reecrive la valeur en base", () => {
    const onMigrated = vi.fn();
    migrateStoredEngineName("gemini", onMigrated);
    expect(onMigrated).toHaveBeenCalledWith("antigravity");
  });

  it("ne signale rien quand aucune traduction n a lieu", () => {
    const onMigrated = vi.fn();
    migrateStoredEngineName("codex", onMigrated);
    expect(onMigrated).not.toHaveBeenCalled();
  });

  it("laisse intacts les moteurs encore valides", () => {
    expect(migrateStoredEngineName("codex")).toBe("codex");
    expect(migrateStoredEngineName("claude")).toBe("claude");
    expect(migrateStoredEngineName("antigravity")).toBe("antigravity");
  });

  it("rend null en l absence de choix enregistre", () => {
    // La distinction compte : `null` declenche la selection par ordre de
    // priorite au premier lancement, alors qu une chaine vide traitee comme un
    // nom ferait echouer la resolution.
    expect(migrateStoredEngineName(null)).toBeNull();
    expect(migrateStoredEngineName("")).toBeNull();
  });
});
