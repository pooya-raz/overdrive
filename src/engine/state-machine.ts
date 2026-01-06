import type { TurnState } from "./types";

const STATE_ORDER: TurnState[] = [
	"revealAndMove",
	"adrenaline",
	"react",
	"slipstream",
	"checkCorner",
	"discard",
	"replenishHand",
];

const AUTO_STATES: TurnState[] = [
	"revealAndMove",
	"checkCorner",
	"replenishHand",
];

export function getNextState(current: TurnState): TurnState | null {
	const currentIndex = STATE_ORDER.indexOf(current);
	const nextIndex = currentIndex + 1;
	if (nextIndex >= STATE_ORDER.length) {
		return null;
	}
	return STATE_ORDER[nextIndex];
}

export function isAutoState(state: TurnState): boolean {
	return AUTO_STATES.includes(state);
}

export function getInitialReactions(): ("cooldown" | "boost")[] {
	return ["cooldown", "boost"];
}
