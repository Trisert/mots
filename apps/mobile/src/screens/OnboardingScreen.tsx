import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createSession, parseJoinTarget } from "../api";
import { DEFAULT_API_URL, normalizeBaseUrl } from "../config";
import type { Identity } from "../storage";
import { colors, radius, spacing } from "../theme";
import { SparkleView } from "../components/SparkleView";

type Props = {
  readonly onReady: (identity: Identity) => void | Promise<void>;
};

type Busy = "create" | "join" | undefined;

const WALL_WORDS = ["Memoria", "Promemoria", "Ricordi", "Conversazioni", "Idee", "Compagno", "Focus"];

export function OnboardingScreen({ onReady }: Props) {
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [showServer, setShowServer] = useState(false);
  const [busy, setBusy] = useState<Busy>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const name = username.trim().length > 0 ? username.trim() : "Tu";

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
          : "Non riesco a creare lo spazio. Controlla il server.",
      );
    } finally {
      setBusy(undefined);
    }
  };

  const join = async () => {
    const target = parseJoinTarget(joinCode);
    if (target === undefined) {
      setError("Codice non valido. Incolla il codice o il link ricevuto.");
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
      await onReady({ sessionId: target.sessionId, username: name, apiUrl: baseUrl });
    } catch {
      setError("Non riesco a salvare la sessione su questo dispositivo.");
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior="padding">
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.wallContainer}>
          {WALL_WORDS.map((word) => (
            <Text key={word} style={styles.wallWord}>
              {word}
            </Text>
          ))}
          <View style={styles.sparkleContainer}>
            <SparkleView size={120} color={colors.starHighlight} backgroundColor={colors.accentCoral} />
            <Text style={styles.wallWordMots}>Mots.</Text>
          </View>
        </View>

        <ScrollView
          style={styles.formScroll}
          contentContainerStyle={[
            styles.formContent,
            { paddingBottom: insets.bottom + spacing.xl },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="Il tuo nome"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            maxLength={40}
            autoCapitalize="words"
            autoCorrect={false}
            selectionColor={colors.textPrimary}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Crea il tuo spazio"
            disabled={busy !== undefined}
            onPress={() => void create()}
            style={({ pressed }) => [
              styles.primaryCta,
              busy !== undefined && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            {busy === "create" ? (
              <ActivityIndicator size="small" color={colors.accentInk} />
            ) : (
              <Text style={styles.primaryCtaText}>Crea il tuo spazio</Text>
            )}
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerRule} />
            <Text style={styles.dividerText}>oppure</Text>
            <View style={styles.dividerRule} />
          </View>

          <TextInput
            value={joinCode}
            onChangeText={setJoinCode}
            placeholder="Codice o link della sessione"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            maxLength={512}
            autoCapitalize="none"
            autoCorrect={false}
            selectionColor={colors.textPrimary}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Entra"
            disabled={busy !== undefined}
            onPress={() => void join()}
            style={({ pressed }) => [
              styles.outlineCta,
              busy !== undefined && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            {busy === "join" ? (
              <ActivityIndicator size="small" color={colors.textPrimary} />
            ) : (
              <>
                <Text style={styles.outlineCtaText}>Entra</Text>
                <View style={styles.arrowContainer}>
                  <View style={styles.arrowLine} />
                  <View style={styles.arrowHead} />
                </View>
              </>
            )}
          </Pressable>

          {error !== undefined ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable onPress={() => setShowServer((current) => !current)}>
            <Text style={styles.serverSummary}>
              Server · {apiUrl || "non impostato"}{" "}
              <Text style={styles.serverAction}>
                {showServer ? "chiudi" : "modifica"}
              </Text>
            </Text>
          </Pressable>

          {showServer ? (
            <TextInput
              value={apiUrl}
              onChangeText={setApiUrl}
              placeholder="http://192.168.1.10:8787"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, styles.serverInput]}
              maxLength={300}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              selectionColor={colors.textPrimary}
            />
          ) : null}

          <Text style={styles.footnote}>
            Prototipo self-hosted. Le conversazioni restano sul tuo server Mots.
          </Text>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.accentCoral,
  },
  container: {
    flex: 1,
    backgroundColor: colors.accentCoral,
  },
  wallContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    overflow: "hidden",
  },
  wallWord: {
    fontSize: 44,
    lineHeight: 46,
    fontWeight: "600",
    color: "rgba(28, 28, 30, 0.25)",
  },
  sparkleContainer: {
    position: "relative",
    alignItems: "flex-start",
    marginTop: spacing.md,
  },
  wallWordMots: {
    fontSize: 44,
    lineHeight: 46,
    fontWeight: "600",
    color: colors.textPrimary,
    position: "absolute",
    bottom: 0,
    left: 0,
  },
  formScroll: {
    maxHeight: "45%",
  },
  formContent: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  input: {
    backgroundColor: colors.cardSurfacePrimary,
    borderRadius: radius.pill,
    height: 60,
    paddingHorizontal: 24,
    color: colors.textPrimary,
    fontSize: 16,
  },
  primaryCta: {
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.cardSurfaceAmber,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  primaryCtaText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginVertical: spacing.sm,
  },
  dividerRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(28, 28, 30, 0.2)",
  },
  dividerText: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  outlineCta: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: "transparent",
    paddingHorizontal: spacing.xl,
  },
  outlineCtaText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  arrowContainer: {
    position: "absolute",
    right: spacing.lg,
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowLine: {
    position: "absolute",
    width: 10,
    height: 2,
    backgroundColor: colors.textPrimary,
    borderRadius: 1,
  },
  arrowHead: {
    position: "absolute",
    right: 0,
    width: 6,
    height: 6,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: colors.textPrimary,
    transform: [{ rotate: "45deg" }],
  },
  error: {
    marginTop: spacing.md,
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 19,
  },
  serverSummary: {
    marginTop: spacing.md,
    color: colors.textSecondary,
    fontSize: 12,
  },
  serverAction: {
    color: colors.textPrimary,
    fontWeight: "600",
  },
  serverInput: {
    marginTop: spacing.sm,
    fontSize: 14,
  },
  footnote: {
    marginTop: spacing.md,
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.75,
  },
});
