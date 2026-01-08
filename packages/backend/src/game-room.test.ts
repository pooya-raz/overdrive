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
	room.addConnection(visitorId);
	return room.handleJoin(visitorId, nickname);
}

describe("GameRoom", () => {
	describe("player management", () => {
		it("should make first player the host", () => {
			const room = createRoom();

			joinPlayer(room, VISITOR_1, "Alice");

			expect(room.state.hostId).toBe(VISITOR_1);
			expect(room.state.players[0].isHost).toBe(true);
		});

		it("should allow multiple players to join", () => {
			const room = createRoom();

			joinPlayer(room, VISITOR_1, "Alice");
			joinPlayer(room, VISITOR_2, "Bob");

			expect(room.playerCount).toBe(2);
			expect(room.state.players).toHaveLength(2);
		});

		it("should reject join when room is full (6 players)", () => {
			const room = createRoom();

			joinPlayer(room, VISITOR_1, "P1");
			joinPlayer(room, VISITOR_2, "P2");
			joinPlayer(room, VISITOR_3, "P3");
			joinPlayer(room, VISITOR_4, "P4");
			joinPlayer(room, VISITOR_5, "P5");
			joinPlayer(room, VISITOR_6, "P6");

			expect(room.playerCount).toBe(6);

			room.addConnection(VISITOR_7);
			const result = room.handleJoin(VISITOR_7, "P7");

			expect(room.playerCount).toBe(6);
			expect(result.toVisitor).toEqual({
				visitorId: VISITOR_7,
				messages: [{ type: "error", message: "Room is full" }],
			});
		});

		it("should return broadcast effect when player joins", () => {
			const room = createRoom();

			const result = joinPlayer(room, VISITOR_1, "Alice");

			expect(result.broadcast).toEqual({
				type: "roomState",
				state: room.state,
			});
			expect(result.toLobby).toBeDefined();
		});

		it("should remove player on leave", () => {
			const room = createRoom();

			joinPlayer(room, VISITOR_1, "Alice");
			joinPlayer(room, VISITOR_2, "Bob");

			const result = room.handleLeave(VISITOR_2);

			expect(room.playerCount).toBe(1);
			expect(result.closeConnection).toBe(VISITOR_2);
		});
	});

	describe("host reassignment", () => {
		it("should reassign host when host leaves", () => {
			const room = createRoom();

			joinPlayer(room, VISITOR_1, "Alice");
			joinPlayer(room, VISITOR_2, "Bob");

			expect(room.state.hostId).toBe(VISITOR_1);

			room.handleLeave(VISITOR_1);

			expect(room.state.hostId).toBe(VISITOR_2);
			expect(room.state.players[0].isHost).toBe(true);
		});

		it("should clear host when last player leaves", () => {
			const room = createRoom();

			joinPlayer(room, VISITOR_1, "Alice");

			room.handleLeave(VISITOR_1);

			expect(room.state.hostId).toBe("");
			expect(room.playerCount).toBe(0);
		});

		it("should reassign host when host disconnects during waiting", () => {
			const room = createRoom();

			joinPlayer(room, VISITOR_1, "Alice");
			joinPlayer(room, VISITOR_2, "Bob");

			room.handleDisconnect(VISITOR_1);

			expect(room.state.hostId).toBe(VISITOR_2);
		});
	});

	describe("game lifecycle", () => {
		it("should allow host to start game with 2+ players", () => {
			const room = createRoom();

			joinPlayer(room, VISITOR_1, "Alice");
			joinPlayer(room, VISITOR_2, "Bob");

			const result = room.handleStartGame(VISITOR_1);

			expect(room.currentStatus).toBe("playing");
			expect(room.hasGame).toBe(true);
			expect(result.broadcast).toEqual({ type: "gameStarted" });
			expect(result.broadcastGameState).toBe(true);
		});

		it("should reject non-host starting game", () => {
			const room = createRoom();

			joinPlayer(room, VISITOR_1, "Alice");
			joinPlayer(room, VISITOR_2, "Bob");

			const result = room.handleStartGame(VISITOR_2);

			expect(room.currentStatus).toBe("waiting");
			expect(result.toVisitor).toEqual({
				visitorId: VISITOR_2,
				messages: [{ type: "error", message: "Only host can start the game" }],
			});
		});

		it("should reject starting with less than 2 players", () => {
			const room = createRoom();

			joinPlayer(room, VISITOR_1, "Alice");

			const result = room.handleStartGame(VISITOR_1);

			expect(room.currentStatus).toBe("waiting");
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
			room.handleStartGame(VISITOR_1);

			expect(room.currentStatus).toBe("playing");

			const result = room.handleQuitGame();

			expect(room.currentStatus).toBe("waiting");
			expect(room.hasGame).toBe(false);
			expect(result.broadcast).toEqual({
				type: "roomState",
				state: room.state,
			});
		});
	});

	describe("game actions", () => {
		it("should dispatch action to game", () => {
			const room = createRoom();

			joinPlayer(room, VISITOR_1, "Alice");
			joinPlayer(room, VISITOR_2, "Bob");
			room.handleStartGame(VISITOR_1);

			const result = room.handleAction(VISITOR_1, {
				type: "plan",
				gear: 1,
				cardIndices: [0],
			});

			expect(room.hasGame).toBe(true);
			expect(result.broadcastGameState).toBe(true);
		});

		it("should reject action when game not started", () => {
			const room = createRoom();

			joinPlayer(room, VISITOR_1, "Alice");
			joinPlayer(room, VISITOR_2, "Bob");

			const result = room.handleAction(VISITOR_1, {
				type: "plan",
				gear: 1,
				cardIndices: [0],
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
			room.handleStartGame(VISITOR_1);

			room.addConnection(VISITOR_3);
			const result = room.handleAction(VISITOR_3, {
				type: "plan",
				gear: 1,
				cardIndices: [0],
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
			room.handleStartGame(VISITOR_1);

			// Invalid card index should return error, not throw
			const result = room.handleAction(VISITOR_1, {
				type: "plan",
				gear: 1,
				cardIndices: [99],
			});

			expect(result.toVisitor?.visitorId).toBe(VISITOR_1);
			expect(result.toVisitor?.messages[0]).toMatchObject({
				type: "error",
				message: expect.stringContaining("Invalid card index"),
			});
			expect(result.broadcastGameState).toBeUndefined();
		});
	});

	describe("rejoin during game", () => {
		it("should allow rejoin by nickname during game", () => {
			const room = createRoom();

			joinPlayer(room, VISITOR_1, "Alice");
			joinPlayer(room, VISITOR_2, "Bob");
			room.handleStartGame(VISITOR_1);

			room.handleDisconnect(VISITOR_2);

			const NEW_VISITOR = "new-visitor";
			room.addConnection(NEW_VISITOR);
			const result = room.handleJoin(NEW_VISITOR, "Bob");

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
			room.handleStartGame(VISITOR_1);

			room.addConnection(VISITOR_3);
			const result = room.handleJoin(VISITOR_3, "Charlie");

			expect(result.toVisitor).toEqual({
				visitorId: VISITOR_3,
				messages: [{ type: "error", message: "Game already started" }],
			});
		});

		it("should not remove player on disconnect during game", () => {
			const room = createRoom();

			joinPlayer(room, VISITOR_1, "Alice");
			joinPlayer(room, VISITOR_2, "Bob");
			room.handleStartGame(VISITOR_1);

			const playerCountBefore = room.playerCount;

			room.handleDisconnect(VISITOR_2);

			expect(room.playerCount).toBe(playerCountBefore);
		});
	});

	describe("room info", () => {
		it("should return correct room info", () => {
			const room = createRoom("room-123", "My Room");

			joinPlayer(room, VISITOR_1, "Alice");
			joinPlayer(room, VISITOR_2, "Bob");

			const info = room.getRoomInfo();

			expect(info.id).toBe("room-123");
			expect(info.name).toBe("My Room");
			expect(info.hostNickname).toBe("Alice");
			expect(info.playerCount).toBe(2);
			expect(info.maxPlayers).toBe(6);
			expect(info.status).toBe("waiting");
		});

		it("should update status in room info when game starts", () => {
			const room = createRoom();

			joinPlayer(room, VISITOR_1, "Alice");
			joinPlayer(room, VISITOR_2, "Bob");
			room.handleStartGame(VISITOR_1);

			const info = room.getRoomInfo();
			expect(info.status).toBe("playing");
		});
	});
});
