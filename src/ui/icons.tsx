import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * The line icons the design draws, transcribed path-for-path out of
 * `Kolvi App.dc.html` rather than matched by eye against an icon font. They are
 * Lucide glyphs at Lucide's own defaults — a 24×24 box, no fill, a 2px round
 * stroke — which is why every icon here shares one wrapper and differs only in
 * its geometry.
 *
 * An icon is decorative: it repeats something the label beside it already says.
 * None of them carry an accessibility label, and the control they sit inside is
 * the accessibility element.
 */

export type IconProps = {
  /**
   * The stroke. Required rather than defaulted — an icon that picks its own
   * colour cannot follow the state of the control it sits in, which is exactly
   * what the tab bar needs it to do.
   */
  color: string;
  /** The design draws every icon at 22 except the profile chevron. */
  size?: number;
};

/** The design's `width="22" height="22"`. */
const defaultSize = 22;

/** Lucide's own stroke width, and the design's. */
const strokeWidth = 2;

type GlyphProps = IconProps & { children: React.ReactNode; strokeWidth?: number };

function Glyph({
  color,
  size = defaultSize,
  strokeWidth: width = strokeWidth,
  children,
}: GlyphProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

/** `house` — the Inicio tab. */
export function HomeIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <Path d="M9 22V12h6v10" />
    </Glyph>
  );
}

/** `clock` — the Jornada tab. */
export function ClockIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 7v5l3 3" />
    </Glyph>
  );
}

/** `calendar-check` — the Permisos tab. */
export function CalendarCheckIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Rect x={3} y={4} width={18} height={18} rx={2} />
      <Path d="M3 10h18" />
      <Path d="m8 15 2 2 4-4" />
    </Glyph>
  );
}

/** `file-text` — the Documentos tab. */
export function FileTextIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <Path d="M14 2v6h6" />
      <Path d="M9 13h6" />
      <Path d="M9 17h6" />
    </Glyph>
  );
}

/**
 * `chevron-left` — the back affordance on the profile surface. The design
 * thickens this one to 2.2 so a lone chevron still reads as a control.
 */
export function ChevronLeftIcon(props: IconProps) {
  return (
    <Glyph {...props} strokeWidth={2.2}>
      <Path d="m15 18-6-6 6-6" />
    </Glyph>
  );
}

/**
 * `user`. Not in the design, which fills the avatar with the employee's
 * initials — there is no session to read a name from until KMO-8, and inventing
 * initials would be exactly the sample data KMO-30 exists to keep out of a
 * build. The glyph stands in until then.
 */
export function UserIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <Circle cx={12} cy={7} r={4} />
    </Glyph>
  );
}

/** `eye` — the password field with its characters showing. */
export function EyeIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <Circle cx={12} cy={12} r={3} />
    </Glyph>
  );
}

/**
 * `eye-off` — the same field masked. The two glyphs are the toggle's only visual
 * difference, so the control also renames itself: an icon swap alone says nothing
 * to a screen reader.
 */
export function EyeOffIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <Path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <Path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <Path d="m2 2 20 20" />
    </Glyph>
  );
}
