import { describe, expect, it } from "vitest";
import { extractSkillPayload } from "../../app/main/domains/execution/extract-skill-payload";

const SKILL_JSON =
  '{"status":"succeeded","summary":"ok","data":{"draft":{"headline":"H","bodyMarkdown":"B"}}}';

describe("extractSkillPayload", () => {
  it("laisse passer un contrat deja nu", () => {
    expect(extractSkillPayload(SKILL_JSON)).toBe(SKILL_JSON);
  });

  it("deballe l enveloppe de Claude Code (--output-format json)", () => {
    // Forme reelle observee le 2026-07-25 : le contrat de la skill est une
    // CHAINE dans `result`, l objet de premier niveau est celui du CLI.
    const envelope = JSON.stringify({
      type: "result",
      subtype: "success",
      is_error: false,
      session_id: "abc",
      result: SKILL_JSON
    });

    expect(extractSkillPayload(envelope)).toBe(SKILL_JSON);
  });

  it("deballe l enveloppe de Gemini CLI (--json)", () => {
    const envelope = JSON.stringify({ response: SKILL_JSON });

    expect(extractSkillPayload(envelope)).toBe(SKILL_JSON);
  });

  it("retire les delimiteurs de bloc markdown", () => {
    expect(extractSkillPayload("```json\n" + SKILL_JSON + "\n```")).toBe(SKILL_JSON);
    expect(extractSkillPayload("```\n" + SKILL_JSON + "\n```")).toBe(SKILL_JSON);
  });

  it("deballe une enveloppe dont le contenu est lui-meme delimite", () => {
    const envelope = JSON.stringify({
      type: "result",
      result: "```json\n" + SKILL_JSON + "\n```"
    });

    expect(extractSkillPayload(envelope)).toBe(SKILL_JSON);
  });

  it("ne deballe pas un contrat de skill qui porte lui-meme une cle result", () => {
    // Garde-fou : `status` en premier niveau signe un contrat de skill, pas une
    // enveloppe de CLI. On ne doit pas le deballer, sous peine de perdre la
    // sortie reelle.
    const skillWithResult = '{"status":"succeeded","summary":"ok","result":"texte"}';

    expect(extractSkillPayload(skillWithResult)).toBe(skillWithResult);
  });

  it("rend la chaine d origine quand elle n est pas du JSON", () => {
    expect(extractSkillPayload("pas du json")).toBe("pas du json");
  });
});
