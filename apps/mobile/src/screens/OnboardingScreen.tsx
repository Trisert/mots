import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createSession, parseJoinTarget } from "../api";
import { DEFAULT_API_URL, normalizeBaseUrl } from "../config";
import { useTheme } from "../context/ThemeContext";
import type { Identity } from "../storage";
import { fonts, radius, spacing, type ThemeColors } from "../theme";
import { Mascot } from "../components/Mascot";
import { CloseIcon } from "../components/Icon";

type Props = {
  readonly onReady: (identity: Identity) => void | Promise<void>;
};

type Busy = "create" | "join" | undefined;

export function OnboardingScreen({ onReady }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 840;

  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [username, setUsername] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [busy, setBusy] = useState<Busy>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);

  const name = username.trim().length > 0 ? username.trim() : "Utente";

  const create = async () => {
    const baseUrl = normalizeBaseUrl(apiUrl);
    if (baseUrl.length === 0) {
      setError("Inserisci l'indirizzo del server.");
      return;
    }
    setBusy("create");
    setError(undefined);
    try {
      const sessionId = await createSession(baseUrl);
      await onReady({ sessionId, username: name, apiUrl: baseUrl });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Non riesco a creare lo spazio. Controlla che il server sia attivo.",
      );
    } finally {
      setBusy(undefined);
    }
  };

  const join = async () => {
    const target = parseJoinTarget(joinCode);
    if (target === undefined) {
      setError("Codice non valido. Incolla il codice o il link della sessione.");
      return;
    }
    const baseUrl = normalizeBaseUrl(target.baseUrl ?? apiUrl);
    if (baseUrl.length === 0) {
      setError("Inserisci l'indirizzo del server.");
      return;
    }
    setBusy("join");
    setError(undefined);
    try {
      setModalOpen(false);
      await onReady({ sessionId: target.sessionId, username: name, apiUrl: baseUrl });
    } catch {
      setError("Non riesco a salvare la sessione su questo dispositivo.");
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingTop: insets.top + spacing.xl,
          paddingBottom: insets.bottom + spacing.xl,
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.container, isDesktop && styles.desktopGrid]}>
        {/* Left / Hero Column */}
        <View style={[styles.heroPanel, isDesktop && styles.heroPanelDesktop]}>
          <View style={styles.mascotContainer}>
            <Mascot size={isDesktop ? 80 : 64} state="idle" interactive={true} />
          </View>

          <Text
            accessibilityRole="header"
            aria-level={1}
            style={[styles.title, isDesktop && styles.titleDesktop]}
          >
            Mots
          </Text>

          <Text style={styles.statement}>
            Il tuo compagno autonomo per routine programmate, memoria duratura e focus quotidiano.
          </Text>

          {isDesktop && (
            <View style={styles.featureList}>
              <View style={styles.featureItem}>
                <View style={[styles.featureDot, { backgroundColor: colors.accentCoral }]} />
                <Text style={styles.featureText}>Routine cron asincrone ad esecuzione autonoma</Text>
              </View>
              <View style={styles.featureItem}>
                <View style={[styles.featureDot, { backgroundColor: colors.accentGreen }]} />
                <Text style={styles.featureText}>Supporto multi-provider: Kilo, OpenRouter, NVIDIA</Text>
              </View>
              <View style={styles.featureItem}>
                <View style={[styles.featureDot, { backgroundColor: colors.avatarPurple }]} />
                <Text style={styles.featureText}>Memoria permanente sincronizzata su Cloudflare Edge</Text>
              </View>
            </View>
          )}
        </View>

        {/* Right / Access Action Card */}
        <View style={[styles.card, isDesktop && styles.cardDesktop]}>
          <Text style={styles.cardHeaderTitle}>Inizia una sessione</Text>
          <Text style={styles.cardHeaderSubtitle}>
            Inserisci il tuo nome per iniziare subito o riprendere un agente.
          </Text>

          {/* Username Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Il tuo nome</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="Nicola"
              placeholderTextColor={colors.textSecondary}
              style={styles.textInput}
              maxLength={40}
              autoCapitalize="words"
              autoCorrect={false}
              selectionColor={colors.accentCoral}
            />
          </View>

          {/* Primary Action Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Crea il tuo spazio"
            disabled={busy !== undefined}
            onPress={() => void create()}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
            ]}
          >
            {busy === "create" ? (
              <ActivityIndicator size="small" color={colors.accentInk} />
            ) : (
              <Text style={styles.primaryButtonText}>Crea il tuo spazio</Text>
            )}
          </Pressable>

          {/* Secondary Action */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Entra in una sessione esistente"
            onPress={() => setModalOpen(true)}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>Entra con codice sessione</Text>
          </Pressable>

          {error !== undefined ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.serverRow}>
            <View style={styles.serverDot} />
            <Text style={styles.serverText}>Server: {apiUrl}</Text>
          </View>
        </View>
      </View>

      {/* Footer reassurance bar to close the canvas */}
      <View style={styles.footerRow}>
        <Text style={styles.footerText}>
          Mots · Protocollo autonomo con esecuzione edge e routine persistenti
        </Text>
      </View>

      {/* Join Session Modal */}
      {modalOpen ? (
        <Modal
          visible={modalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setModalOpen(false)}
        >
          <KeyboardAvoidingView style={styles.modalBackdrop} behavior="padding">
            <Pressable style={styles.modalOverlay} onPress={() => setModalOpen(false)} />
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Entra nella sessione</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Chiudi"
                  onPress={() => setModalOpen(false)}
                  style={styles.modalCloseButton}
                >
                  <CloseIcon size={14} color={colors.textPrimary} />
                </Pressable>
              </View>

              <View style={styles.modalBody}>
                <Text style={styles.modalSubtitle}>
                  Incolla il codice o il link della sessione condivisa:
                </Text>
                <TextInput
                  value={joinCode}
                  onChangeText={setJoinCode}
                  placeholder="es. 100d5bc8-fbcd-..."
                  placeholderTextColor={colors.textSecondary}
                  style={styles.textInput}
                  autoFocus
                  maxLength={512}
                  autoCapitalize="none"
                  autoCorrect={false}
                  selectionColor={colors.accentCoral}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Entra"
                  disabled={busy === "join"}
                  onPress={() => void join()}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { marginTop: spacing.md },
                    pressed && styles.pressed,
                  ]}
                >
                  {busy === "join" ? (
                    <ActivityIndicator size="small" color={colors.accentInk} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Entra nella sessione</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      ) : null}
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.bgMain,
    },
    scrollContent: {
      flexGrow: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.lg,
    },
    container: {
      width: "100%",
      maxWidth: 440,
      alignItems: "center",
    },
    desktopGrid: {
      maxWidth: 880,
      flexDirection: "row",
      alignItems: "stretch",
      gap: spacing.xl,
    },
    heroPanel: {
      width: "100%",
      backgroundColor: colors.cardSurfacePrimary,
      borderRadius: radius.card,
      padding: spacing.xl,
      borderWidth: 1,
      borderColor: colors.cardBorderSubtle,
      alignItems: "center",
      marginBottom: spacing.md,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.3 : 0.04,
      shadowRadius: 8,
      elevation: 2,
    },
    heroPanelDesktop: {
      flex: 1,
      marginBottom: 0,
      alignItems: "flex-start",
      justifyContent: "space-between",
    },
    card: {
      width: "100%",
      backgroundColor: colors.cardSurfacePrimary,
      borderRadius: radius.card,
      padding: spacing.xl,
      borderWidth: 1,
      borderColor: colors.cardBorderSubtle,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.3 : 0.04,
      shadowRadius: 8,
      elevation: 2,
    },
    cardDesktop: {
      width: 380,
      justifyContent: "center",
    },
    cardHeaderTitle: {
      fontFamily: fonts.semiBold,
      fontSize: 16,
      color: colors.textPrimary,
      fontWeight: "600",
      marginBottom: 4,
    },
    cardHeaderSubtitle: {
      fontFamily: fonts.regular,
      fontSize: 13,
      lineHeight: 18,
      color: colors.textSecondary,
      marginBottom: spacing.lg,
    },
    mascotContainer: {
      marginBottom: spacing.md,
    },
    title: {
      fontFamily: fonts.bold,
      fontSize: 24,
      lineHeight: 30,
      color: colors.textPrimary,
      fontWeight: "700",
      letterSpacing: -0.5,
      textAlign: "center",
      marginBottom: spacing.xs,
    },
    titleDesktop: {
      fontSize: 28,
      lineHeight: 34,
      textAlign: "left",
    },
    statement: {
      fontFamily: fonts.regular,
      fontSize: 14,
      lineHeight: 20,
      color: colors.textSecondary,
      textAlign: "center",
      marginBottom: spacing.lg,
      maxWidth: 340,
    },
    featureList: {
      width: "100%",
      gap: spacing.sm,
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.borderSubtle,
    },
    featureItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    featureDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    featureText: {
      fontFamily: fonts.regular,
      fontSize: 13,
      color: colors.textSecondary,
    },
    inputGroup: {
      width: "100%",
      marginBottom: spacing.md,
    },
    inputLabel: {
      fontFamily: fonts.semiBold,
      fontSize: 12,
      color: colors.textPrimary,
      fontWeight: "600",
      marginBottom: 6,
    },
    textInput: {
      width: "100%",
      height: 44,
      backgroundColor: isDark ? "#121318" : colors.bgMain,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      fontFamily: fonts.medium,
      fontSize: 14,
      color: colors.textPrimary,
      borderWidth: 1,
      borderColor: colors.cardBorderSubtle,
    },
    primaryButton: {
      width: "100%",
      height: 44,
      backgroundColor: colors.accentCoral,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.sm,
    },
    primaryButtonText: {
      fontFamily: fonts.bold,
      fontSize: 14,
      color: colors.accentInk,
      fontWeight: "700",
    },
    secondaryButton: {
      width: "100%",
      height: 40,
      backgroundColor: "transparent",
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    secondaryButtonText: {
      fontFamily: fonts.medium,
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: "500",
    },
    errorBox: {
      width: "100%",
      backgroundColor: colors.cardSurfacePink,
      padding: spacing.sm,
      borderRadius: radius.sm,
      marginTop: spacing.sm,
    },
    errorText: {
      fontFamily: fonts.regular,
      fontSize: 12,
      color: colors.danger,
      textAlign: "center",
    },
    serverRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: spacing.md,
    },
    serverDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.accentGreen,
    },
    serverText: {
      fontFamily: fonts.regular,
      fontSize: 11,
      color: colors.textSecondary,
    },
    pressed: {
      opacity: 0.85,
    },
    modalBackdrop: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.overlay,
      padding: spacing.lg,
    },
    modalOverlay: {
      ...StyleSheet.absoluteFill,
    },
    modalSheet: {
      width: "100%",
      maxWidth: 420,
      backgroundColor: colors.cardSurfacePrimary,
      borderRadius: radius.xl,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.cardBorderSubtle,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.4 : 0.1,
      shadowRadius: 16,
      elevation: 6,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.md,
    },
    modalTitle: {
      fontFamily: fonts.bold,
      fontSize: 16,
      color: colors.textPrimary,
      fontWeight: "700",
    },
    modalCloseButton: {
      padding: spacing.xs,
    },
    modalBody: {
      gap: spacing.sm,
    },
    footerRow: {
      marginTop: spacing.xl,
      paddingTop: spacing.md,
      alignItems: "center",
    },
    footerText: {
      fontFamily: fonts.regular,
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: "center",
    },
    modalSubtitle: {
      fontFamily: fonts.regular,
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
      marginBottom: spacing.xs,
    },
  });
}
