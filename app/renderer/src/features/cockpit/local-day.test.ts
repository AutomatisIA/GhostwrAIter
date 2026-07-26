/*
 * Le jour civil, lu la ou l utilisateur le lit.
 *
 * Les deux cas sont ceux ou la date UTC et la date locale divergent : un fuseau
 * positif juste apres minuit, et un fuseau negatif juste avant. Un test qui ne
 * poserait pas de fuseau mesurerait le reglage de la machine, c est-a-dire
 * rien : chaque cas commence donc par une sentinelle qui echoue bruyamment si
 * le fuseau n a pas ete applique.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { localDayIso } from "./local-day";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("localDayIso", () => {
  it("rend le jour local a Paris quand UTC est encore a la veille", () => {
    vi.stubEnv("TZ", "Europe/Paris");
    // 00:30 le 26 juillet a Paris, 22:30 le 25 a Greenwich.
    const instant = new Date("2026-07-25T22:30:00Z");

    expect(instant.getDate()).toBe(26);
    expect(instant.toISOString().slice(0, 10)).toBe("2026-07-25");
    expect(localDayIso(instant)).toBe("2026-07-26");
  });

  it("rend le jour local a New York quand UTC est deja au lendemain", () => {
    vi.stubEnv("TZ", "America/New_York");
    // 23:30 le 25 juillet a New York, 03:30 le 26 a Greenwich.
    const instant = new Date("2026-07-26T03:30:00Z");

    expect(instant.getDate()).toBe(25);
    expect(instant.toISOString().slice(0, 10)).toBe("2026-07-26");
    expect(localDayIso(instant)).toBe("2026-07-25");
  });

  it("complete les composantes a un chiffre", () => {
    vi.stubEnv("TZ", "UTC");
    expect(localDayIso(new Date("2026-01-05T12:00:00Z"))).toBe("2026-01-05");
  });
});
