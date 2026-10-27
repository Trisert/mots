/** Labels shown for the Agent's tools. */
import { formatDateTime } from "./format";

export const TOOL_LABELS: Record<string, string> = {
  remember: "memoria",
  forget: "cancellazione",
  schedule: "routine autonoma",
  search_history: "ricerca",
  fetch_page: "pagina",
  web_search: "ricerca web",
};

type Details = Readonly<Record<string, unknown>>;

const asDetails = (value: unknown): Details | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Details)
    : undefined;

const formatWhen = (value: string): string | undefined => formatDateTime(value);

/**
 * A short Italian description of what a tool did, built from the structured result the tool
 * returns. The raw tool output is written for the model, not for the person, so it never reaches
 * the transcript unless the tool failed.
 */
export function toolSummary(name: string, details: unknown): string | undefined {
  const info = asDetails(details);
  if (info === undefined) return undefined;
  switch (name) {
    case "remember":
      return info.stored === true ? "Salvato in memoria" : "Già in memoria";
    case "forget":
      return typeof info.removed === "number"
        ? info.removed === 0
          ? "Nessuna memoria trovata"
          : info.removed === 1
            ? "Dimenticata 1 memoria"
            : `Dimenticate ${info.removed} memorie`
        : undefined;
    case "schedule": {
      const name = typeof info.name === "string" ? info.name : undefined;
      const when = typeof info.runAt === "string" ? formatWhen(info.runAt) : undefined;
      if (name !== undefined && when !== undefined) {
        return `Routine "${name}": ${when}`;
      }
      if (name !== undefined) {
        return `Routine "${name}" pianificata`;
      }
      return when === undefined ? "Routine autonoma pianificata" : `Routine: ${when}`;
    }
    case "search_history":
      return "Ricerca completata";
    case "fetch_page":
      return typeof info.url === "string" ? "Pagina letta" : undefined;
    case "web_search":
      return typeof info.results === "number"
        ? info.results === 1
          ? "Ricerca web: 1 risultato"
          : `Ricerca web: ${info.results} risultati`
        : undefined;
    default:
      return undefined;
  }
}
