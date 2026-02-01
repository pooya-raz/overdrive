import type { GameMap } from "@overdrive/shared";
import { usaMapWaypoints } from "./usa-map-waypoints";

export interface Waypoint {
  x: number;
  y: number;
}

export interface MapConfig {
  image: string;
  width: number;
  height: number;
  startOffset: number;
  waypoints: Waypoint[];
}

const MAP_CONFIGS: Record<GameMap, MapConfig> = {
  USA: {
    image: "/map/usa-map.webp",
    width: 600,
    height: 399,
    startOffset: 0,
    waypoints: usaMapWaypoints,
  },
  Test: {
    image: "",
    width: 0,
    height: 0,
    startOffset: 0,
    waypoints: [],
  },
};

export function getMapConfig(map: GameMap): MapConfig {
  return MAP_CONFIGS[map];
}
