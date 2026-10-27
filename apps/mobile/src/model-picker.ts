import type { ModelCatalogEntry, ModelCatalogResponse } from "@mots/protocol";
import type { Translate } from "./i18n/translate";

export type ModelSection = {
  readonly title: string;
  readonly data: readonly ModelCatalogEntry[];
};

export type ModelFilter = {
  readonly query: string;
  /** A provider id, or undefined for every provider. */
  readonly provider?: string;
};

/** Search matches every word against the name, the id and the provider name, ignoring case and accents. */
const fold = (value: string): string =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function matchesQuery(entry: ModelCatalogEntry, providerName: string, query: string): boolean {
  const words = fold(query).split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) return true;
  const haystack = fold(`${entry.name} ${entry.id} ${providerName}`);
  return words.every((word) => haystack.includes(word));
}

/**
 * The picker's sections. Without a search: Consigliati, Gratis, then Tutti i modelli. With a
 * search the order is kept but sections stay, so recommended matches still come first. Empty
 * sections are dropped. Each model appears once.
 */
export function modelSections(
  catalog: ModelCatalogResponse,
  filter: ModelFilter,
  t: Translate,
): readonly ModelSection[] {
  const names = new Map(catalog.providers.map((provider) => [provider.id, provider.name]));
  const visible = catalog.models.filter(
    (entry) =>
      (filter.provider === undefined || entry.provider === filter.provider) &&
      matchesQuery(entry, names.get(entry.provider) ?? entry.provider, filter.query),
  );
  const recommended = visible.filter((entry) => entry.recommended);
  const free = visible.filter((entry) => !entry.recommended && entry.free);
  const rest = visible.filter((entry) => !entry.recommended && !entry.free);
  return [
    { title: t("picker.recommended"), data: recommended },
    { title: t("picker.free"), data: free },
    { title: t("picker.allModels"), data: rest },
  ].filter((section) => section.data.length > 0);
}

/** `128K`, `1M`, or undefined when the catalog does not say. */
export function contextLabel(tokens: number): string | undefined {
  if (tokens <= 0) return undefined;
  if (tokens >= 1_000_000) {
    return `${Number((tokens / 1_000_000).toFixed(1))}M`;
  }
  return `${Math.round(tokens / 1_000)}K`;
}

/** Short labels for the badges under a model's name. */
export function modelBadges(entry: ModelCatalogEntry, t: Translate): readonly string[] {
  const badges: string[] = [];
  if (entry.free) badges.push(t("picker.badgeFree"));
  if (entry.vision) badges.push(t("picker.badgeVision"));
  if (entry.reasoning) badges.push(t("picker.badgeReasoning"));
  const context = contextLabel(entry.contextWindow);
  if (context !== undefined) badges.push(context);
  return badges;
}

export const modelKey = (entry: { readonly provider: string; readonly id: string }): string =>
  `${entry.provider}\u0000${entry.id}`;
