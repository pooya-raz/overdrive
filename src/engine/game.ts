import { createStartingDeck, createStartingEngine } from "./cards";
import { Player } from "./player";
import {
	getInitialReactions,
	getNextState,
	isAutoState,
} from "./state-machine";
import { getMapTrack } from "./track";
import type {
	Action,
	CreateGameRequest,
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
	availableReactions: ("cooldown" | "boost")[];
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
		const position = -Math.floor(i / 2);
		const onRaceline = i % 2 === 0;
		players[id] = new Player({
			id,
			gear: 1,
			position,
			onRaceline,
			deck: createStartingDeck(request.map),
			hand: [],
			played: [],
			engine: createStartingEngine(request.map),
			discard: [],
			shuffle: options.shuffle,
		});
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
			availableReactions: [],
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
			availableReactions: [...this._state.availableReactions],
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
			this.enterResolutionPhase();
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
				// TODO: Apply adrenaline bonuses
				break;
			}
			case "react": {
				if (action.action === "skip") {
					break;
				}

				if (!this._state.availableReactions.includes(action.action)) {
					throw new Error(`Reaction ${action.action} not available`);
				}

				// TODO: Apply cooldown/boost based on action.action and action.amount

				this._state.availableReactions = this._state.availableReactions.filter(
					(r) => r !== action.action,
				);

				if (this._state.availableReactions.length > 0) {
					return;
				}
				break;
			}
			case "slipstream": {
				// TODO: Apply slipstream movement
				break;
			}
			case "discard": {
				player.discard(action.cardIndices);
				break;
			}
			default:
				throw new Error(`Action ${action.type} not valid in resolution phase`);
		}

		this.advanceResolutionState();
	}

	private enterResolutionPhase(): void {
		this.resetAdrenaline();
		this._state.phase = "resolution";
		this._state.turnOrder = this.getPlayersInRaceOrder().map((p) => p.id);
		this._state.currentPlayerIndex = 0;
		this._state.currentState = "revealAndMove";
		this.runAutoStates();
	}

	private advanceResolutionState(): void {
		const nextState = getNextState(this._state.currentState);

		if (nextState === null) {
			this.advanceToNextPlayer();
		} else {
			this._state.currentState = nextState;
			this.runAutoStates();
		}
	}

	private advanceToNextPlayer(): void {
		this._state.currentPlayerIndex++;

		if (this._state.currentPlayerIndex >= this._state.turnOrder.length) {
			this.endResolutionPhase();
		} else {
			this._state.currentState = "revealAndMove";
			this.runAutoStates();
		}
	}

	private endResolutionPhase(): void {
		this.assignAdrenaline();
		this._state.phase = "planning";
		this._state.currentState = "plan";
		this._state.turn += 1;
		this._state.turnOrder = [];
		this._state.currentPlayerIndex = 0;
		this._state.pendingPlayers = Object.fromEntries(
			Object.keys(this._state.players).map((id) => [id, true]),
		);
	}

	private runAutoStates(): void {
		while (isAutoState(this._state.currentState)) {
			this.executeAutoState();

			const nextState = getNextState(this._state.currentState);
			if (nextState === null) {
				this.advanceToNextPlayer();
				return;
			}
			this._state.currentState = nextState;
		}

		if (this._state.currentState === "react") {
			this._state.availableReactions = getInitialReactions();
		}
	}

	private executeAutoState(): void {
		const playerId = this._state.turnOrder[this._state.currentPlayerIndex];
		const player = this._state.players[playerId];
		const track = getMapTrack(this._state.map);

		switch (this._state.currentState) {
			case "revealAndMove": {
				const targetPosition = player.move(track);
				player.setPosition(targetPosition);
				// TODO: Proper collision resolution
				break;
			}
			case "checkCorner": {
				// Corner handling is currently in player.move()
				break;
			}
			case "replenishHand": {
				player.replenishHand();
				break;
			}
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

	private resetAdrenaline(): void {
		for (const player of Object.values(this._state.players)) {
			player.setAdrenaline(false);
		}
	}

	private assignAdrenaline(): void {
		const raceOrder = this.getPlayersInRaceOrder();
		const adrenalineSlots = raceOrder.length >= 5 ? 2 : 1;

		for (let i = 0; i < adrenalineSlots; i++) {
			const player = raceOrder[raceOrder.length - 1 - i];
			player.setAdrenaline(true);
		}
	}
}
