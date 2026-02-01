import type { GameMap, Track } from "./types";

const MAP_TRACKS: Record<GameMap, Track> = {
	Test: {
		length: 24,
		corners: [
			{ position: 6, speedLimit: 4 },
			{ position: 15, speedLimit: 3 },
		],
	},
	USA: {
		length: 69,
		corners: [
			{ position: 13, speedLimit: 7 },
			{ position: 34, speedLimit: 3 },
			{ position: 50, speedLimit: 3 },
			{ position: 58, speedLimit: 2 },
		],
	},
};

export function getMapTrack(map: GameMap): Track {
	return MAP_TRACKS[map];
}
