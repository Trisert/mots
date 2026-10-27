import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createSession, parseJoinTarget } from "../api";
import { DEFAULT_API_URL, normalizeBaseUrl } from "../config";
import { ChevronDownIcon, ChevronUpIcon, CloseIcon } from "../components/Icon";
import { useTheme } from "../context/ThemeContext";
import { useI18n } from "../i18n";
import type { Identity } from "../storage";
import { hit, radius, spacing, type as typeScale, type ThemeColors } from "../theme";
import { Banner } from "../ui/Banner";
import { Mascot } from "../components/Mascot";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { LanguageSwitcher } from "../ui/LanguageSwitcher";
import { ThemeSwitcher } from "../ui/ThemeSwitcher";

type Props = {
  readonly onReady: (identity: Identity) => void | Promise<void>;
  readonly initialJoin?: boolean;
};

type Busy = "create" | "join" | undefined;

export function OnboardingScreen({ onReady, initialJoin = false }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [username, setUsername] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [busy, setBusy] = useState<Busy>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(initialJoin);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    if (initialJoin) setModalOpen(true);
  }, [initialJoin]);

  const name = username.trim().length > 0 ? username.trim() : t("common.user");

  const create = async () => {
    const baseUrl = normalizeBaseUrl(apiUrl);
    if (baseUrl.length === 0) {
      setAdvancedOpen(true);
      setError(t("menu.serverRequired"));
      return;
    }
    setBusy("create");
    setError(undefined);
    try {
      const sessionId = await createSession(baseUrl, undefined, t);
      await onReady({ sessionId, username: name, apiUrl: baseUrl });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("onboarding.createFailed"),
      );
    } finally {
      setBusy(undefined);
    }
  };

  const join = async () => {
    const target = parseJoinTarget(joinCode);
    if (target === undefined) {
      setError(t("onboarding.invalidCode"));
      return;
    }
    const baseUrl = normalizeBaseUrl(target.baseUrl ?? apiUrl);
    if (baseUrl.length === 0) {
      setError(t("menu.serverRequired"));
      return;
    }
    setBusy("join");
    setError(undefined);
    try {
      setModalOpen(false);
      await onReady({ sessionId: target.sessionId, username: name, apiUrl: baseUrl });
    } catch {
      setError(t("onboarding.saveFailed"));
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <ScrollView
      testID="onboarding-screen"
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xxl },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View role="main" style={styles.column}>
        <View style={styles.intro}>
          <View style={styles.mascotPanel}>
            <Mascot mood="felice" size={176} shadow />
          </View>
          <Text role="heading" aria-level={1} maxFontSizeMultiplier={1.6} style={styles.title}>
            {t("onboarding.title")}
          </Text>
          <Text style={styles.lead}>{t("onboarding.lead")}</Text>
        </View>

        <View style={styles.form}>
          <TextField
            label={t("onboarding.nameLabel")}
            value={username}
            onChangeText={setUsername}
            placeholder={t("onboarding.namePlaceholder")}
            autoCapitalize="words"
            maxLength={40}
            hint={t("onboarding.nameHint")}
          />
          {error !== undefined && !modalOpen ? <Banner message={error} /> : null}
          <Button
            label={t("onboarding.create")}
            accessibilityLabel={t("onboarding.create")}
            loading={busy === "create"}
            disabled={busy !== undefined}
            onPress={() => void create()}
          />
          <Button
            label={t("onboarding.haveCode")}
            variant="ghost"
            accessibilityLabel={t("onboarding.haveCodeLabel")}
            disabled={busy !== undefined}
            onPress={() => {
              setError(undefined);
              setModalOpen(true);
            }}
          />
        </View>

        <View style={styles.advanced}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("onboarding.advanced")}
            accessibilityState={{ expanded: advancedOpen }}
            onPress={() => setAdvancedOpen((open) => !open)}
            style={({ pressed }) => [styles.advancedToggle, pressed && styles.pressed]}
          >
            <Text style={styles.advancedLabel}>{t("onboarding.advanced")}</Text>
            {advancedOpen ? (
              <ChevronUpIcon size={14} color={colors.textSecondary} />
            ) : (
              <ChevronDownIcon size={14} color={colors.textSecondary} />
            )}
          </Pressable>
          {advancedOpen ? (
            <View style={styles.advancedBody}>
              <TextField
                label={t("menu.server")}
                value={apiUrl}
                onChangeText={setApiUrl}
                placeholder="http://localhost:8787"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                hint={t("onboarding.serverHint")}
              />
              <View style={styles.themeBlock}>
                <Text style={styles.themeLabel}>{t("menu.theme")}</Text>
                <ThemeSwitcher />
              </View>
              <View style={styles.themeBlock}>
                <Text style={styles.themeLabel}>{t("menu.language")}</Text>
                <LanguageSwitcher />
              </View>
            </View>
          ) : null}
        </View>
      </View>

      {modalOpen ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
          <KeyboardAvoidingView style={styles.modalBackdrop} behavior="padding">
            <Pressable
              style={styles.modalOverlay}
              onPress={() => setModalOpen(false)}
              focusable={false}
              accessible={false}
              importantForAccessibility="no-hide-descendants"
              aria-hidden={true}
            />
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text accessibilityRole="header" style={styles.modalTitle}>
                  {t("onboarding.joinTitle")}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("common.close")}
                  onPress={() => setModalOpen(false)}
                  style={styles.modalClose}
                >
                  <CloseIcon size={16} color={colors.textPrimary} />
                </Pressable>
              </View>
              <Text style={styles.modalBody}>
                {t("onboarding.joinBody")}
              </Text>
              <TextField
                label={t("onboarding.codeLabel")}
                value={joinCode}
                onChangeText={setJoinCode}
                placeholder="100d5bc8-fbcd-…"
                autoFocus
                maxLength={512}
                autoCapitalize="none"
              />
              {error !== undefined ? <Banner message={error} /> : null}
              <Button
                label={t("onboarding.joinAction")}
                accessibilityLabel={t("onboarding.joinLabel")}
                loading={busy === "join"}
                disabled={busy === "join"}
                onPress={() => void join()}
              />
            </View>
          </KeyboardAvoidingView>
        </Modal>
      ) : null}
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.bgMain,
    },
    content: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: spacing.xl,
    },
    column: {
      width: "100%",
      maxWidth: 400,
      alignSelf: "center",
      gap: spacing.xxl,
    },
    intro: {
      alignItems: "center",
      gap: spacing.md,
    },
    mascotPanel: {
      alignSelf: "stretch",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.xxl,
      marginBottom: spacing.sm,
      borderRadius: radius.xl,
      backgroundColor: colors.blushSoft,
    },
    title: {
      ...typeScale.title,
      textAlign: "center",
      color: colors.textPrimary,
    },
    lead: {
      ...typeScale.body,
      textAlign: "center",
      color: colors.textSecondary,
      maxWidth: 320,
    },
    form: {
      gap: spacing.lg,
    },
    advanced: {
      alignItems: "stretch",
      gap: spacing.lg,
    },
    advancedToggle: {
      minHeight: hit,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    advancedLabel: {
      ...typeScale.label,
      color: colors.textSecondary,
    },
    advancedBody: {
      gap: spacing.lg,
    },
    pressed: {
      opacity: 0.7,
    },
    themeBlock: {
      gap: spacing.sm,
    },
    themeLabel: {
      ...typeScale.kicker,
      color: colors.textSecondary,
    },
    modalBackdrop: {
      flex: 1,
      justifyContent: "center",
      padding: spacing.lg,
      backgroundColor: colors.overlay,
    },
    modalOverlay: {
      ...StyleSheet.absoluteFill,
    },
    modalSheet: {
      gap: spacing.lg,
      borderRadius: radius.composer,
      backgroundColor: colors.bgMain,
      padding: spacing.xl,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    modalTitle: {
      ...typeScale.heading,
      color: colors.textPrimary,
    },
    modalClose: {
      width: hit,
      height: hit,
      alignItems: "center",
      justifyContent: "center",
    },
    modalBody: {
      ...typeScale.small,
      color: colors.textSecondary,
    },
  });
}
