import { Cause, Effect, Exit, Option } from "effect";

/** Runs a synchronous effect and returns its success value. */
export const run = <A, E>(eff: Effect.Effect<A, E>): A => Effect.runSync(eff);

/** Runs a synchronous effect expected to fail; returns the typed error. */
export const runFail = <A, E>(eff: Effect.Effect<A, E>): E => {
	const exit = Effect.runSyncExit(eff);
	if (Exit.isSuccess(exit)) throw new Error("Expected effect to fail");
	return Option.getOrThrow(Cause.failureOption(exit.cause));
};
