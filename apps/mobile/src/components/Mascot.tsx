import { useEffect, useId, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";
import { useTheme } from "../context/ThemeContext";

export type MascotState = "idle" | "thinking" | "speaking" | "routine" | "happy";

type Props = {
  readonly size?: number;
  readonly state?: MascotState;
  readonly interactive?: boolean;
  readonly onPress?: () => void;
};

export function Mascot({
  size = 64,
  state = "idle",
  interactive = true,
  onPress,
}: Props) {
  const { colors } = useTheme();
  // Floating / hovering vertical motion
  const floatAnim = useRef(new Animated.Value(0)).current;
  // Breathing scale pulse
  const breathAnim = useRef(new Animated.Value(1)).current;
  // Eye blink vertical compression
  const blinkAnim = useRef(new Animated.Value(1)).current;
  // Head tilt / glance
  const tiltAnim = useRef(new Animated.Value(0)).current;
  // Interactive bounce on press
  const bounceAnim = useRef(new Animated.Value(1)).current;
  // Star antenna bounce
  const starAnim = useRef(new Animated.Value(0)).current;

  const [tapped, setTapped] = useState(false);

  // Floating hover loop
  useEffect(() => {
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -5,
          duration: state === "thinking" ? 900 : 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 4,
          duration: state === "thinking" ? 900 : 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, {
          toValue: 1.04,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(breathAnim, {
          toValue: 0.98,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    const starLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(starAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(starAnim, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    floatLoop.start();
    breathLoop.start();
    starLoop.start();

    return () => {
      floatLoop.stop();
      breathLoop.stop();
      starLoop.stop();
    };
  }, [floatAnim, breathAnim, starAnim, state]);

  // Organic blinking timer
  useEffect(() => {
    let isMounted = true;
    let blinkTimeout: ReturnType<typeof setTimeout>;
    let doubleBlinkTimeout: ReturnType<typeof setTimeout>;

    const scheduleNextBlink = () => {
      if (!isMounted) return;
      const delay = Math.random() * 3200 + 2400; // 2.4s to 5.6s
      blinkTimeout = setTimeout(() => {
        if (!isMounted) return;
        // Quick blink down & up
        Animated.sequence([
          Animated.timing(blinkAnim, {
            toValue: 0.08,
            duration: 85,
            useNativeDriver: true,
          }),
          Animated.timing(blinkAnim, {
            toValue: 1,
            duration: 110,
            useNativeDriver: true,
          }),
        ]).start(() => {
          if (!isMounted) return;
          // 25% chance of a double blink!
          if (Math.random() < 0.25) {
            doubleBlinkTimeout = setTimeout(() => {
              if (!isMounted) return;
              Animated.sequence([
                Animated.timing(blinkAnim, {
                  toValue: 0.08,
                  duration: 75,
                  useNativeDriver: true,
                }),
                Animated.timing(blinkAnim, {
                  toValue: 1,
                  duration: 100,
                  useNativeDriver: true,
                }),
              ]).start();
            }, 120);
          }
          scheduleNextBlink();
        });
      }, delay);
    };

    scheduleNextBlink();
    return () => {
      isMounted = false;
      clearTimeout(blinkTimeout);
      clearTimeout(doubleBlinkTimeout);
    };
  }, [blinkAnim]);

  // Occasional slight head tilt / curious glance
  useEffect(() => {
    const tiltInterval = setInterval(() => {
      const targetTilt = (Math.random() - 0.5) * 8; // -4deg to +4deg
      Animated.timing(tiltAnim, {
        toValue: targetTilt,
        duration: 600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }, 4500);

    return () => clearInterval(tiltInterval);
  }, [tiltAnim]);

  const handlePress = () => {
    if (!interactive) return;
    setTapped(true);
    Animated.sequence([
      Animated.timing(bounceAnim, {
        toValue: 0.88,
        duration: 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(bounceAnim, {
        toValue: 1.15,
        friction: 3,
        tension: 180,
        useNativeDriver: true,
      }),
      Animated.spring(bounceAnim, {
        toValue: 1,
        friction: 5,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start(() => setTapped(false));

    onPress?.();
  };

  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const bodyGradId = `bodyGrad_${id}`;
  const visorGradId = `visorGrad_${id}`;
  const bellyGradId = `bellyGrad_${id}`;

  const scale = size / 64;
  const isThinking = state === "thinking";
  const isHappy = state === "happy" || tapped;
  const isRoutine = state === "routine";

  const starTranslateY = starAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -3 * scale],
  });

  const starRotate = starAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "15deg"],
  });

  return (
    <Pressable
      disabled={!interactive}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel="Mascot Mots"
      style={styles.container}
    >
      <Animated.View
        style={[
          styles.mascotWrap,
          {
            width: size,
            height: size,
            transform: [
              { translateY: floatAnim },
              { scale: Animated.multiply(breathAnim, bounceAnim) },
              {
                rotate: tiltAnim.interpolate({
                  inputRange: [-10, 10],
                  outputRange: ["-10deg", "10deg"],
                }),
              },
            ],
          },
        ]}
      >
        {/* Star Antenna on Top */}
        <Animated.View
          style={[
            styles.starAntenna,
            {
              top: -6 * scale,
              transform: [{ translateY: starTranslateY }, { rotate: starRotate }],
            },
          ]}
        >
          <View
            style={[
              styles.sparklePoint,
              {
                width: 10 * scale,
                height: 10 * scale,
                backgroundColor: isThinking ? colors.accentCoral : colors.starHighlight,
              },
            ]}
          />
        </Animated.View>

        {/* Main Vector Mascot Body */}
        <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
          <Defs>
            <LinearGradient id={bodyGradId} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
              <Stop offset="0%" stopColor="#8A6DF9" />
              <Stop offset="50%" stopColor="#7A5AF8" />
              <Stop offset="100%" stopColor="#623BF0" />
            </LinearGradient>
            <LinearGradient id={visorGradId} x1="10" y1="18" x2="54" y2="44" gradientUnits="userSpaceOnUse">
              <Stop offset="0%" stopColor="#1B1C22" />
              <Stop offset="100%" stopColor="#121316" />
            </LinearGradient>
            <LinearGradient id={bellyGradId} x1="32" y1="46" x2="32" y2="60" gradientUnits="userSpaceOnUse">
              <Stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
              <Stop offset="100%" stopColor="rgba(255,255,255,0.06)" />
            </LinearGradient>
          </Defs>

          {/* Left Ear / Antenna */}
          <Circle cx="8" cy="27" r="4.5" fill="#623BF0" />
          <Circle cx="8" cy="27" r="2.5" fill="#FAF8F5" />

          {/* Right Ear / Antenna */}
          <Circle cx="56" cy="27" r="4.5" fill="#623BF0" />
          <Circle cx="56" cy="27" r="2.5" fill="#FAF8F5" />

          {/* Outer Body Capsule */}
          <Rect
            x="9"
            y="7"
            width="46"
            height="50"
            rx="23"
            fill={`url(#${bodyGradId})`}
          />

          {/* Glossy Top Highlight */}
          <Path
            d="M 18 12 Q 32 9 46 12"
            stroke="rgba(255, 255, 255, 0.45)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Belly Patch */}
          <Path
            d="M 20 46 C 20 53, 44 53, 44 46 Z"
            fill={`url(#${bellyGradId})`}
          />

          {/* Dark Glass Visor */}
          <Rect
            x="13"
            y="17"
            width="38"
            height="26"
            rx="13"
            fill={`url(#${visorGradId})`}
          />
        </Svg>

        {/* Dynamic Animated Face (Eyes & Smile) Layer */}
        <Animated.View
          style={[
            styles.faceLayer,
            {
              transform: [{ scaleY: blinkAnim }],
            },
          ]}
        >
          {isThinking ? (
            /* Thinking State: Star Eyes */
            <View style={styles.thinkingEyesRow}>
              <Text style={[styles.starEyeText, { fontSize: 13 * scale }]}>✦</Text>
              <Text style={[styles.starEyeText, { fontSize: 13 * scale }]}>✦</Text>
            </View>
          ) : isRoutine ? (
            /* Routine State: Focused Calm Eyes */
            <View style={styles.routineEyesRow}>
              <View style={[styles.routineEyeBar, { width: 8 * scale, height: 2.2 * scale }]} />
              <View style={[styles.routineEyeBar, { width: 8 * scale, height: 2.2 * scale }]} />
            </View>
          ) : isHappy ? (
            /* Happy / Tapped State: Cute Curved Inverted Arcs (^ ^) */
            <View style={styles.happyEyesRow}>
              <Text style={[styles.happyEyeText, { fontSize: 12 * scale }]}>^</Text>
              <Text style={[styles.happyEyeText, { fontSize: 12 * scale }]}>^</Text>
            </View>
          ) : (
            /* Default Idle Eyes: Expressive Glowing Pupils */
            <View style={styles.idleEyesRow}>
              <View style={[styles.idleEye, { width: 7 * scale, height: 9 * scale }]}>
                <View style={[styles.pupilGlint, { width: 2.5 * scale, height: 2.5 * scale }]} />
              </View>
              <View style={[styles.idleEye, { width: 7 * scale, height: 9 * scale }]}>
                <View style={[styles.pupilGlint, { width: 2.5 * scale, height: 2.5 * scale }]} />
              </View>
            </View>
          )}

          {/* Cheeks blush */}
          <View style={styles.cheeksRow}>
            <View
              style={[
                styles.blush,
                { width: 5 * scale, height: 2.5 * scale, backgroundColor: colors.cardSurfacePink },
              ]}
            />
            <View
              style={[
                styles.blush,
                { width: 5 * scale, height: 2.5 * scale, backgroundColor: colors.cardSurfacePink },
              ]}
            />
          </View>

          {/* Sweet Mouth Smile */}
          <View style={[styles.mouthSmile, { width: 6 * scale, height: 3 * scale }]} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      web: {
        outlineStyle: "none",
        outlineWidth: 0,
        userSelect: "none",
        cursor: "pointer",
      } as any,
    }),
  },
  mascotWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  starAntenna: {
    position: "absolute",
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sparklePoint: {
    borderRadius: 2,
    transform: [{ rotate: "45deg" }],
  },
  faceLayer: {
    position: "absolute",
    top: "33%",
    width: "48%",
    alignItems: "center",
    justifyContent: "center",
  },
  idleEyesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 3,
  },
  idleEye: {
    borderRadius: 5,
    backgroundColor: "#78C864", // Fresh mint glowing gaze
    alignItems: "flex-end",
    paddingTop: 1.5,
    paddingRight: 1.5,
  },
  pupilGlint: {
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },
  happyEyesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 2,
  },
  happyEyeText: {
    color: "#78C864",
    fontWeight: "900",
    lineHeight: 14,
  },
  thinkingEyesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 2,
  },
  starEyeText: {
    color: "#F5DF98",
    fontWeight: "700",
    lineHeight: 15,
  },
  routineEyesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 3,
  },
  routineEyeBar: {
    borderRadius: 2,
    backgroundColor: "#78C864",
  },
  cheeksRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 2,
    paddingHorizontal: 1,
    opacity: 0.85,
  },
  blush: {
    borderRadius: 999,
  },
  mouthSmile: {
    borderBottomWidth: 1.5,
    borderBottomColor: "rgba(255, 255, 255, 0.75)",
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    marginTop: 1,
  },
});
