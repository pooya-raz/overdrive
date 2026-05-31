import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { InvalidGearShiftError } from "./errors";
import { run, runFail } from "./test-helpers";

describe("effect test helpers", () => {
	it("run returns the success value", () => {
		expect(run(Effect.succeed(42))).toBe(42);
	});

	it("runFail returns the typed error", () => {
		const err = runFail(Effect.fail(new InvalidGearShiftError()));
		expect(err._tag).toBe("InvalidGearShift");
	});

	it("runFail throws when the effect succeeds", () => {
		expect(() => runFail(Effect.succeed(1))).toThrow("Expected effect to fail");
	});
});
