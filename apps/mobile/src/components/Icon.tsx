import { Text, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useTheme } from "../context/ThemeContext";

type IconProps = {
  readonly size?: number;
  readonly color?: string;
  readonly strokeWidth?: number;
};

/** Modern Android / Material clean 2-bar or 3-bar hamburger menu icon */
export function MenuIcon({ size = 20, color, strokeWidth = 2 }: IconProps) {
  const { colors } = useTheme();
  const iconColor = color ?? colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 7H20M4 12H20M4 17H20"
        stroke={iconColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Crisp centered plus sign: starts a new chat or triggers action */
export function PlusIcon({ size = 20, color, strokeWidth = 2 }: IconProps) {
  const { colors } = useTheme();
  const iconColor = color ?? colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 5V19M5 12H19"
        stroke={iconColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** A cross: closes sheets or dialogs */
export function CloseIcon({ size = 18, color, strokeWidth = 2 }: IconProps) {
  const { colors } = useTheme();
  const iconColor = color ?? colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 6L6 18M6 6L18 18"
        stroke={iconColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Modern send arrow pointing up with stem (ChatGPT / Grok Bot style) */
export function ArrowUpIcon({ size = 18, color = "#FFFFFF", strokeWidth = 2.4 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 19V5M5 12L12 5L19 12"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** A chevron pointing right: opens items in list */
export function ChevronRightIcon({
  size = 16,
  color,
  strokeWidth = 2,
}: IconProps) {
  const { colors } = useTheme();
  const iconColor = color ?? colors.textSecondary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 18L15 12L9 6"
        stroke={iconColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** A chevron pointing down: expands an accordion */
export function ChevronDownIcon({
  size = 16,
  color,
  strokeWidth = 2,
}: IconProps) {
  const { colors } = useTheme();
  const iconColor = color ?? colors.textSecondary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 9L12 15L18 9"
        stroke={iconColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** A chevron pointing up: collapses an accordion */
export function ChevronUpIcon({
  size = 16,
  color,
  strokeWidth = 2,
}: IconProps) {
  const { colors } = useTheme();
  const iconColor = color ?? colors.textSecondary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 15L12 9L6 15"
        stroke={iconColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** 4-point sparkle star for AI reasoning */
export function SparkleIcon({ size = 16, color }: IconProps) {
  const { colors } = useTheme();
  const iconColor = color ?? colors.starHighlight;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
        fill={iconColor}
      />
    </Svg>
  );
}

/** Two overlapping rounded rectangles for Copying message text */
export function CopyIcon({
  size = 16,
  color,
  strokeWidth = 1.8,
}: IconProps) {
  const { colors } = useTheme();
  const iconColor = color ?? colors.textSecondary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x="9"
        y="9"
        width="11"
        height="11"
        rx="2.5"
        stroke={iconColor}
        strokeWidth={strokeWidth}
      />
      <Path
        d="M5 15H4C3.44772 15 3 14.5523 3 14V4C3 3.44772 3.44772 3 4 3H14C14.5523 3 15 3.44772 15 4V5"
        stroke={iconColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Checkmark for copy confirmation */
export function CheckIcon({
  size = 16,
  color,
  strokeWidth = 2.2,
}: IconProps) {
  const { colors } = useTheme();
  const iconColor = color ?? colors.accentGreen;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 6L9 17L4 12"
        stroke={iconColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Circular clock icon for scheduled autonomous routines */
export function ClockIcon({
  size = 16,
  color,
  strokeWidth = 1.8,
}: IconProps) {
  const { colors } = useTheme();
  const iconColor = color ?? colors.textSecondary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={iconColor} strokeWidth={strokeWidth} />
      <Path
        d="M12 7V12L15 15"
        stroke={iconColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Two vertical bars for paused state */
export function PauseIcon({
  size = 14,
  color,
  strokeWidth = 2.2,
}: IconProps) {
  const { colors } = useTheme();
  const iconColor = color ?? colors.textSecondary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 6V18M15 6V18"
        stroke={iconColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Magnifying glass for memory and conversation search */
export function SearchIcon({
  size = 16,
  color,
  strokeWidth = 2,
}: IconProps) {
  const { colors } = useTheme();
  const iconColor = color ?? colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="7" stroke={iconColor} strokeWidth={strokeWidth} />
      <Path
        d="M20 20L16 16"
        stroke={iconColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Bookmark ribbon for memory storage tools */
export function BookmarkIcon({
  size = 16,
  color,
  strokeWidth = 1.8,
}: IconProps) {
  const { colors } = useTheme();
  const iconColor = color ?? colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 21L12 16L5 21V5C5 3.89543 5.89543 3 7 3H17C18.1046 3 19 3.89543 19 5V21Z"
        stroke={iconColor}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Branching tree icon for conversation fork */
export function ForkIcon({
  size = 16,
  color,
  strokeWidth = 1.8,
}: IconProps) {
  const { colors } = useTheme();
  const iconColor = color ?? colors.textSecondary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="6" cy="6" r="2.5" stroke={iconColor} strokeWidth={strokeWidth} />
      <Circle cx="18" cy="6" r="2.5" stroke={iconColor} strokeWidth={strokeWidth} />
      <Circle cx="12" cy="18" r="2.5" stroke={iconColor} strokeWidth={strokeWidth} />
      <Path
        d="M6 8.5V11C6 13 8 15 12 15.5M18 8.5V11C18 13 16 15 12 15.5M12 15.5V15.5"
        stroke={iconColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Circled exclamation mark: an error or a failed step */
export function AlertIcon({ size = 16, color, strokeWidth = 2 }: IconProps) {
  const { colors } = useTheme();
  const iconColor = color ?? colors.textPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={iconColor} strokeWidth={strokeWidth} />
      <Path d="M12 7.5V13" stroke={iconColor} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Circle cx="12" cy="16.5" r="1.2" fill={iconColor} />
    </Svg>
  );
}

/** Bin with lid: something was removed */
export function TrashIcon({ size = 16, color, strokeWidth = 1.8 }: IconProps) {
  const { colors } = useTheme();
  const iconColor = color ?? colors.textSecondary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 7H20M10 11V17M14 11V17M6 7L7 19C7 20.1 7.9 21 9 21H15C16.1 21 17 20.1 17 19L18 7M9 7V4H15V7"
        stroke={iconColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Wrench: any other tool the agent ran */
export function ToolIcon({ size = 16, color, strokeWidth = 1.8 }: IconProps) {
  const { colors } = useTheme();
  const iconColor = color ?? colors.textSecondary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
        stroke={iconColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Grok Bot style circular avatar with colored background and emblem */
export function BotAvatarIcon({
  size = 36,
  backgroundColor,
  badge = "✦",
}: {
  readonly size?: number;
  readonly backgroundColor?: string;
  readonly badge?: string;
}) {
  const { colors } = useTheme();
  const bg = backgroundColor ?? colors.avatarPurple;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: "#FFFFFF",
          fontSize: size * 0.44,
          fontWeight: "700",
        }}
      >
        {badge}
      </Text>
    </View>
  );
}
