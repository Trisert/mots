import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createSession, parseJoinTarget } from "../api";
import { DEFAULT_API_URL, normalizeBaseUrl } from "../config";
import type { Identity } from "../storage";
import { colors, radius, spacing } from "../theme";

type Props = {
  readonly onReady: (identity: Identity) => void | Promise<void>;
};

type Busy = "create" | "join" | undefined;

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
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandRow}>
          <Text style={styles.wordmark}>mots</Text>
          <View style={styles.brandDot} />
        </View>
        <Text style={styles.tagline}>Un compagno che ricorda.</Text>
        <Text style={styles.intro}>
          Parla, programma promemoria, conserva ciò che conta. Mots resta con te
          anche quando torni.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>COME TI CHIAMI?</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="Il tuo nome"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            maxLength={40}
            autoCapitalize="words"
            autoCorrect={false}
            selectionColor={colors.accent}
            keyboardAppearance="dark"
          />

          <Pressable
            accessibilityRole="button"
            disabled={busy !== undefined}
            onPress={() => void create()}
            style={({ pressed }) => [
              styles.primary,
              busy !== undefined && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            {busy === "create" ? (
              <ActivityIndicator size="small" color={colors.accentInk} />
            ) : (
              <Text style={styles.primaryText}>Crea il tuo spazio</Text>
            )}
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerRule} />
            <Text style={styles.dividerText}>oppure</Text>
            <View style={styles.dividerRule} />
          </View>

          <Text style={styles.label}>HAI UN CODICE?</Text>
          <TextInput
            value={joinCode}
            onChangeText={setJoinCode}
            placeholder="Codice o link della sessione"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            maxLength={512}
            autoCapitalize="none"
            autoCorrect={false}
            selectionColor={colors.accent}
            keyboardAppearance="dark"
          />
          <Pressable
            accessibilityRole="button"
            disabled={busy !== undefined}
            onPress={() => void join()}
            style={({ pressed }) => [
              styles.secondary,
              busy !== undefined && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            {busy === "join" ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <Text style={styles.secondaryText}>Entra</Text>
            )}
          </Pressable>
        </View>

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
            placeholderTextColor={colors.textFaint}
            style={[styles.input, styles.serverInput]}
            maxLength={300}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            selectionColor={colors.accent}
            keyboardAppearance="dark"
          />
        ) : null}

        <Text style={styles.footnote}>
          Prototipo self-hosted. Le conversazioni restano sul tuo server Mots.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  wordmark: {
    color: colors.text,
    fontSize: 52,
    fontWeight: "700",
    letterSpacing: -2.4,
    lineHeight: 56,
  },
  brandDot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    marginBottom: 10,
  },
  tagline: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "600",
    letterSpacing: -0.6,
    marginTop: spacing.md,
  },
  intro: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
    marginTop: spacing.sm,
    maxWidth: 340,
  },
  card: {
    marginTop: spacing.xxl,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.lg,
  },
  label: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.6,
    marginBottom: spacing.sm,
  },
  input: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  primary: {
    marginTop: spacing.md,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
  },
  primaryText: {
    color: colors.accentInk,
    fontSize: 16,
    fontWeight: "700",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginVertical: spacing.lg,
  },
  dividerRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.textFaint,
    fontSize: 11,
  },
  secondary: {
    marginTop: spacing.sm,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  secondaryText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  error: {
    marginTop: spacing.md,
    color: colors.danger,
    fontSize: 13,
    lineHeight: 19,
  },
  serverSummary: {
    marginTop: spacing.xl,
    color: colors.textFaint,
    fontSize: 12,
  },
  serverAction: {
    color: colors.accent,
  },
  serverInput: {
    marginTop: spacing.sm,
    fontSize: 14,
  },
  footnote: {
    marginTop: "auto",
    paddingTop: spacing.xxl,
    color: colors.textFaint,
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
