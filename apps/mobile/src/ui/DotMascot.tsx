import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { DOT_COLS, DOT_ROWS, DOTS } from "../dots";

type Props = {
  readonly size?: number;
  /** Blink and a small wave while the assistant is writing. */
  readonly thinking?: boolean;
  /** Hide from assistive tech when the mascot sits beside a status label. */
  readonly decorative?: boolean;
};

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let active = true;
    const native = { current: false };
    const mediaOn = { current: false };
    const publish = () => {
      if (active) setReduce(native.current || mediaOn.current);
    };

    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      native.current = value;
      publish();
    }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      native.current = value;
      publish();
    });

    type MotionQuery = {
      matches: boolean;
      addEventListener: (type: "change", listener: () => void) => void;
      removeEventListener: (type: "change", listener: () => void) => void;
    };
    let media: MotionQuery | undefined;
    const onMedia = () => {
      mediaOn.current = media?.matches === true;
      publish();
    };
    const match = (globalThis as { matchMedia?: (query: string) => MotionQuery }).matchMedia;
    if (Platform.OS === "web" && typeof match === "function") {
      media = match("(prefers-reduced-motion: reduce)");
      onMedia();
      media.addEventListener("change", onMedia);
    }

    return () => {
      active = false;
      subscription.remove();
      media?.removeEventListener("change", onMedia);
    };
  }, []);

  return reduce;
}

export function DotMascot({ size = 72, thinking = false, decorative = false }: Props) {
  const { colors } = useTheme();
  const reduce = useReduceMotion();
  const animate = thinking && !reduce;
  const blink = useRef(new Animated.Value(1)).current;
  const wave = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate) {
      blink.setValue(1);
      wave.setValue(0);
      return;
    }
    const blinkLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(1600),
        Animated.timing(blink, {
          toValue: 0.15,
          duration: 90,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(blink, {
          toValue: 1,
          duration: 140,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
    );
    const waveLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(wave, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(wave, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    blinkLoop.start();
    waveLoop.start();
    return () => {
      blinkLoop.stop();
      waveLoop.stop();
    };
  }, [animate, blink, wave]);

  const gap = size / (DOT_COLS * 4);
  const dot = (size - gap * (DOT_COLS - 1)) / DOT_COLS;
  const lift = Math.max(1, dot * 0.55);

  return (
    <View
      accessibilityRole={decorative ? undefined : "image"}
      accessibilityLabel={decorative ? undefined : "Mots"}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? "no-hide-descendants" : "yes"}
      style={{ width: size, height: (dot + gap) * DOT_ROWS - gap }}
    >
      {DOTS.map((spec) => {
        const base = {
          position: "absolute" as const,
          left: spec.col * (dot + gap),
          top: spec.row * (dot + gap),
          width: dot,
          height: dot,
          borderRadius: dot / 2,
          backgroundColor: colors.textPrimary,
        };
        const key = `${spec.col}-${spec.row}`;
        if (spec.role === "eye") {
          return <Animated.View key={key} style={[base, { opacity: animate ? blink : 1 }]} />;
        }
        if (spec.role === "wave") {
          const translateY = wave.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -lift],
          });
          return (
            <Animated.View
              key={key}
              style={[base, { transform: [{ translateY: animate ? translateY : 0 }] }]}
            />
          );
        }
        return <View key={key} style={base} />;
      })}
    </View>
  );
}
