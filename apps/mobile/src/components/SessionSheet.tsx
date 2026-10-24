import { useEffect, useMemo, useState } from "react";
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ROOT_CONVERSATION_ID, type ConversationSummary } from "@mots/protocol";
import { useTheme } from "../context/ThemeContext";
import {
  BookmarkIcon,
  BotAvatarIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  CloseIcon,
  PauseIcon,
  PlusIcon,
  SearchIcon,
  SparkleIcon,
} from "./Icon";
import { Mascot } from "./Mascot";
import { fonts, radius, spacing, type ThemeColors } from "../theme";

type Props = {
  readonly visible: boolean;
  readonly conversations: readonly ConversationSummary[];
  readonly activeConversationId: number | undefined;
  readonly sessionId: string;
  readonly username?: string;
  readonly onClose: () => void;
  readonly onSelect: (conversationId: number) => void;
  readonly onCreate: () => void;
  readonly onShare: () => void;
  readonly onLeave: () => void;
  readonly onActionSelect?: (prompt: string) => void;
  readonly onModelSelect?: (provider: string, modelId: string) => void;
};

function conversationName(conversation: ConversationSummary, index: number): string {
  if (conversation.id === ROOT_CONVERSATION_ID) return "Chat principale";
  return `Diramazione #${index}`;
}

export type ProviderModel = {
  readonly id: string;
  readonly name: string;
  readonly tag: string;
  readonly reasoning?: boolean;
  readonly free?: boolean;
};

export const PROVIDERS = [
  {
    id: "kilo",
    name: "Kilo Gateway",
    endpoint: "api.kilo.ai/api/gateway",
    badge: "Attivo",
    details: "OAuth ~/.pi/agent/auth.json · Free tier",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    endpoint: "openrouter.ai/api/v1",
    badge: "Disponibile",
    details: "OPENROUTER_API_KEY",
  },
  {
    id: "vercel-ai-gateway",
    name: "Vercel AI",
    endpoint: "ai.gateway.vercel.dev",
    badge: "Disponibile",
    details: "AI_GATEWAY_TOKEN",
  },
  {
    id: "nvidia",
    name: "NVIDIA NIM",
    endpoint: "integrate.api.nvidia.com",
    badge: "Disponibile",
    details: "NVIDIA_API_KEY",
  },
];

export const PROVIDER_MODELS: Record<string, readonly ProviderModel[]> = {
  kilo: [
    {
      id: "reflection/beam-free",
      name: "Reflection Beam",
      tag: "Free · 128k · Reasoning",
      reasoning: true,
      free: true,
    },
    {
      id: "kilo-auto/free",
      name: "Kilo Auto Free",
      tag: "Free · Routing auto",
      reasoning: true,
      free: true,
    },
    {
      id: "nvidia/nemotron-3.5-super-vl:free",
      name: "Nemotron Super VL",
      tag: "Free · Vision & Tools",
      free: true,
    },
    {
      id: "deepseek/deepseek-v4.1-flash",
      name: "DeepSeek V4.1 Flash",
      tag: "Fast · Reasoning",
      reasoning: true,
    },
    {
      id: "anthropic/claude-3.5-sonnet",
      name: "Claude 3.5 Sonnet",
      tag: "Flagship Reasoning",
      reasoning: true,
    },
  ],
  openrouter: [
    {
      id: "anthropic/claude-3.5-haiku",
      name: "Claude 3.5 Haiku",
      tag: "Fast · Balanced",
    },
    {
      id: "meta-llama/llama-3.3-70b-instruct",
      name: "Llama 3.3 70B",
      tag: "Open Source Flagship",
    },
    {
      id: "google/gemini-2.0-flash-exp:free",
      name: "Gemini 2.0 Flash",
      tag: "Free · Multimodal",
      free: true,
    },
    {
      id: "openai/gpt-4o-mini",
      name: "GPT-4o Mini",
      tag: "Efficient & Smart",
    },
  ],
  "vercel-ai-gateway": [
    {
      id: "reflection/beam-free",
      name: "Reflection Beam",
      tag: "Free · Gateway",
      free: true,
    },
    {
      id: "openai/gpt-4o-mini",
      name: "GPT-4o Mini",
      tag: "Vercel route",
    },
    {
      id: "anthropic/claude-3.5-haiku",
      name: "Claude 3.5 Haiku",
      tag: "Fast reasoning",
    },
  ],
  nvidia: [
    {
      id: "nvidia/nemotron-3.5-lightning-30b-a3b",
      name: "Nemotron Lightning 30B",
      tag: "NIM Optimized",
    },
    {
      id: "meta/llama-3.1-8b-instruct",
      name: "Llama 3.1 8B",
      tag: "Ultra-fast",
    },
    {
      id: "meta/llama-3.3-70b-instruct",
      name: "Llama 3.3 70B",
      tag: "High precision",
    },
  ],
};

const SAMPLE_ROUTINES = [
  {
    name: "Briefing mattutino",
    schedule: "Ogni giorno alle 08:00",
    status: "active",
    statusLabel: "Attiva",
    prompt: "Esegui ora il briefing mattutino: controlla note e priorità del giorno",
  },
  {
    name: "Review serale",
    schedule: "Feriali alle 18:00",
    status: "active",
    statusLabel: "Attiva",
    prompt: "Esegui ora la review serale: riassumi le note e prepara domani",
  },
  {
    name: "Sintesi settimanale",
    schedule: "Lunedì alle 09:00",
    status: "paused",
    statusLabel: "In pausa",
    prompt: "Esegui la sintesi settimanale dei progetti e scadenze",
  },
];

const AGENT_TOOLS = [
  {
    name: "Routine autonoma",
    desc: "Pianifica cronjob ed esecuzioni con il modello",
    prompt: "Pianifica una routine autonoma per ",
    icon: (color: string) => <ClockIcon size={16} color={color} />,
    colorKey: "badgeAmberBg" as const,
  },
  {
    name: "Memoria permanente",
    desc: "Consulta i fatti memorizzati dell'utente",
    prompt: "Cosa ricordi di me e delle mie preferenze?",
    icon: (color: string) => <BookmarkIcon size={16} color={color} />,
    colorKey: "badgeMintBg" as const,
  },
  {
    name: "Cerca storia",
    desc: "Cerca nelle chat passate",
    prompt: "Cosa abbiamo detto riguardo a ",
    icon: (color: string) => <SearchIcon size={16} color={color} />,
    colorKey: "badgePinkBg" as const,
  },
];

export function SessionSheet({
  visible,
  conversations,
  activeConversationId,
  sessionId,
  username,
  onClose,
  onSelect,
  onCreate,
  onShare,
  onLeave,
  onActionSelect,
  onModelSelect,
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors, mode, setMode, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [tab, setTab] = useState<"chat" | "routines" | "models">("chat");
  const [selectedProviderId, setSelectedProviderId] = useState("kilo");
  const [selectedModelId, setSelectedModelId] = useState("reflection/beam-free");

  const avatarColors = useMemo(
    () => [
      colors.avatarPurple,
      colors.avatarBlue,
      colors.avatarGreen,
      colors.avatarOrange,
      colors.avatarTeal,
      colors.avatarRed,
    ],
    [colors],
  );

  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [visible, onClose]);

  if (!visible) return null;

  const currentProvider =
    PROVIDERS.find((p) => p.id === selectedProviderId) ?? PROVIDERS[0];
  const availableModels = PROVIDER_MODELS[selectedProviderId] ?? PROVIDER_MODELS.kilo;

  const handleProviderSelect = (providerId: string) => {
    setSelectedProviderId(providerId);
    const models = PROVIDER_MODELS[providerId] ?? [];
    if (models.length > 0 && !models.some((m) => m.id === selectedModelId)) {
      setSelectedModelId(models[0].id);
      onModelSelect?.(providerId, models[0].id);
    }
  };

  const handleModelSelect = (modelId: string) => {
    setSelectedModelId(modelId);
    onModelSelect?.(selectedProviderId, modelId);
  };

  const handleToolTap = (prompt: string) => {
    onClose();
    onActionSelect?.(prompt);
  };

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.handle} />

        {/* Menu Header with Mascot */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Mascot size={36} state="happy" interactive={true} />
            <View>
              <Text style={styles.title}>{username ? `Ciao, ${username}` : "Menu Mots"}</Text>
              <Text style={styles.code}>ID: {sessionId.slice(0, 8)}…</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chiudi menu"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={onClose}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          >
            <CloseIcon size={14} color={colors.textPrimary} />
          </Pressable>
        </View>

        {/* Segmented Category Tabs */}
        <View style={styles.tabBar}>
          <Pressable
            accessibilityRole="tab"
            accessibilityLabel="Sezione Chat"
            onPress={() => setTab("chat")}
            style={[styles.tabButton, tab === "chat" && styles.tabButtonActive]}
          >
            <Text style={[styles.tabButtonText, tab === "chat" && styles.tabButtonTextActive]}>
              💬 Chat
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityLabel="Sezione Routine"
            onPress={() => setTab("routines")}
            style={[styles.tabButton, tab === "routines" && styles.tabButtonActive]}
          >
            <Text style={[styles.tabButtonText, tab === "routines" && styles.tabButtonTextActive]}>
              ⏰ Routine
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityLabel="Sezione Modelli"
            onPress={() => setTab("models")}
            style={[styles.tabButton, tab === "models" && styles.tabButtonActive]}
          >
            <Text style={[styles.tabButtonText, tab === "models" && styles.tabButtonTextActive]}>
              ⚙️ Modelli
            </Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {/* TAB 1: CONVERSATIONS */}
          {tab === "chat" && (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Nuova chat"
                onPress={() => {
                  onCreate();
                  onClose();
                }}
                style={({ pressed }) => [styles.primaryNewChat, pressed && styles.pressed]}
              >
                <PlusIcon size={16} color={colors.accentInk} />
                <Text style={styles.primaryNewChatText}>Inizia nuova chat</Text>
              </Pressable>

              <Text style={styles.sectionLabel}>LE TUE CHAT ({conversations.length})</Text>
              {conversations.map((conversation, index) => {
                const active = conversation.id === activeConversationId;
                const avatarColor = avatarColors[index % avatarColors.length];
                const badge = conversation.id === ROOT_CONVERSATION_ID ? "✦" : String(index);

                return (
                  <Pressable
                    key={conversation.id}
                    accessibilityRole="button"
                    accessibilityLabel={conversationName(conversation, index)}
                    onPress={() => {
                      onSelect(conversation.id);
                      onClose();
                    }}
                    style={({ pressed }) => [
                      styles.item,
                      active && styles.itemActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <BotAvatarIcon size={34} backgroundColor={avatarColor} badge={badge} />
                    <View style={styles.itemInfo}>
                      <Text style={[styles.itemText, active && styles.itemTextActive]}>
                        {conversationName(conversation, index)}
                      </Text>
                      <Text style={styles.itemSubtitle}>
                        {active ? "Attiva adesso" : "Tocca per aprire"}
                      </Text>
                    </View>

                    {active ? (
                      <View style={styles.activeDot} />
                    ) : (
                      <ChevronRightIcon size={14} color={colors.textSecondary} />
                    )}
                  </Pressable>
                );
              })}
            </>
          )}

          {/* TAB 2: AUTONOMOUS ROUTINES */}
          {tab === "routines" && (
            <>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionLabel}>ROUTINE AUTONOME (MODELLI SUGGERITI)</Text>
                  <Text style={styles.sectionHint}>Tocca una routine per attivarla con l'agente</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Nuova routine"
                  hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
                  onPress={() => handleToolTap("Pianifica una nuova routine autonoma: ")}
                  style={styles.addRoutineButton}
                >
                  <Text style={styles.addRoutineButtonText}>+ Nuova</Text>
                </Pressable>
              </View>

              <View style={styles.routinesList}>
                {SAMPLE_ROUTINES.map((routine) => (
                  <Pressable
                    key={routine.name}
                    accessibilityRole="button"
                    accessibilityLabel={`${routine.name} · ${routine.schedule}`}
                    onPress={() => handleToolTap(routine.prompt)}
                    style={({ pressed }) => [
                      styles.routineRowCard,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.routineIconWrap}>
                      {routine.status === "active" ? (
                        <ClockIcon size={15} color={colors.accentCoral} />
                      ) : (
                        <PauseIcon size={13} color={colors.textSecondary} />
                      )}
                    </View>
                    <View style={styles.routineDetails}>
                      <Text style={styles.routineTitleText}>{routine.name}</Text>
                      <Text style={styles.routineScheduleText}>{routine.schedule}</Text>
                    </View>
                    <View
                      style={[
                        styles.routineStatusBadge,
                        routine.status === "active"
                          ? styles.routineStatusActive
                          : styles.routineStatusPaused,
                      ]}
                    >
                      {routine.status === "active" ? (
                        <View style={styles.routineActiveDot} />
                      ) : null}
                      <Text
                        style={[
                          styles.routineStatusLabel,
                          routine.status === "active"
                            ? styles.routineStatusLabelActive
                            : styles.routineStatusLabelPaused,
                        ]}
                      >
                        {routine.statusLabel}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.sectionLabel}>STRUMENTI RAPIDI AGENTE</Text>
              <View style={styles.toolsGrid}>
                {AGENT_TOOLS.map((tool) => (
                  <Pressable
                    key={tool.name}
                    accessibilityRole="button"
                    accessibilityLabel={tool.name}
                    onPress={() => handleToolTap(tool.prompt)}
                    style={({ pressed }) => [
                      styles.toolItem,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={[styles.toolIconWrap, { backgroundColor: colors[tool.colorKey] }]}>
                      {tool.icon(colors.textPrimary)}
                    </View>
                    <View style={styles.toolItemInfo}>
                      <Text style={styles.toolItemName}>{tool.name}</Text>
                      <Text style={styles.toolItemDesc}>{tool.desc}</Text>
                    </View>
                    <ChevronRightIcon size={12} color={colors.textSecondary} />
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {/* TAB 3: PROVIDERS & MODELS */}
          {tab === "models" && (
            <>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>PROVIDER & MODELLO AI</Text>
                <View style={styles.activeProviderChip}>
                  <View style={styles.providerDot} />
                  <Text style={styles.activeProviderChipText}>{currentProvider.badge}</Text>
                </View>
              </View>

              <View style={styles.providerCard}>
                <View style={styles.providerTopRow}>
                  <View style={styles.providerInfoLeft}>
                    <Text style={styles.providerName}>{currentProvider.name}</Text>
                    <Text style={styles.providerEndpoint}>{currentProvider.endpoint}</Text>
                  </View>
                  <View style={styles.modelPill}>
                    <Text style={styles.modelPillText}>{selectedModelId.split("/")[1] ?? selectedModelId}</Text>
                  </View>
                </View>
                <Text style={styles.providerDetails}>{currentProvider.details}</Text>

                {/* Provider Switcher Chips */}
                <View style={styles.providerChipsRow}>
                  {PROVIDERS.map((p) => {
                    const isSelected = p.id === selectedProviderId;
                    return (
                      <Pressable
                        key={p.id}
                        accessibilityRole="button"
                        accessibilityLabel={p.name}
                        onPress={() => handleProviderSelect(p.id)}
                        style={[
                          styles.providerSelectorChip,
                          isSelected && styles.providerSelectorChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.providerSelectorChipText,
                            isSelected && styles.providerSelectorChipTextActive,
                          ]}
                        >
                          {p.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Model Selection List for Active Provider */}
                <View style={styles.modelSectionGroup}>
                  <Text style={styles.modelListHeader}>MODELLI DISPONIBILI ({availableModels.length})</Text>
                  <View style={styles.modelsGrid}>
                    {availableModels.map((m) => {
                      const isSelected = m.id === selectedModelId;
                      return (
                        <Pressable
                          key={m.id}
                          accessibilityRole="button"
                          accessibilityLabel={`${m.name} · ${m.id}`}
                          onPress={() => handleModelSelect(m.id)}
                          style={[
                            styles.modelCard,
                            isSelected && styles.modelCardActive,
                          ]}
                        >
                          <View style={styles.modelCardLeft}>
                            <View style={styles.modelCardTitleRow}>
                              <Text style={[styles.modelCardName, isSelected && styles.modelCardNameActive]}>
                                {m.name}
                              </Text>
                              {isSelected ? (
                                <View style={styles.selectedCheckWrap}>
                                  <CheckIcon size={12} color={colors.accentGreen} />
                                </View>
                              ) : null}
                            </View>
                            <Text style={styles.modelCardId}>{m.id}</Text>
                          </View>
                          <View style={[styles.modelTagBadge, m.free ? styles.modelTagFree : styles.modelTagStandard]}>
                            <Text style={[styles.modelTagText, m.free ? styles.modelTagFreeText : styles.modelTagStandardText]}>
                              {m.tag}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>
            </>
          )}
        </ScrollView>

        {/* Elegant Theme Preference Selector (☀️ Chiaro / 🌙 Scuro / ⚙️ Sistema) */}
        <View style={styles.themeSection}>
          <Text style={styles.themeSectionLabel}>TEMA APPLICAZIONE</Text>
          <View style={styles.themeChipsRow}>
            {(
              [
                { id: "light", label: "☀️ Chiaro" },
                { id: "dark", label: "🌙 Scuro" },
                { id: "system", label: "⚙️ Sistema" },
              ] as const
            ).map((item) => {
              const active = mode === item.id;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Tema ${item.label}`}
                  onPress={() => setMode(item.id)}
                  style={({ pressed }) => [
                    styles.themeChip,
                    active && styles.themeChipActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.themeChipText,
                      active && styles.themeChipTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.secondaryRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Condividi codice sessione"
            onPress={onShare}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryText}>Condividi codice</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Esci dalla sessione"
            onPress={onLeave}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <Text style={[styles.secondaryText, styles.leaveText]}>Esci</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    container: {
      ...StyleSheet.absoluteFill,
      zIndex: 1000,
    },
    backdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: colors.overlay,
    },
    sheet: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      maxHeight: "92%",
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      backgroundColor: colors.bgMain,
      paddingTop: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderWidth: 1,
      borderColor: colors.cardBorderSubtle,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: isDark ? 0.4 : 0.15,
      shadowRadius: 16,
      elevation: 10,
    },
    handle: {
      alignSelf: "center",
      width: 38,
      height: 4,
      borderRadius: radius.pill,
      backgroundColor: colors.borderMedium,
      marginBottom: spacing.md,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.md,
    },
    headerTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    title: {
      fontFamily: fonts.bold,
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: "700",
      letterSpacing: -0.4,
    },
    code: {
      fontFamily: fonts.medium,
      color: colors.textSecondary,
      fontSize: 11,
      marginTop: 1,
      fontWeight: "500",
    },
    close: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.cardSurfacePrimary,
      borderWidth: 1,
      borderColor: colors.cardBorderSubtle,
    },
    tabBar: {
      flexDirection: "row",
      backgroundColor: isDark ? "#14151B" : colors.bgMain,
      borderRadius: radius.pill,
      padding: 3,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.cardBorderSubtle,
    },
    tabButton: {
      flex: 1,
      paddingVertical: 7,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.pill,
    },
    tabButtonActive: {
      backgroundColor: colors.cardSurfacePrimary,
      borderWidth: 1,
      borderColor: colors.cardBorderSubtle,
    },
    tabButtonText: {
      fontFamily: fonts.medium,
      fontSize: 12,
      color: colors.textSecondary,
    },
    tabButtonTextActive: {
      fontFamily: fonts.bold,
      color: colors.textPrimary,
      fontWeight: "700",
    },
    primaryNewChat: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
      backgroundColor: colors.accentCoral,
      borderRadius: radius.pill,
      height: 42,
      marginBottom: spacing.md,
    },
    primaryNewChatText: {
      fontFamily: fonts.bold,
      fontSize: 13,
      color: colors.accentInk,
      fontWeight: "700",
    },
    list: {
      flexShrink: 1,
    },
    listContent: {
      gap: spacing.xs,
      paddingBottom: spacing.sm,
    },
    sectionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
    },
    sectionLabel: {
      fontFamily: fonts.bold,
      color: colors.textSecondary,
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 1.1,
    },
    sectionHint: {
      fontFamily: fonts.regular,
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
    },
    activeProviderChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.badgeMintBg,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: radius.pill,
    },
    providerDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: colors.accentGreen,
    },
    activeProviderChipText: {
      fontFamily: fonts.semiBold,
      fontSize: 10,
      color: colors.badgeMintText,
      fontWeight: "600",
    },
    providerCard: {
      borderRadius: radius.md,
      backgroundColor: colors.cardSurfacePrimary,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.cardBorderSubtle,
      marginBottom: spacing.xs,
    },
    providerTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    providerInfoLeft: {
      flex: 1,
    },
    providerName: {
      fontFamily: fonts.bold,
      fontSize: 14,
      color: colors.textPrimary,
      fontWeight: "700",
    },
    providerEndpoint: {
      fontFamily: fonts.regular,
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 1,
    },
    modelPill: {
      backgroundColor: colors.cardSurfaceAmber,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.reasoningBorder,
    },
    modelPillText: {
      fontFamily: fonts.medium,
      fontSize: 10,
      color: colors.badgeAmberText,
      fontWeight: "600",
    },
    providerDetails: {
      fontFamily: fonts.regular,
      fontSize: 11,
      color: colors.textSecondary,
      marginBottom: spacing.sm,
    },
    providerChipsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginBottom: spacing.sm,
    },
    providerSelectorChip: {
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: radius.pill,
      backgroundColor: colors.bgMain,
      borderWidth: 1,
      borderColor: colors.cardBorderSubtle,
    },
    providerSelectorChipActive: {
      backgroundColor: isDark ? "#2A2B35" : colors.textPrimary,
      borderColor: isDark ? "rgba(255, 255, 255, 0.16)" : colors.textPrimary,
    },
    providerSelectorChipText: {
      fontFamily: fonts.medium,
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: "500",
    },
    providerSelectorChipTextActive: {
      color: "#FFFFFF",
      fontWeight: "600",
    },
    modelSectionGroup: {
      marginTop: spacing.xs,
      paddingTop: spacing.xs,
      borderTopWidth: 1,
      borderTopColor: colors.cardBorderSubtle,
    },
    modelListHeader: {
      fontFamily: fonts.bold,
      fontSize: 9,
      color: colors.textSecondary,
      fontWeight: "700",
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    modelsGrid: {
      gap: 6,
    },
    modelCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: radius.sm,
      backgroundColor: colors.bgMain,
      borderWidth: 1,
      borderColor: "transparent",
    },
    modelCardActive: {
      backgroundColor: colors.badgeAmberBg,
      borderColor: colors.reasoningBorder,
    },
    modelCardLeft: {
      flex: 1,
    },
    modelCardTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    modelCardName: {
      fontFamily: fonts.bold,
      fontSize: 12,
      color: colors.textPrimary,
      fontWeight: "700",
    },
    modelCardNameActive: {
      color: colors.badgeAmberText,
    },
    selectedCheckWrap: {
      width: 14,
      height: 14,
      borderRadius: 7,
      alignItems: "center",
      justifyContent: "center",
    },
    modelCardId: {
      fontFamily: fonts.regular,
      fontSize: 10,
      color: colors.textSecondary,
      marginTop: 1,
    },
    modelTagBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.pill,
    },
    modelTagFree: {
      backgroundColor: colors.badgeMintBg,
    },
    modelTagStandard: {
      backgroundColor: colors.cardSurfacePrimary,
    },
    modelTagText: {
      fontFamily: fonts.medium,
      fontSize: 9,
      fontWeight: "600",
    },
    modelTagFreeText: {
      color: colors.badgeMintText,
    },
    modelTagStandardText: {
      color: colors.textSecondary,
    },
    addRoutineButton: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radius.pill,
      backgroundColor: colors.cardSurfaceAmber,
      borderWidth: 1,
      borderColor: colors.reasoningBorder,
    },
    addRoutineButtonText: {
      fontFamily: fonts.semiBold,
      fontSize: 10,
      color: colors.badgeAmberText,
      fontWeight: "600",
    },
    routinesList: {
      gap: spacing.xs,
      marginBottom: spacing.xs,
    },
    routineRowCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      borderRadius: radius.md,
      backgroundColor: colors.cardSurfacePrimary,
      borderWidth: 1,
      borderColor: colors.cardBorderSubtle,
    },
    routineIconWrap: {
      width: 28,
      height: 28,
      borderRadius: radius.pill,
      backgroundColor: colors.bgMain,
      alignItems: "center",
      justifyContent: "center",
    },
    routineDetails: {
      flex: 1,
    },
    routineTitleText: {
      fontFamily: fonts.bold,
      fontSize: 13,
      color: colors.textPrimary,
      fontWeight: "700",
    },
    routineScheduleText: {
      fontFamily: fonts.regular,
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 1,
    },
    routineStatusBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: radius.pill,
    },
    routineStatusActive: {
      backgroundColor: colors.badgeMintBg,
    },
    routineStatusPaused: {
      backgroundColor: colors.bgMain,
    },
    routineActiveDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: colors.accentGreen,
    },
    routineStatusLabel: {
      fontFamily: fonts.medium,
      fontSize: 10,
      fontWeight: "600",
    },
    routineStatusLabelActive: {
      color: colors.badgeMintText,
    },
    routineStatusLabelPaused: {
      color: colors.textSecondary,
    },
    toolsGrid: {
      gap: spacing.xs,
      marginBottom: spacing.xs,
    },
    toolItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      borderRadius: radius.md,
      backgroundColor: colors.cardSurfacePrimary,
      borderWidth: 1,
      borderColor: colors.cardBorderSubtle,
    },
    toolIconWrap: {
      width: 30,
      height: 30,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    toolItemInfo: {
      flex: 1,
    },
    toolItemName: {
      fontFamily: fonts.bold,
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: "700",
    },
    toolItemDesc: {
      fontFamily: fonts.regular,
      color: colors.textSecondary,
      fontSize: 11,
      marginTop: 1,
    },
    item: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      borderRadius: radius.md,
      backgroundColor: colors.cardSurfacePrimary,
      borderWidth: 1,
      borderColor: colors.cardBorderSubtle,
    },
    itemActive: {
      backgroundColor: colors.cardSurfaceAmber,
      borderColor: colors.reasoningBorder,
    },
    itemInfo: {
      flex: 1,
    },
    itemText: {
      fontFamily: fonts.semiBold,
      color: colors.textSecondary,
      fontSize: 15,
      fontWeight: "600",
    },
    itemTextActive: {
      fontFamily: fonts.bold,
      color: colors.textPrimary,
      fontWeight: "700",
    },
    itemSubtitle: {
      fontFamily: fonts.regular,
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 1,
    },
    activeDot: {
      width: 8,
      height: 8,
      borderRadius: radius.pill,
      backgroundColor: colors.accentGreen,
    },
    themeSection: {
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.cardBorderSubtle,
    },
    themeSectionLabel: {
      fontFamily: fonts.bold,
      color: colors.textSecondary,
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 1.1,
      marginBottom: 8,
    },
    themeChipsRow: {
      flexDirection: "row",
      gap: 8,
    },
    themeChip: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 8,
      paddingHorizontal: 4,
      borderRadius: radius.pill,
      backgroundColor: colors.cardSurfacePrimary,
      borderWidth: 1,
      borderColor: colors.cardBorderSubtle,
    },
    themeChipActive: {
      backgroundColor: isDark ? "#2A2B35" : colors.textPrimary,
      borderColor: isDark ? "rgba(255, 255, 255, 0.16)" : colors.textPrimary,
    },
    themeChipText: {
      fontFamily: fonts.semiBold,
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    themeChipTextActive: {
      color: "#FFFFFF",
      fontWeight: "700",
    },
    secondaryRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    secondary: {
      flex: 1,
      minHeight: 44,
      borderRadius: radius.pill,
      backgroundColor: colors.cardSurfacePrimary,
      borderWidth: 1,
      borderColor: colors.cardBorderSubtle,
      alignItems: "center",
      justifyContent: "center",
    },
    secondaryText: {
      fontFamily: fonts.semiBold,
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "600",
    },
    leaveText: {
      color: colors.danger,
    },
    pressed: {
      opacity: 0.7,
    },
  });
}
