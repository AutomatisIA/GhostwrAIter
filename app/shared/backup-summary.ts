/**
 * Tables named when describing a backup, in reading order, with the words a
 * user recognises.
 *
 * Deliberately a subset: link tables, generated hooks, execution runs and
 * settings say nothing to someone deciding whether to replace their work. The
 * archive manifest still carries every table, so nothing is lost, only unshown.
 */
const HUMAN_READABLE_TABLES: readonly (readonly [string, string, string])[] = [
  ["ideas", "idée", "idées"],
  ["drafts", "brouillon", "brouillons"],
  ["draft_versions", "version de brouillon", "versions de brouillon"],
  ["icps", "cible", "cibles"],
  ["offers", "offre", "offres"],
  ["pillars", "pilier", "piliers"],
  ["voice_rules", "règle de voix", "règles de voix"],
  ["calendar_items", "entrée de calendrier", "entrées de calendrier"],
  ["tags", "mot-clé", "mots-clés"]
];

/**
 * One line describing what a backup holds.
 *
 * Shared by the main process, which asks for confirmation before an import
 * replaces anything, and by the renderer, which confirms afterwards what was
 * written. Both must name the same thing, or a user cannot tell whether the
 * backup they were promised is the one they got.
 *
 * Pure string work, no Node API, so importing it into the renderer bundle is
 * safe.
 */
export function summarizeArchiveContents(tableCounts: Record<string, number>): string {
  const parts = HUMAN_READABLE_TABLES.filter(([table]) => (tableCounts[table] ?? 0) > 0).map(
    ([table, singular, plural]) => {
      const count = tableCounts[table] ?? 0;
      return `${count} ${count > 1 ? plural : singular}`;
    }
  );
  return parts.length > 0 ? parts.join(", ") : "aucune donnée";
}
