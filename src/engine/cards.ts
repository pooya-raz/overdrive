import type { Card, GameMap } from "./types";

const STARTING_SPEED_CARDS: Card[] = [
	{ type: "speed", value: 1 },
	{ type: "speed", value: 1 },
	{ type: "speed", value: 1 },
	{ type: "speed", value: 2 },
	{ type: "speed", value: 2 },
	{ type: "speed", value: 2 },
	{ type: "speed", value: 3 },
	{ type: "speed", value: 3 },
	{ type: "speed", value: 3 },
	{ type: "speed", value: 4 },
	{ type: "speed", value: 4 },
	{ type: "speed", value: 4 },
];

const STARTING_UPGRADE_CARDS: Card[] = [
	{ type: "upgrade", value: 0 },
	{ type: "upgrade", value: 5 },
	{ type: "heat" },
];

function createStressCards(count: number): Card[] {
	return Array.from({ length: count }, () => ({ type: "stress" as const }));
}

function createHeatCards(count: number): Card[] {
	return Array.from({ length: count }, () => ({ type: "heat" as const }));
}

interface MapCardConfig {
	stressCards: number;
	heatCards: number;
}

const MAP_CARD_CONFIG: Record<GameMap, MapCardConfig> = {
	USA: {
		stressCards: 3,
		heatCards: 6,
	},
};

export function createStartingDeck(map: GameMap): Card[] {
	const config = MAP_CARD_CONFIG[map];
	return [
		...STARTING_SPEED_CARDS,
		...STARTING_UPGRADE_CARDS,
		...createStressCards(config.stressCards),
	];
}

export function createStartingEngine(map: GameMap): Card[] {
	const config = MAP_CARD_CONFIG[map];
	return createHeatCards(config.heatCards);
}
