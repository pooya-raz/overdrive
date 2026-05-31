import { Data } from "effect";
import type { ReactChoice, TurnState } from "./types";

// ── Player-level domain failures ──────────────────────────────────────────

export class DeckExhaustedError extends Data.TaggedError("DeckExhausted")<
	Record<never, never>
> {
	get message() {
		return "No cards left to draw (deck and discard empty).";
	}
}

export class InvalidGearShiftError extends Data.TaggedError("InvalidGearShift")<
	Record<never, never>
> {
	get message() {
		return "Can only shift up or down by max 2 gears";
	}
}

export class HeatRequiredError extends Data.TaggedError("HeatRequired")<
	Record<never, never>
> {
	get message() {
		return "Heat card required to shift by 2 gears";
	}
}

export class InvalidCardIndexError extends Data.TaggedError(
	"InvalidCardIndex",
)<{ index: number }> {
	get message() {
		return `Invalid card index: ${this.index}`;
	}
}

export class CannotDiscardError extends Data.TaggedError("CannotDiscard")<{
	cardType: "heat" | "stress";
}> {
	get message() {
		return `Cannot discard ${this.cardType} cards`;
	}
}

export class InvalidCardCountError extends Data.TaggedError(
	"InvalidCardCount",
)<{ expected: number }> {
	get message() {
		return `Must play exactly ${this.expected} cards`;
	}
}

export class ReactionUnavailableError extends Data.TaggedError(
	"ReactionUnavailable",
)<{ reaction: ReactChoice }> {
	get message() {
		return `Reaction ${this.reaction} not available`;
	}
}

export class NoHeatToBoostError extends Data.TaggedError("NoHeatToBoost")<
	Record<never, never>
> {
	get message() {
		return "No heat available to boost";
	}
}

export type PlayerError =
	| DeckExhaustedError
	| InvalidGearShiftError
	| HeatRequiredError
	| InvalidCardIndexError
	| CannotDiscardError
	| InvalidCardCountError
	| ReactionUnavailableError
	| NoHeatToBoostError;

// ── Game/dispatch-level domain failures ───────────────────────────────────

export class WrongStateError extends Data.TaggedError("WrongState")<{
	currentState: TurnState;
	attempted: string;
}> {
	get message() {
		return `Invalid action for state ${this.currentState}`;
	}
}

export class PlayerNotFoundError extends Data.TaggedError("PlayerNotFound")<{
	playerId: string;
}> {
	get message() {
		return "Player not found";
	}
}

export class AlreadyActedError extends Data.TaggedError("AlreadyActed")<
	Record<never, never>
> {
	get message() {
		return "Player has already acted this state";
	}
}

export class WrongPhaseActionError extends Data.TaggedError(
	"WrongPhaseAction",
)<{ phase: string; attempted: string }> {
	get message() {
		return `Action ${this.attempted} not valid in ${this.phase} phase`;
	}
}

export class NotYourTurnError extends Data.TaggedError("NotYourTurn")<
	Record<never, never>
> {
	get message() {
		return "Not your turn";
	}
}

export class SlipstreamUnavailableError extends Data.TaggedError(
	"SlipstreamUnavailable",
)<Record<never, never>> {
	get message() {
		return "Slipstream not available";
	}
}

export type DispatchError =
	| WrongStateError
	| PlayerNotFoundError
	| AlreadyActedError
	| WrongPhaseActionError
	| NotYourTurnError
	| SlipstreamUnavailableError
	| PlayerError;
