import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Platform, StyleSheet, View } from "react-native";
import Svg, { Circle, Ellipse, Path } from "react-native-svg";
import { useTheme } from "../context/ThemeContext";
import { useReduceMotion } from "../hooks/useReduceMotion";

/**
 * Mots: a speech bubble with a face. Each mood has its own colour and loop
 * (design system, Mascot): felice hops on blush, calmo breathes on mint, pensa
 * tilts on sky while three dots rise. Under reduced motion it holds still.
 */
export type MascotMood = "felice" | "calmo" | "pensa";

type Props = {
  readonly mood?: MascotMood;
  readonly size?: number;
  /** Announced to screen readers. Leave it out when the face is decoration. */
  readonly label?: string;
  /** The soft ground shadow under a large mascot. */
  readonly shadow?: boolean;
  /** Loop count. Left out, the animation runs until it unmounts. */
  readonly cycles?: number;
};

const VIEW = 176;
const BODY = "M72 28H104C134 28 152 46 152 76V92C152 122 134 140 104 140H72L46 160L50 135C34 127 24 112 24 92V76C24 46 42 28 72 28Z";
const useNative = Platform.OS !== "web";

/** Eye boxes in the 176 grid, so a blink squashes the eyes around their own centre. */
const EYES = {
  felice: { x: 60, y: 70, w: 56, h: 20, eyes: [[70, 80, 6, 8], [106, 80, 6, 8]] },
  pensa: { x: 66, y: 65, w: 54, h: 18, eyes: [[76, 74, 6, 7], [110, 74, 6, 7]] },
} as const;

function loop(animation: Animated.CompositeAnimation, iterations: number): Animated.CompositeAnimation {
  return Animated.loop(animation, { iterations });
}

export function Mascot({ mood = "felice", size = 168, label, shadow = false, cycles }: Props) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const body = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(0)).current;
  const dots = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    body.setValue(0);
    blink.setValue(0);
    dots.setValue(0);
    if (reduceMotion) return;
    const period = mood === "felice" ? 2400 : mood === "calmo" ? 4000 : 3000;
    const iterations = cycles ?? -1;
    const running = [
      loop(
        Animated.timing(body, {
          toValue: 1,
          duration: period,
          easing: mood === "felice" ? Easing.linear : Easing.inOut(Easing.sin),
          useNativeDriver: useNative,
        }),
        iterations,
      ),
      loop(Animated.timing(blink, { toValue: 1, duration: 4000, easing: Easing.linear, useNativeDriver: useNative }), iterations),
      loop(Animated.timing(dots, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: useNative }), iterations),
    ];
    for (const animation of running) animation.start();
    return () => {
      for (const animation of running) animation.stop();
    };
  }, [blink, body, cycles, dots, mood, reduceMotion]);

  const scale = size / VIEW;
  const fill = mood === "felice" ? colors.blush : mood === "calmo" ? colors.mint : colors.sky;
  const ink = colors.inkOnPastel;

  const bodyTransform = useMemo(() => {
    if (mood === "felice") {
      // A hop and a small squash on landing; still from 55% to the end of the loop.
      return [
        { translateY: body.interpolate({ inputRange: [0, 0.25, 0.55, 0.62, 0.72, 1], outputRange: [0, -10 * scale, 0, 2 * scale, 0, 0] }) },
        { scaleX: body.interpolate({ inputRange: [0, 0.25, 0.55, 0.62, 0.72, 1], outputRange: [1, 0.97, 1, 1.04, 1, 1] }) },
        { scaleY: body.interpolate({ inputRange: [0, 0.25, 0.55, 0.62, 0.72, 1], outputRange: [1, 1.03, 1, 0.95, 1, 1] }) },
      ];
    }
    if (mood === "calmo") {
      return [{ scale: body.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.04, 1] }) }];
    }
    return [{ rotate: body.interpolate({ inputRange: [0, 0.5, 1], outputRange: ["0deg", "-5deg", "0deg"] }) }];
  }, [body, mood, scale]);

  const shadowScale = mood === "felice"
    ? body.interpolate({ inputRange: [0, 0.25, 0.55, 1], outputRange: [1, 0.8, 1, 1] })
    : 1;
  const blinkScale = blink.interpolate({ inputRange: [0, 0.92, 0.95, 0.98, 1], outputRange: [1, 1, 0.1, 1, 1] });
  const eyes = mood === "calmo" ? undefined : EYES[mood];

  const a11y = label === undefined
    ? ({ accessible: false, importantForAccessibility: "no-hide-descendants", "aria-hidden": true } as const)
    : ({ accessible: true, accessibilityRole: "image", accessibilityLabel: label } as const);

  return (
    <View {...a11y} style={{ width: size, height: size }}>
      {shadow ? (
        <Animated.View
          style={[
            styles.shadow,
            {
              left: (44 / VIEW) * size,
              width: (88 / VIEW) * size,
              top: (161 / VIEW) * size,
              height: (10 / VIEW) * size,
              backgroundColor: ink,
              transform: [{ scaleX: shadowScale }],
            },
          ]}
        />
      ) : null}
      <Animated.View style={[StyleSheet.absoluteFill, { transform: bodyTransform }]}>
        <Svg width={size} height={size} viewBox={`0 0 ${VIEW} ${VIEW}`}>
          <Path d={BODY} fill={fill} />
          {mood === "felice" ? (
            <Path d="M74 102C82 113 96 113 104 102" stroke={ink} strokeWidth={3.2} strokeLinecap="round" fill="none" />
          ) : null}
          {mood === "calmo" ? (
            <>
              <Path d="M60 82C64 88 74 88 78 82M98 82C102 88 112 88 116 82" stroke={ink} strokeWidth={3.2} strokeLinecap="round" fill="none" />
              <Path d="M83 106C87 109 93 109 97 106" stroke={ink} strokeWidth={3.2} strokeLinecap="round" fill="none" />
            </>
          ) : null}
        </Svg>
        {eyes !== undefined ? (
          <Animated.View
            style={{
              position: "absolute",
              left: eyes.x * scale,
              top: eyes.y * scale,
              width: eyes.w * scale,
              height: eyes.h * scale,
              transform: [{ scaleY: blinkScale }],
            }}
          >
            <Svg width={eyes.w * scale} height={eyes.h * scale} viewBox={`${eyes.x} ${eyes.y} ${eyes.w} ${eyes.h}`}>
              {eyes.eyes.map(([cx, cy, rx, ry]) => (
                <Ellipse key={cx} cx={cx} cy={cy} rx={rx} ry={ry} fill={ink} />
              ))}
            </Svg>
          </Animated.View>
        ) : null}
        {mood === "pensa"
          ? [74, 88, 102].map((cx, index) => {
              const start = index * 0.125;
              const rise = dots.interpolate({
                inputRange: [0, start, start + 0.25, start + 0.5, 1],
                outputRange: [0, 0, -5 * scale, 0, 0],
              });
              const opacity = dots.interpolate({
                inputRange: [0, start, start + 0.25, start + 0.5, 1],
                outputRange: [0.45, 0.45, 1, 0.45, 0.45],
              });
              const r = 4.5 * scale;
              return (
                <Animated.View
                  key={cx}
                  style={{
                    position: "absolute",
                    left: cx * scale - r,
                    top: 106 * scale - r,
                    width: r * 2,
                    height: r * 2,
                    borderRadius: r,
                    backgroundColor: ink,
                    opacity: reduceMotion ? 1 : opacity,
                    transform: [{ translateY: rise }],
                  }}
                />
              );
            })
          : null}
      </Animated.View>
    </View>
  );
}

/** The bubble alone at avatar size: no loop, no shadow. */
export function MascotAvatar({ size = 28 }: { readonly size?: number }) {
  const { colors } = useTheme();
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" aria-hidden style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${VIEW} ${VIEW}`}>
        <Path d={BODY} fill={colors.sky} />
        <Circle cx={76} cy={74} r={9} fill={colors.inkOnPastel} />
        <Circle cx={110} cy={74} r={9} fill={colors.inkOnPastel} />
        <Path d="M76 108C84 114 96 114 104 108" stroke={colors.inkOnPastel} strokeWidth={8} strokeLinecap="round" fill="none" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    position: "absolute",
    borderRadius: 999,
    opacity: 0.1,
  },
});
