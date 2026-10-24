export type DotRole = "body" | "eye" | "wave";

export type Dot = {
  readonly col: number;
  readonly row: number;
  readonly role: DotRole;
};

export const DOT_COLS = 5;
export const DOT_ROWS = 5;

/** A rounded blob with two eyes and one dot that can wave. */
export const DOTS: readonly Dot[] = [
  { col: 1, row: 0, role: "body" },
  { col: 2, row: 0, role: "wave" },
  { col: 3, row: 0, role: "body" },
  { col: 0, row: 1, role: "body" },
  { col: 1, row: 1, role: "body" },
  { col: 2, row: 1, role: "body" },
  { col: 3, row: 1, role: "body" },
  { col: 4, row: 1, role: "body" },
  { col: 0, row: 2, role: "body" },
  { col: 1, row: 2, role: "eye" },
  { col: 3, row: 2, role: "eye" },
  { col: 4, row: 2, role: "body" },
  { col: 0, row: 3, role: "body" },
  { col: 1, row: 3, role: "body" },
  { col: 2, row: 3, role: "body" },
  { col: 3, row: 3, role: "body" },
  { col: 4, row: 3, role: "body" },
  { col: 1, row: 4, role: "body" },
  { col: 2, row: 4, role: "body" },
  { col: 3, row: 4, role: "body" },
];
