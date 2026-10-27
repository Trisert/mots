/** Labels and summaries for the Agent's tools. */
import type { MessageKey, Translate } from "./i18n/translate";
import { formatDateTime } from "./format";

const TOOL_LABEL_KEYS: Record<string, MessageKey> = {
  remember: "tool.memory",
  forget: "tool.forget",
  schedule: "tool.schedule",
  search_history: "tool.search",
  fetch_page: "tool.page",
};

/** The short name of a tool in the transcript, in the app's language. Unknown tools keep their id. */
export function toolLabel(name: string, t: Translate): string {
  const key = TOOL_LABEL_KEYS[name];
  return key === undefined ? name : t(key);
}

type Details = Readonly<Record<string, unknown>>;

const asDetails = (value: unknown): Details | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Details)
    : undefined;

/**
 * A short description of what a tool did, built from the structured result the tool returns. The
 * raw tool output is written for the model, not for the person, so it never reaches the transcript
 * unless the tool failed.
 */
export function toolSummary(
  name: string,
  details: unknown,
  t: Translate,
  localeTag = "en-GB",
): string | undefined {
  const info = asDetails(details);
  if (info === undefined) return undefined;
  switch (name) {
    case "remember":
      return info.stored === true ? t("tool.rememberStored") : t("tool.rememberDuplicate");
    case "forget":
      if (typeof info.removed !== "number") return undefined;
      if (info.removed === 0) return t("tool.forgetNone");
      if (info.removed === 1) return t("tool.forgetOne");
      return t("tool.forgetMany", { count: info.removed });
    case "schedule": {
      const scheduleName = typeof info.name === "string" ? info.name : undefined;
      const when =
        typeof info.runAt === "string" ? formatDateTime(info.runAt, localeTag) : undefined;
      if (scheduleName !== undefined && when !== undefined) {
        return t("tool.scheduleNamedAt", { name: scheduleName, when });
      }
      if (scheduleName !== undefined) {
        return t("tool.scheduleNamed", { name: scheduleName });
      }
      return when === undefined ? t("tool.scheduled") : t("tool.scheduledAt", { when });
    }
    case "search_history":
      return t("tool.searchDone");
    case "fetch_page":
      return typeof info.url === "string" ? t("tool.pageRead") : undefined;
    default:
      return undefined;
  }
}
