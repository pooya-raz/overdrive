import { describe, expect, it } from "vitest";
import { type CreateGameRequest, Game, type GameState } from "./game-engine";

describe("Game", () => {
	describe("initialization", () => {
		it("should create a game with players on turn 1", () => {
			const request: CreateGameRequest = {
				playerIds: [
					"550e8400-e29b-41d4-a716-446655440001",
					"550e8400-e29b-41d4-a716-446655440002",
				],
			};

			const game = new Game(request);

			const expectedState: GameState = {
				players: [
					{ id: "550e8400-e29b-41d4-a716-446655440001", gear: 1 },
					{ id: "550e8400-e29b-41d4-a716-446655440002", gear: 1 },
				],
				turn: 1,
			};
			expect(game.state).toEqual(expectedState);
		});

		it("should reject duplicate player UUIDs", () => {
			const request: CreateGameRequest = {
				playerIds: [
					"550e8400-e29b-41d4-a716-446655440001",
					"550e8400-e29b-41d4-a716-446655440001",
				],
			};

			expect(() => new Game(request)).toThrow("Player IDs must be unique");
		});
	});
});
