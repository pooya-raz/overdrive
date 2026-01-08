import { describe, expect, it } from "vitest";
import { GameRoom } from "./game-room";

const VISITOR_1 = "visitor-1";
const VISITOR_2 = "visitor-2";
const VISITOR_3 = "visitor-3";
const VISITOR_4 = "visitor-4";
const VISITOR_5 = "visitor-5";
const VISITOR_6 = "visitor-6";
const VISITOR_7 = "visitor-7";

function createRoom(roomId = "room-1", roomName = "Test Room"): GameRoom {
	return new GameRoom(roomId, roomName);
}

function joinPlayer(room: GameRoom, visitorId: string, nickname: string) {
	room.connect(visitorId);
	return room.handleMessage(visitorId, { type: "join", nickname });
}

function getRoomState(result: { broadcast?: object }) {
	const broadcast = result.broadcast as { type: string; state?: object };
	return broadcast?.type === "roomState"
		? (broadcast.state as {
				hostId: string;
				players: { id: string; nickname: string; isHost: boolean }[];
				status: string;
			})
		: null;
}

describe("GameRoom", () => {
	describe("player management", () => {
		it("should make first player the host", () => {
			const room = createRoom();

			const result = joinPlayer(room, VISITOR_1, "Alice");
			const state = getRoomState(result);

			expect(state?.hostId).toBe(VISITOR_1);
			expect(state?.players[0].isHost).toBe(true);
		});

		it("should allow multiple players to join", () => {
			const room = createRoom();

			joinPlayer(room, VISITOR_1, "Alice");
			const result = joinPlayer(room, VISITOR_2, "Bob");
			const state = getRoomState(result);

			expect(state?.players).toHaveLength(2);
		});

		it("should reject join when room is full (6 players)", () => {
			const room = createRoom();

			joinPlayer(room, VISITOR_1, "P1");
			joinPlayer(room, VISITOR_2, "P2");
			joinPlayer(room, VISITOR_3, "P3");
			joinPlayer(room, VISITOR_4, "P4");
			joinPlayer(room, VISITOR_5, "P5");
			const result6 = joinPlayer(room, VISITOR_6, "P6");
			const state6 = getRoomState(result6);

			expect(state6?.players).toHaveLength(6);

			room.connect(VISITOR_7);
			const result7 = room.handleMessage(VISITOR_7, {
				type: "join",
				nickname: "P7",
			});

			expect(result7.toVisitor).toEqual({
				visitorId: VISITOR_7,
				messages: [{ type: "error", message: "Room is full" }],
			});
		});

		it("should return broadcast effect when player joins", () => {
			const room = createRoom();

			const result = joinPlayer(room, VISITOR_1, "Alice");

			expect(result.broadcast).toBeDefined();
			expect(result.toLobby).toBeDefined();
		});

		it("should remove player on leave", () => {
			const room = createRoom();

			joinPlayer(room, VISITOR_1, "Alice");
			joinPlayer(room, VISITOR_2, "Bob");

			const result = room.handleMessage(VISITOR_2, { type: "leave" });
			const state = getRoomState(result);

			expect(state?.players).toHaveLength(1);
			expect(result.closeConnection).toBe(VISITOR_2);
		});
	});

	describe("host reassignment", () => {
		it("should reassign host when host leaves", () => {
			const room = createRoom();

			joinPlayer(room, VISITOR_1, "Alice");
			joinPlayer(room, VISITOR_2, "Bob");

			const result = room.handleMessage(VISITOR_1, { type: "leave" });
			const state = getRoomState(result);

			expect(state?.hostId).toBe(VISITOR_2);
			expect(state?.players[0].isHost).toBe(true);
		});

		it("should clear host when last player leaves", () => {
			const room = createRoom();

			joinPlayer(room, VISITOR_1, "Alice");

			const result = room.handleMessage(VISITOR_1, { type: "leave" });
			const state = getRoomState(result);

			expect(state?.hostId).toBe("");
			expect(state?.players).toHaveLength(0);
		});

		it("should reassign host when host disconnects during waiting", () => {
			const room = createRoom();

			joinPlayer(room, VISITOR_1, "Alice");
			joinPlayer(room, VISITOR_2, "Bob");

			const result = room.handleDisconnect(VISITOR_1);
			const state = getRoomState(result);

			expect(state?.hostId).toBe(VISITOR_2);
		});
	});

	describe("game lifecycle", () => {
		it("should allow host to start game with 2+ players", () => {
			const room = createRoom();

			joinPlayer(room, VISITOR_1, "Alice");
			joinPlayer(room, VISITOR_2, "Bob");

			const result = room.handleMessage(VISITOR_1, { type: "startGame" });

			expect(result.broadcast).toEqual({ type: "gameStarted" });
			expect(result.gameStates).toBeDefined();
			expect(result.gameStates?.size).toBe(2);
		});

		it("should reject non-host starting game", () => {
			const room = createRoom();

			joinPlayer(room, VISITOR_1, "Alice");
			joinPlayer(room, VISITOR_2, "Bob");

			const result = room.handleMessage(VISITOR_2, { type: "startGame" });

			expect(result.toVisitor).toEqual({
				visitorId: VISITOR_2,
				messages: [{ type: "error", message: "Only host can start the game" }],
			});
		});

		it("should reject starting with less than 2 players", () => {
			const room = createRoom();

			joinPlayer(room, VISITOR_1, "Alice");

			const result = room.handleMessage(VISITOR_1, { type: "startGame" });

			expect(result.toVisitor).toEqual({
				visitorId: VISITOR_1,
				messages: [
					{ type: "error", message: "Need at least 2 players to start" },
				],
			});
		});

		it("should return to waiting on quit game", () => {
			const room = createRoom();

			joinPlayer(room, VISITOR_1, "Alice");
			joinPlayer(room, VISITOR_2, "Bob");
			room.handleMessage(VISITOR_1, { type: "startGame" });

			const result = room.handleMessage(VISITOR_1, { type: "quitGame" });
			const state = getRoomState(result);

			expect(state?.status).toBe("waiting");
		});
	});

	describe("game actions", () => {
		it("should dispatch action to game", () => {
			const room = createRoom();

			joinPlayer(room, VISITOR_1, "Alice");
			joinPlayer(room, VISITOR_2, "Bob");
			room.handleMessage(VISITOR_1, { type: "startGame" });

			const result = room.handleMessage(VISITOR_1, {
				type: "action",
				action: { type: "plan", gear: 1, cardIndices: [0] },
			});

			expect(result.gameStates).toBeDefined();
			expect(result.gameStates?.size).toBeGreaterThan(0);
		});

		it("should reject action when game not started", () => {
			const room = createRoom();

			joinPlayer(room, VISITOR_1, "Alice");
			joinPlayer(room, VISITOR_2, "Bob");

			const result = room.handleMessage(VISITOR_1, {
				type: "action",
				action: { type: "plan", gear: 1, cardIndices: [0] },
			});

			expect(result.toVisitor).toEqual({
				visitorId: VISITOR_1,
				messages: [{ type: "error", message: "Game not started" }],
			});
		});

		it("should reject action from non-player", () => {
			const room = createRoom();

			joinPlayer(room, VISITOR_1, "Alice");
			joinPlayer(room, VISITOR_2, "Bob");
			room.handleMessage(VISITOR_1, { type: "startGame" });

			room.connect(VISITOR_3);
			const result = room.handleMessage(VISITOR_3, {
				type: "action",
				action: { type: "plan", gear: 1, cardIndices: [0] },
			});

			expect(result.toVisitor).toEqual({
				visitorId: VISITOR_3,
				messages: [{ type: "error", message: "Not in this room" }],
			});
		});

		it("should return game errors via RoomResult instead of throwing", () => {
			const room = createRoom();

			joinPlayer(room, VISITOR_1, "Alice");
			joinPlayer(room, VISITOR_2, "Bob");
			room.handleMessage(VISITOR_1, { type: "startGame" });

			// Invalid card index should return error, not throw
			const result = room.handleMessage(VISITOR_1, {
				type: "action",
				action: { type: "plan", gear: 1, cardIndices: [99] },
			});

			expect(result.toVisitor?.visitorId).toBe(VISITOR_1);
			expect(result.toVisitor?.messages[0]).toMatchObject({
				type: "error",
				message: expect.stringContaining("Invalid card index"),
			});
			expect(result.gameStates).toBeUndefined();
		});
	});

	describe("rejoin during game", () => {
		it("should allow rejoin by nickname during game", () => {
			const room = createRoom();

			joinPlayer(room, VISITOR_1, "Alice");
			joinPlayer(room, VISITOR_2, "Bob");
			room.handleMessage(VISITOR_1, { type: "startGame" });

			room.handleDisconnect(VISITOR_2);

			const NEW_VISITOR = "new-visitor";
			room.connect(NEW_VISITOR);
			const result = room.handleMessage(NEW_VISITOR, {
				type: "join",
				nickname: "Bob",
			});

			expect(result.toVisitor?.visitorId).toBe(NEW_VISITOR);
			expect(result.toVisitor?.messages).toHaveLength(3);
			expect(result.toVisitor?.messages[0]).toMatchObject({
				type: "roomState",
			});
			expect(result.toVisitor?.messages[1]).toEqual({ type: "gameStarted" });
			expect(result.toVisitor?.messages[2]).toMatchObject({ type: "state" });
		});

		it("should reject new player during game", () => {
			const room = createRoom();

			joinPlayer(room, VISITOR_1, "Alice");
			joinPlayer(room, VISITOR_2, "Bob");
			room.handleMessage(VISITOR_1, { type: "startGame" });

			room.connect(VISITOR_3);
			const result = room.handleMessage(VISITOR_3, {
				type: "join",
				nickname: "Charlie",
			});

			expect(result.toVisitor).toEqual({
				visitorId: VISITOR_3,
				messages: [{ type: "error", message: "Game already started" }],
			});
		});

		it("should not remove player on disconnect during game", () => {
			const room = createRoom();

			joinPlayer(room, VISITOR_1, "Alice");
			joinPlayer(room, VISITOR_2, "Bob");
			room.handleMessage(VISITOR_1, { type: "startGame" });

			// Disconnect should return empty result (no broadcast of player removal)
			const result = room.handleDisconnect(VISITOR_2);

			expect(result.broadcast).toBeUndefined();
		});
	});

	describe("room info", () => {
		it("should return correct room info in toLobby", () => {
			const room = createRoom("room-123", "My Room");

			joinPlayer(room, VISITOR_1, "Alice");
			const result = joinPlayer(room, VISITOR_2, "Bob");

			expect(result.toLobby).toEqual({
				id: "room-123",
				name: "My Room",
				hostNickname: "Alice",
				playerCount: 2,
				maxPlayers: 6,
				status: "waiting",
			});
		});

		it("should update status in room info when game starts", () => {
			const room = createRoom();

			joinPlayer(room, VISITOR_1, "Alice");
			joinPlayer(room, VISITOR_2, "Bob");
			const result = room.handleMessage(VISITOR_1, { type: "startGame" });

			expect(result.toLobby?.status).toBe("playing");
		});
	});
});
