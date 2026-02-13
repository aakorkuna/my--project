import type { TileDefinition, TileId } from "./types";

export const START_TILE_ID: TileId = "start_city_road_corner";

export const TILESET: Record<TileId, TileDefinition> = {
  start_city_road_corner: {
    id: "start_city_road_corner",
    label: "Start (city + road straight)",
    // total copies of this tile in the deck (one is consumed as the placed start tile)
    weight: 4,
    roadGroups: [["E", "W"]],
    edges: {
      N: { terrain: "city", road: false },
      E: { terrain: "land", road: true },
      S: { terrain: "land", road: false },
      W: { terrain: "land", road: true },
    },
  },

  church: {
    id: "church",
    label: "Church",
    weight: 4,
    edges: {
      N: { terrain: "land", road: false },
      E: { terrain: "land", road: false },
      S: { terrain: "land", road: false },
      W: { terrain: "land", road: false },
    },
  },

  church_road: {
    id: "church_road",
    label: "Church + road",
    weight: 2,
    roadGroups: [["N"]],
    edges: {
      N: { terrain: "land", road: true },
      E: { terrain: "land", road: false },
      S: { terrain: "land", road: false },
      W: { terrain: "land", road: false },
    },
  },

  road_straight: {
    id: "road_straight",
    label: "Road straight",
    weight: 8,
    roadGroups: [["N", "S"]],
    edges: {
      N: { terrain: "land", road: true },
      E: { terrain: "land", road: false },
      S: { terrain: "land", road: true },
      W: { terrain: "land", road: false },
    },
  },

  road_corner: {
    id: "road_corner",
    label: "Road corner",
    weight: 9,
    roadGroups: [["N", "E"]],
    edges: {
      N: { terrain: "land", road: true },
      E: { terrain: "land", road: true },
      S: { terrain: "land", road: false },
      W: { terrain: "land", road: false },
    },
  },

  road_t: {
    id: "road_t",
    label: "Road T-junction",
    weight: 4,
    // Village: 3 road ends that do NOT connect to each other.
    roadGroups: [["N"], ["E"], ["W"]],
    edges: {
      N: { terrain: "land", road: true },
      E: { terrain: "land", road: true },
      S: { terrain: "land", road: false },
      W: { terrain: "land", road: true },
    },
  },

  road_cross: {
    id: "road_cross",
    label: "Road crossroads",
    weight: 1,
    // Village: 4 road ends that do NOT connect to each other.
    roadGroups: [["N"], ["E"], ["S"], ["W"]],
    edges: {
      N: { terrain: "land", road: true },
      E: { terrain: "land", road: true },
      S: { terrain: "land", road: true },
      W: { terrain: "land", road: true },
    },
  },

  city_edge: {
    id: "city_edge",
    label: "City edge",
    weight: 5,
    edges: {
      N: { terrain: "city", road: false },
      E: { terrain: "land", road: false },
      S: { terrain: "land", road: false },
      W: { terrain: "land", road: false },
    },
  },

  // City on opposite sides, connected (with shield)
  city_opposite_connected_shield: {
    id: "city_opposite_connected_shield",
    label: "City opposite (connected) + shield",
    weight: 2,
    hasShield: true,
    cityGroups: [["E", "W"]],
    edges: {
      N: { terrain: "land", road: false },
      E: { terrain: "city", road: false },
      S: { terrain: "land", road: false },
      W: { terrain: "city", road: false },
    },
  },

  // City on opposite sides, connected (no shield)
  city_opposite_connected: {
    id: "city_opposite_connected",
    label: "City opposite (connected)",
    weight: 1,
    cityGroups: [["E", "W"]],
    edges: {
      N: { terrain: "land", road: false },
      E: { terrain: "city", road: false },
      S: { terrain: "land", road: false },
      W: { terrain: "city", road: false },
    },
  },

  // City on opposite sides, NOT connected (two separate city segments)
  city_opposite_disconnected: {
    id: "city_opposite_disconnected",
    label: "City opposite (disconnected)",
    weight: 3,
    cityGroups: [["N"], ["S"]],
    edges: {
      N: { terrain: "city", road: false },
      E: { terrain: "land", road: false },
      S: { terrain: "city", road: false },
      W: { terrain: "land", road: false },
    },
  },

  // City corner (adjacent sides), connected
  city_corner: {
    id: "city_corner",
    label: "City corner",
    weight: 3,
    cityGroups: [["N", "W"]],
    edges: {
      N: { terrain: "city", road: false },
      E: { terrain: "land", road: false },
      S: { terrain: "land", road: false },
      W: { terrain: "city", road: false },
    },
  },

  city_corner_disconnected: {
    id: "city_corner_disconnected",
    label: "City corner (disconnected)",
    weight: 2,
    cityGroups: [["N"], ["W"]],
    edges: {
      N: { terrain: "city", road: false },
      E: { terrain: "land", road: false },
      S: { terrain: "land", road: false },
      W: { terrain: "city", road: false },
    },
  },

  city_corner_shield: {
    id: "city_corner_shield",
    label: "City corner + shield",
    weight: 2,
    hasShield: true,
    cityGroups: [["N", "W"]],
    edges: {
      N: { terrain: "city", road: false },
      E: { terrain: "land", road: false },
      S: { terrain: "land", road: false },
      W: { terrain: "city", road: false },
    },
  },

  city_corner_shield_road_corner_es: {
    id: "city_corner_shield_road_corner_es",
    label: "City corner + shield + road corner (E,S)",
    weight: 2,
    hasShield: true,
    cityGroups: [["N", "W"]],
    roadGroups: [["E", "S"]],
    edges: {
      N: { terrain: "city", road: false },
      E: { terrain: "land", road: true },
      S: { terrain: "land", road: true },
      W: { terrain: "city", road: false },
    },
  },

  city_corner_road_corner_es: {
    id: "city_corner_road_corner_es",
    label: "City corner + road corner (E,S)",
    weight: 3,
    cityGroups: [["N", "W"]],
    roadGroups: [["E", "S"]],
    edges: {
      N: { terrain: "city", road: false },
      E: { terrain: "land", road: true },
      S: { terrain: "land", road: true },
      W: { terrain: "city", road: false },
    },
  },

  city_3sides_shield: {
    id: "city_3sides_shield",
    label: "City on 3 sides + shield",
    weight: 1,
    hasShield: true,
    cityGroups: [["N", "E", "W"]],
    edges: {
      N: { terrain: "city", road: false },
      E: { terrain: "city", road: false },
      S: { terrain: "land", road: false },
      W: { terrain: "city", road: false },
    },
  },

  city_3sides: {
    id: "city_3sides",
    label: "City on 3 sides",
    weight: 3,
    cityGroups: [["N", "E", "W"]],
    edges: {
      N: { terrain: "city", road: false },
      E: { terrain: "city", road: false },
      S: { terrain: "land", road: false },
      W: { terrain: "city", road: false },
    },
  },

  city_3sides_road_shield: {
    id: "city_3sides_road_shield",
    label: "City on 3 sides + road + shield",
    weight: 2,
    hasShield: true,
    cityGroups: [["N", "E", "W"]],
    roadGroups: [["S"]],
    edges: {
      N: { terrain: "city", road: false },
      E: { terrain: "city", road: false },
      S: { terrain: "land", road: true },
      W: { terrain: "city", road: false },
    },
  },

  city_3sides_road: {
    id: "city_3sides_road",
    label: "City on 3 sides + road",
    weight: 1,
    cityGroups: [["N", "E", "W"]],
    roadGroups: [["S"]],
    edges: {
      N: { terrain: "city", road: false },
      E: { terrain: "city", road: false },
      S: { terrain: "land", road: true },
      W: { terrain: "city", road: false },
    },
  },

  city_edge_road_corner_es: {
    id: "city_edge_road_corner_es",
    label: "City edge + road corner (E,S)",
    weight: 3,
    roadGroups: [["E", "S"]],
    edges: {
      N: { terrain: "city", road: false },
      E: { terrain: "land", road: true },
      S: { terrain: "land", road: true },
      W: { terrain: "land", road: false },
    },
  },

  city_edge_road_corner_sw: {
    id: "city_edge_road_corner_sw",
    label: "City edge + road corner (S,W)",
    weight: 3,
    roadGroups: [["S", "W"]],
    edges: {
      N: { terrain: "city", road: false },
      E: { terrain: "land", road: false },
      S: { terrain: "land", road: true },
      W: { terrain: "land", road: true },
    },
  },

  city_edge_roads_3: {
    id: "city_edge_roads_3",
    label: "City edge + roads (E,S,W)",
    weight: 3,
    // Village-like: 3 road ends that do NOT connect to each other.
    roadGroups: [["E"], ["S"], ["W"]],
    edges: {
      N: { terrain: "city", road: false },
      E: { terrain: "land", road: true },
      S: { terrain: "land", road: true },
      W: { terrain: "land", road: true },
    },
  },

  city_full_shield: {
    id: "city_full_shield",
    label: "City (all sides) + shield",
    weight: 1,
    hasShield: true,
    edges: {
      N: { terrain: "city", road: false },
      E: { terrain: "city", road: false },
      S: { terrain: "city", road: false },
      W: { terrain: "city", road: false },
    },
  },
};

export function buildInitialDeck(): TileId[] {
  const deck: TileId[] = [];
  for (const def of Object.values(TILESET)) {
    const w = Math.max(0, Math.floor(def.weight ?? 1));
    for (let i = 0; i < w; i++) deck.push(def.id);
  }
  return deck;
}