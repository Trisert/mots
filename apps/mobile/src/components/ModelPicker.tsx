import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ModelCatalogEntry, ModelCatalogResponse } from "@mots/protocol";
import { fetchModelCatalog } from "../api";
import { useTheme } from "../context/ThemeContext";
import { modelBadges, modelKey, modelSections } from "../model-picker";
import { presentModel, providerLabel, type AgentModelSource } from "../present";
import { fonts, hit, radius, spacing, type as typeScale, type ThemeColors } from "../theme";
import { Banner } from "../ui/Banner";
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";
import { CheckIcon, CloseIcon, SearchIcon } from "./Icon";

type Props = {
  readonly visible: boolean;
  readonly apiUrl: string;
  readonly sessionId: string;
  readonly agent: AgentModelSource | undefined;
  readonly onClose: () => void;
  /** Resolves false when the server refuses the model. */
  readonly onSelect: (provider: string, modelId: string) => Promise<boolean> | boolean;
};

type Load =
  | { readonly state: "loading" }
  | { readonly state: "ready"; readonly catalog: ModelCatalogResponse }
  | { readonly state: "failed"; readonly message: string };

/**
 * Full-height model picker. The list comes from the server, so it only shows models this session
 * can really use. A choice stays pending until the conversation snapshot reports the new model.
 */
export function ModelPicker({ visible, apiUrl, sessionId, agent, onClose, onSelect }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState<string | undefined>(undefined);
  const [refused, setRefused] = useState(false);

  const live = presentModel(agent);
  const liveKey = live === undefined ? undefined : modelKey({ provider: live.provider, id: live.modelId });

  const reload = useCallback(() => {
    setLoad({ state: "loading" });
    let alive = true;
    fetchModelCatalog(apiUrl, sessionId)
      .then((catalog) => {
        if (alive) setLoad({ state: "ready", catalog });
      })
      .catch((error: unknown) => {
        if (alive) {
          setLoad({
            state: "failed",
            message: error instanceof Error ? error.message : "Non riesco a caricare i modelli.",
          });
        }
      });
    return () => {
      alive = false;
    };
  }, [apiUrl, sessionId]);

  useEffect(() => {
    if (!visible) return;
    setQuery("");
    setProvider(undefined);
    setRefused(false);
    return reload();
  }, [visible, reload]);

  // Close once the server reports the model that was asked for.
  useEffect(() => {
    if (pending !== undefined && pending === liveKey) {
      setPending(undefined);
      onClose();
    }
  }, [liveKey, onClose, pending]);

  const choose = (entry: ModelCatalogEntry) => {
    const key = modelKey(entry);
    if (key === liveKey) {
      onClose();
      return;
    }
    setRefused(false);
    setPending(key);
    void Promise.resolve(onSelect(entry.provider, entry.id)).then((ok) => {
      if (ok) return;
      setPending(undefined);
      setRefused(true);
    });
  };

  const catalog = load.state === "ready" ? load.catalog : undefined;
  const sections = useMemo(
    () => (catalog === undefined ? [] : modelSections(catalog, { query, provider })),
    [catalog, provider, query],
  );
  const names = useMemo(
    () => new Map(catalog?.providers.map((entry) => [entry.id, entry.name]) ?? []),
    [catalog],
  );
  const nameOf = (id: string) => names.get(id) ?? providerLabel(id);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View
        role="dialog"
        aria-modal={true}
        aria-label="Scegli il modello"
        style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}
      >
        <View style={styles.header}>
          <Text role="heading" aria-level={1} style={styles.title}>
            Modello
          </Text>
          <IconButton label="Chiudi" onPress={onClose}>
            <CloseIcon size={20} color={colors.textPrimary} />
          </IconButton>
        </View>
        {live !== undefined ? (
          <Text style={styles.current} numberOfLines={1}>
            In uso: {nameOf(live.provider)} · {live.modelId}
          </Text>
        ) : null}

        <View style={styles.search}>
          <SearchIcon size={16} color={colors.textSecondary} strokeWidth={1.8} />
          <TextInput
            accessibilityLabel="Cerca un modello"
            value={query}
            onChangeText={setQuery}
            placeholder="Cerca per nome o fornitore"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.searchInput}
          />
          {query.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancella la ricerca"
              onPress={() => setQuery("")}
              style={styles.clear}
            >
              <CloseIcon size={14} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        {catalog !== undefined && catalog.providers.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chips}
          >
            {[{ id: undefined, name: "Tutti" }, ...catalog.providers].map((option) => {
              const selected = option.id === provider;
              return (
                <Pressable
                  key={option.id ?? "all"}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setProvider(option.id)}
                  style={[
                    styles.chip,
                    selected
                      ? { backgroundColor: colors.invertBg, borderColor: colors.invertBg }
                      : { borderColor: colors.fieldBorder },
                  ]}
                >
                  <Text style={[styles.chipLabel, { color: selected ? colors.invertFg : colors.textPrimary }]}>
                    {option.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {refused ? (
          <View style={styles.banner}>
            <Banner
              message="Il server non ha accettato questo modello. Scegline un altro."
              onDismiss={() => setRefused(false)}
            />
          </View>
        ) : null}

        {load.state === "loading" ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.textSecondary} />
            <Text style={styles.muted}>Carico i modelli disponibili…</Text>
          </View>
        ) : load.state === "failed" ? (
          <View style={styles.center}>
            <Text style={styles.muted}>{load.message}</Text>
            <Button label="Riprova" variant="secondary" onPress={reload} />
          </View>
        ) : (
          <SectionList
            style={styles.list}
            sections={sections.map((section) => ({ title: section.title, data: [...section.data] }))}
            keyExtractor={modelKey}
            keyboardShouldPersistTaps="handled"
            stickySectionHeadersEnabled={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.muted}>Nessun modello corrisponde alla ricerca.</Text>
              </View>
            }
            renderSectionHeader={({ section }) => (
              <Text role="heading" aria-level={2} style={styles.section}>
                {section.title}
              </Text>
            )}
            renderItem={({ item }) => {
              const key = modelKey(item);
              const active = key === liveKey;
              const waiting = key === pending;
              const badges = modelBadges(item);
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active, busy: waiting }}
                  accessibilityLabel={[item.name, nameOf(item.provider), ...badges, active ? "In uso" : undefined]
                    .filter((part) => part !== undefined)
                    .join(". ")}
                  disabled={pending !== undefined}
                  onPress={() => choose(item)}
                  style={({ pressed }) => [styles.row, active && styles.rowActive, pressed && styles.pressed]}
                >
                  <View style={styles.rowCopy}>
                    <Text numberOfLines={1} style={[styles.rowTitle, active && styles.rowTitleActive]}>
                      {item.name}
                    </Text>
                    <Text numberOfLines={1} style={styles.rowMeta}>
                      {nameOf(item.provider)} · {item.id}
                    </Text>
                    {badges.length > 0 ? (
                      <View style={styles.badges}>
                        {badges.map((badge) => (
                          <Text key={badge} style={styles.badge}>
                            {badge}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                  </View>
                  {waiting ? (
                    <ActivityIndicator color={colors.textSecondary} />
                  ) : active ? (
                    <CheckIcon size={18} color={colors.textPrimary} />
                  ) : null}
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.bgMain,
    },
    header: {
      flexShrink: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingLeft: spacing.lg,
      paddingRight: spacing.sm,
    },
    title: {
      fontFamily: fonts.serif,
      fontSize: 28,
      lineHeight: 32,
      letterSpacing: -0.5,
      color: colors.textPrimary,
    },
    current: {
      ...typeScale.small,
      flexShrink: 0,
      color: colors.textSecondary,
      paddingHorizontal: spacing.lg,
      marginTop: spacing.xs,
    },
    search: {
      flexShrink: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginHorizontal: spacing.lg,
      marginTop: spacing.lg,
      paddingLeft: spacing.md,
      minHeight: hit,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.fieldBorder,
      backgroundColor: colors.field,
    },
    searchInput: {
      flex: 1,
      minHeight: hit,
      fontFamily: fonts.regular,
      fontSize: 16,
      color: colors.textPrimary,
    },
    clear: {
      width: hit,
      height: hit,
      alignItems: "center",
      justifyContent: "center",
    },
    // The list below takes the remaining height; nothing above it may shrink.
    chipsScroll: {
      flexGrow: 0,
      flexShrink: 0,
      marginTop: spacing.md,
    },
    chips: {
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    chip: {
      minHeight: 36,
      justifyContent: "center",
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
    },
    chipLabel: {
      ...typeScale.label,
    },
    list: {
      flex: 1,
    },
    banner: {
      flexShrink: 0,
      paddingHorizontal: spacing.lg,
      marginTop: spacing.md,
    },
    center: {
      alignItems: "center",
      gap: spacing.md,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.xxxl,
    },
    muted: {
      ...typeScale.small,
      color: colors.textSecondary,
      textAlign: "center",
    },
    section: {
      ...typeScale.kicker,
      color: colors.textSecondary,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
      paddingBottom: spacing.sm,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      minHeight: hit + spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    rowActive: {
      backgroundColor: colors.surfaceSoft,
    },
    pressed: {
      opacity: 0.7,
    },
    rowCopy: {
      flex: 1,
      gap: 2,
    },
    rowTitle: {
      fontFamily: fonts.medium,
      fontSize: 16,
      lineHeight: 22,
      color: colors.textPrimary,
    },
    rowTitleActive: {
      fontFamily: fonts.semiBold,
    },
    rowMeta: {
      ...typeScale.mono,
      color: colors.textSecondary,
    },
    badges: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
      marginTop: spacing.xs,
    },
    badge: {
      ...typeScale.caption,
      fontFamily: fonts.medium,
      color: colors.textSecondary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.fieldBorder,
      borderRadius: radius.xs,
      paddingHorizontal: 6,
      paddingVertical: 1,
      overflow: "hidden",
    },
  });
}
