import { describe, expect, it } from "vitest";
import {
	CannotDiscardError,
	InvalidCardIndexError,
	InvalidGearShiftError,
	NotYourTurnError,
} from "./errors";

describe("tagged errors", () => {
	it("carries a stable _tag", () => {
		expect(new InvalidGearShiftError()._tag).toBe("InvalidGearShift");
		expect(new NotYourTurnError()._tag).toBe("NotYourTurn");
	});

	it("renders the original message string", () => {
		expect(new InvalidCardIndexError({ index: 4 }).message).toBe(
			"Invalid card index: 4",
		);
		expect(new CannotDiscardError({ cardType: "heat" }).message).toBe(
			"Cannot discard heat cards",
		);
	});
});
