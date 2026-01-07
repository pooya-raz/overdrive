import type { GameMap, Track } from "./types";

const MAP_TRACKS: Record<GameMap, Track> = {
	USA: {
		length: 24,
		corners: [
			{ position: 6, speedLimit: 4 },
			{ position: 15, speedLimit: 3 },
		],
	},
};

export function getMapTrack(map: GameMap): Track {
	return MAP_TRACKS[map];
}
