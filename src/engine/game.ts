import { Player } from "./player";
import { getMapTrack } from "./track";
import type {
	Action,
	CreateGameRequest,
	Done,
	GameMap,
	GameOptions,
	GameState,
	PlayerData,
	ShuffleFn,
	TurnState,
} from "./types";

export { Player };
export type { PlayerData, ShuffleFn };
export type {
	Action,
	Card,
	CardType,
	Corner,
	CreateGameRequest,
	GameMap,
	GameOptions,
	GamePhase,
	GameState,
	Gear,
	ReactChoice,
	Track,
	TurnState,
} from "./types";

interface InternalGameState {
	map: GameMap;
	players: Record<string, Player>;
	turn: number;
	phase: "planning" | "resolution";
	currentState: TurnState;
	pendingPlayers: Record<string, boolean>;
	turnOrder: string[];
	currentPlayerIndex: number;
	adrenalineSlots: number;
}

function createPlayers(
	request: CreateGameRequest,
	options: GameOptions = {},
): Record<string, Player> {
	if (new Set(request.playerIds).size !== request.playerIds.length) {
		throw new Error("Player IDs must be unique");
	}
	const players: Record<string, Player> = {};
	for (let i = 0; i < request.playerIds.length; i++) {
		const id = request.playerIds[i];
		const builder = Player.builder()
			.id(id)
			.position(-Math.floor(i / 2))
			.onRaceline(i % 2 === 0)
			.map(request.map);
		if (options.shuffle) {
			builder.shuffle(options.shuffle);
		}
		players[id] = builder.build();
	}
	return players;
}

export class Game {
	private _state: InternalGameState;

	constructor(request: CreateGameRequest, options: GameOptions = {}) {
		const players = createPlayers(request, options);
		for (const player of Object.values(players)) {
			player.draw();
		}
		const adrenalineSlots = request.playerIds.length >= 5 ? 2 : 1;
		this._state = {
			map: request.map,
			players,
			turn: 1,
			phase: "planning",
			currentState: "plan",
			pendingPlayers: Object.fromEntries(
				Object.keys(players).map((id) => [id, true]),
			),
			turnOrder: [],
			currentPlayerIndex: 0,
			adrenalineSlots,
		};
	}

	get state(): GameState {
		return {
			map: this._state.map,
			players: Object.fromEntries(
				Object.entries(this._state.players).map(([id, player]) => [
					id,
					player.state,
				]),
			),
			turn: this._state.turn,
			phase: this._state.phase,
			currentState: this._state.currentState,
			pendingPlayers: { ...this._state.pendingPlayers },
			turnOrder: [...this._state.turnOrder],
			currentPlayerIndex: this._state.currentPlayerIndex,
		};
	}

	dispatch(playerId: string, action: Action): void {
		if (action.type !== this._state.currentState) {
			throw new Error(`Invalid action for state ${this._state.currentState}`);
		}

		const player = this._state.players[playerId];
		if (!player) {
			throw new Error("Player not found");
		}

		if (this._state.phase === "planning") {
			this.handlePlanningAction(playerId, player, action);
		} else {
			this.handleResolutionAction(playerId, player, action);
		}
	}

	private handlePlanningAction(
		playerId: string,
		player: Player,
		action: Action,
	): void {
		if (!this._state.pendingPlayers[playerId]) {
			throw new Error("Player has already acted this state");
		}

		if (action.type !== "plan") {
			throw new Error(`Action ${action.type} not valid in planning phase`);
		}

		player.shiftGears(action.gear);
		player.playCards(action.cardIndices);

		this._state.pendingPlayers[playerId] = false;

		const allActed = Object.values(this._state.pendingPlayers).every((v) => !v);
		if (allActed) {
			this._state.phase = "resolution";
			this._state.turnOrder = this.getPlayersInRaceOrder().map((p) => p.id);
			this._state.currentPlayerIndex = 0;
			this.revealAndMove();
		}
	}

	private handleResolutionAction(
		playerId: string,
		player: Player,
		action: Action,
	): void {
		const currentPlayerId =
			this._state.turnOrder[this._state.currentPlayerIndex];
		if (playerId !== currentPlayerId) {
			throw new Error("Not your turn");
		}

		switch (action.type) {
			case "adrenaline": {
				player.applyAdrenaline(action.acceptMove, action.acceptCooldown);
				this._state.currentState = "react";
				break;
			}
			case "react": {
				const done: Done = player.react(action.action);
				if (done) {
					this._state.currentState = "slipstream";
				}
				break;
			}
			case "slipstream": {
				if (action.use) {
					if (!this.canSlipstream(playerId)) {
						throw new Error("Slipstream not available");
					}
					player.setPosition(player.state.position + 2);
				}
				this.checkCorners(player);
				this.resolveCollision(playerId, player);
				this._state.currentState = "discard";
				break;
			}
			case "discard": {
				player.discard(action.cardIndices);
				player.draw();
				this._state.currentPlayerIndex++;
				if (this._state.currentPlayerIndex >= this._state.turnOrder.length) {
					this.assignAdrenaline();
					this._state.phase = "planning";
					this._state.currentState = "plan";
					this._state.turn += 1;
					this._state.turnOrder = [];
					this._state.currentPlayerIndex = 0;
					this._state.pendingPlayers = Object.fromEntries(
						Object.keys(this._state.players).map((id) => [id, true]),
					);
				} else {
					this.revealAndMove();
				}
				break;
			}
			default:
				throw new Error(`Action ${action.type} not valid in resolution phase`);
		}
	}

	/** Reveals cards, moves player, then waits for adrenaline input. */
	private revealAndMove(): void {
		const player = this.getCurrentPlayer();
		player.beginResolution();
		this._state.currentState = "adrenaline";
	}

	private getCurrentPlayer(): Player {
		const playerId = this._state.turnOrder[this._state.currentPlayerIndex];
		return this._state.players[playerId];
	}

	private assignAdrenaline(): void {
		for (const p of Object.values(this._state.players)) {
			p.setAdrenaline(false);
		}
		const raceOrder = this.getPlayersInRaceOrder();
		for (let i = 0; i < this._state.adrenalineSlots; i++) {
			raceOrder[raceOrder.length - 1 - i].setAdrenaline(true);
		}
	}

	private canSlipstream(playerId: string): boolean {
		const player = this._state.players[playerId];
		const pos = player.state.position;
		return Object.values(this._state.players).some(
			(p) =>
				p.id !== playerId &&
				(p.state.position === pos || p.state.position === pos + 1),
		);
	}

	private checkCorners(player: Player): void {
		const track = getMapTrack(this._state.map);
		player.checkCorners(track.corners);
	}

	private resolveCollision(playerId: string, player: Player): void {
		let targetPosition = player.state.position;
		while (true) {
			const others = Object.values(this._state.players).filter(
				(p) => p.id !== playerId && p.state.position === targetPosition,
			);
			if (others.length === 0) {
				player.setPosition(targetPosition);
				player.setRaceline(true);
				break;
			}
			if (others.length === 1) {
				player.setPosition(targetPosition);
				player.setRaceline(!others[0].state.onRaceline);
				break;
			}
			targetPosition--;
		}
	}

	private getPlayersInRaceOrder(): Player[] {
		const players = Object.values(this._state.players);
		return [...players].sort((a, b) => {
			const positionDiff = b.state.position - a.state.position;
			if (positionDiff !== 0) {
				return positionDiff;
			}
			return a.state.onRaceline ? -1 : 1;
		});
	}
}
