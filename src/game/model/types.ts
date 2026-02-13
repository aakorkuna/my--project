export type Terrain = "land" | "city";

export type EdgeDir = "N" | "E" | "S" | "W";

export type Rotation = 0 | 90 | 180 | 270;

export type Coord = { x: number; y: number };

export type EdgeState = {
  terrain: Terrain; // land | city
  road: boolean;    // true = visible road, false = no road
};

export type TileEdges = Record<EdgeDir, EdgeState>;

export type TileId = string;

export type TileDefinition = {
  id: TileId;
  edges: TileEdges;
  label?: string;
  weight?: number; // for random draw (integer recommended)
  /** Bonus marker on a city (used for future scoring). */
  hasShield?: boolean;
  /**
   * Optional internal connectivity for city edges on the same tile.
   * Each group lists the edge directions that are connected together.
   * Example: disconnected opposite cities => [["N"],["S"]]; connected => [["N","S"]]
   * If omitted, all city edges are treated as a single connected group.
   */
  cityGroups?: EdgeDir[][];
  /**
   * Optional internal connectivity for road edges on the same tile.
   * Each group lists the road edge directions that are connected together.
   * If omitted, all road edges are treated as a single connected group.
   */
  roadGroups?: EdgeDir[][];
};

export type PlacedTile = {
  tileId: TileId;
  x: number;
  y: number;
  rotation: Rotation;
};

export type BoardState = Record<string, PlacedTile>; // key = "x,y"

export type ActiveTile = {
  tileId: TileId;
  rotation: Rotation;
};

export type MeepleFeature =
  | { kind: "church" }
  | {
      kind: "road";
      /** Direction of the road segment on the tile (world-oriented after rotation). */
      dir: EdgeDir;
    }
  | {
      kind: "city";
      /** Direction of the city segment on the tile (world-oriented after rotation). */
      dir: EdgeDir;
    };

export type MeeplePlacement = {
  x: number;
  y: number;
  feature: MeepleFeature;
  /** 0-based player index (optional for backward compatibility with old saves). */
  player?: number;
};

export type GameState = {
  board: BoardState;
  deck: TileId[];
  active: ActiveTile | null;

  /** Accumulated score for the (single) player. */
  score: number;

  /** Total number of players (1 = solo). */
  playerCount: number;
  /** 0-based active player index. */
  currentPlayer: number;
  /** Per-player scores, length = playerCount. */
  scores: number[];

  /** Remaining unplaced meeples for the (single) player. */
  meeplesRemaining: number;
  /** Per-player remaining meeples, length = playerCount. */
  meeplesRemainingByPlayer: number[];
  /** All meeples already placed on the board. */
  meeples: MeeplePlacement[];
  /** The tile where a meeple can be placed right now (usually the last placed tile). */
  meepleTarget: Coord | null;
};