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
	PlayerInput,
	ReactChoice,
	Track,
	TurnState,
} from "./types";

interface InternalGameState {
	map: GameMap;
	players: Record<string, Player>;
	turn: number;
	phase: "planning" | "resolution" | "finished";
	currentState: TurnState;
	pendingPlayers: Record<string, boolean>;
	turnOrder: string[];
	currentPlayerIndex: number;
	adrenalineSlots: number;
	laps: number;
	finishOrder: string[];
	raceFinishing: boolean;
	playerOrder: string[];
}

function createPlayers(
	request: CreateGameRequest,
	options: GameOptions = {},
): Record<string, Player> {
	const { players: playerList } = request;
	if (new Set(playerList.map((p) => p.id)).size !== playerList.length) {
		throw new Error("Player IDs must be unique");
	}
	const players: Record<string, Player> = {};
	for (let i = 0; i < playerList.length; i++) {
		const { id, username } = playerList[i];
		const builder = Player.builder()
			.id(id)
			.username(username)
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
		const playerCount = Object.keys(players).length;
		const adrenalineSlots = playerCount >= 5 ? 2 : 1;
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
			laps: request.laps ?? 1,
			finishOrder: [],
			raceFinishing: false,
			playerOrder: request.players.map((p) => p.id),
		};
		this.assignAdrenaline();
	}

	get state(): GameState {
		return {
			map: this._state.map,
			track: getMapTrack(this._state.map),
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
			laps: this._state.laps,
			finishOrder: [...this._state.finishOrder],
			playerOrder: [...this._state.playerOrder],
		};
	}

	getStateForPlayer(viewerId: string): GameState {
		return {
			map: this._state.map,
			track: getMapTrack(this._state.map),
			players: Object.fromEntries(
				Object.entries(this._state.players).map(([id, player]) => {
					const playerState = player.state;
					if (id !== viewerId) {
						playerState.hand = playerState.hand.map((card) => ({
							type: card.type,
						}));
					}
					return [id, playerState];
				}),
			),
			turn: this._state.turn,
			phase: this._state.phase,
			currentState: this._state.currentState,
			pendingPlayers: { ...this._state.pendingPlayers },
			turnOrder: [...this._state.turnOrder],
			currentPlayerIndex: this._state.currentPlayerIndex,
			laps: this._state.laps,
			finishOrder: [...this._state.finishOrder],
			playerOrder: [...this._state.playerOrder],
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
			case "move": {
				player.confirmMove();
				if (player.state.hasAdrenaline) {
					this._state.currentState = "adrenaline";
				} else {
					this.enterReactOrSkip(playerId, player);
				}
				break;
			}
			case "adrenaline": {
				player.applyAdrenaline(action.acceptMove, action.acceptCooldown);
				this.enterReactOrSkip(playerId, player);
				break;
			}
			case "react": {
				const done: Done = player.react(action.action);
				if (done) {
					if (this.canSlipstream(playerId)) {
						this._state.currentState = "slipstream";
					} else {
						this.finishMovement(playerId, player);
					}
				}
				break;
			}
			case "slipstream": {
				player.recordSlipstream(action.use);
				if (action.use) {
					if (!this.canSlipstream(playerId)) {
						throw new Error("Slipstream not available");
					}
					player.setPosition(player.state.position + 2);
				}
				this.finishMovement(playerId, player);
				break;
			}
			case "discard": {
				player.discard(action.cardIndices);
				player.draw();
				player.resetCooldowns();
				this._state.currentPlayerIndex++;

				if (this._state.currentPlayerIndex < this._state.turnOrder.length) {
					this.revealAndMove();
					break;
				}

				if (this._state.raceFinishing) {
					this.finalizeRace();
					return;
				}

				this.assignAdrenaline();
				for (const p of Object.values(this._state.players)) {
					p.clearTurnActions();
				}
				this._state.phase = "planning";
				this._state.currentState = "plan";
				this._state.turn += 1;
				this._state.turnOrder = [];
				this._state.currentPlayerIndex = 0;
				this._state.pendingPlayers = Object.fromEntries(
					Object.keys(this._state.players).map((id) => [id, true]),
				);
				break;
			}
			default:
				throw new Error(`Action ${action.type} not valid in resolution phase`);
		}
	}

	/** Reveals cards and moves player, then waits for acknowledgment. */
	private revealAndMove(): void {
		const playerId = this._state.turnOrder[this._state.currentPlayerIndex];
		const player = this._state.players[playerId];
		player.beginResolution();
		this._state.currentState = "move";
	}

	/** Sets state to react, or skips to next phase if no viable reactions. */
	private enterReactOrSkip(playerId: string, player: Player): void {
		if (player.hasViableReactions()) {
			this._state.currentState = "react";
		} else if (this.canSlipstream(playerId)) {
			this._state.currentState = "slipstream";
		} else {
			this.finishMovement(playerId, player);
		}
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

	private finishMovement(playerId: string, player: Player): void {
		this.resolveCollision(playerId, player);
		this.checkCorners(player);

		const track = getMapTrack(this._state.map);
		if (player.updateRaceProgress(track.length, this._state.laps)) {
			this._state.finishOrder.push(playerId);
			this._state.raceFinishing = true;
		}

		this._state.currentState = "discard";
	}

	private checkCorners(player: Player): void {
		const track = getMapTrack(this._state.map);
		player.checkCorners(track.corners);
	}

	private resolveCollision(playerId: string, player: Player): void {
		const otherPlayers = Object.values(this._state.players)
			.filter((p) => p.id !== playerId)
			.map((p) => ({
				position: p.state.position,
				onRaceline: p.state.onRaceline,
			}));
		player.resolveCollision(otherPlayers);
	}

	private finalizeRace(): void {
		this._state.finishOrder.sort(
			(a, b) =>
				this._state.players[b].state.position -
				this._state.players[a].state.position,
		);
		this._state.phase = "finished";
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
