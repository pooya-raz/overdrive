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
		corners: [], // To be defined later
	},
};

export function getMapTrack(map: GameMap): Track {
	return MAP_TRACKS[map];
}
