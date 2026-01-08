import { useState } from "react";
import { NicknameScreen } from "@/components/NicknameScreen";
import { LobbyScreen } from "@/components/LobbyScreen";
import { RoomScreen } from "@/components/RoomScreen";

type AppScreen =
	| { type: "nickname" }
	| { type: "lobby" }
	| { type: "room"; roomId: string; roomName: string };

const ROOM_STORAGE_KEY = "heat-current-room";

function getInitialScreen(): AppScreen {
	const savedNickname = localStorage.getItem("heat-nickname");
	if (!savedNickname) {
		return { type: "nickname" };
	}

	// Check if we were in a room (for rejoin after refresh)
	const savedRoom = localStorage.getItem(ROOM_STORAGE_KEY);
	if (savedRoom) {
		try {
			const { roomId, roomName } = JSON.parse(savedRoom);
			if (roomId && roomName) {
				return { type: "room", roomId, roomName };
			}
		} catch {
			localStorage.removeItem(ROOM_STORAGE_KEY);
		}
	}

	return { type: "lobby" };
}

function App() {
	const [screen, setScreen] = useState<AppScreen>(getInitialScreen);
	const [nickname, setNickname] = useState(() =>
		localStorage.getItem("heat-nickname") || "",
	);

	const handleNicknameSubmit = (name: string) => {
		setNickname(name);
		localStorage.setItem("heat-nickname", name);
		setScreen({ type: "lobby" });
	};

	const handleJoinRoom = (roomId: string, roomName: string) => {
		localStorage.setItem(ROOM_STORAGE_KEY, JSON.stringify({ roomId, roomName }));
		setScreen({ type: "room", roomId, roomName });
	};

	const handleLeaveRoom = () => {
		localStorage.removeItem(ROOM_STORAGE_KEY);
		setScreen({ type: "lobby" });
	};

	const handleChangeNickname = () => {
		setScreen({ type: "nickname" });
	};

	if (screen.type === "nickname" || !nickname) {
		return (
			<NicknameScreen onSubmit={handleNicknameSubmit} initialValue={nickname} />
		);
	}

	if (screen.type === "lobby") {
		return (
			<LobbyScreen
				nickname={nickname}
				onJoinRoom={handleJoinRoom}
				onChangeNickname={handleChangeNickname}
			/>
		);
	}

	if (screen.type === "room") {
		return (
			<RoomScreen
				roomId={screen.roomId}
				roomName={screen.roomName}
				nickname={nickname}
				onLeave={handleLeaveRoom}
			/>
		);
	}

	return null;
}

export default App;
