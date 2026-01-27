import { useState, useEffect, useRef } from "react";
import type { PlayerData } from "@overdrive/shared";
import { playerColors } from "@/data/player-colors";
import type { MapConfig } from "@/data/maps";

interface TrackMapProps {
  players: Record<string, PlayerData>;
  playerOrder: string[];
  trackLength: number;
  mapConfig: MapConfig;
}

interface TooltipState {
  player: PlayerData;
  x: number;
  y: number;
}

const MARKER_RADIUS = 8;
const RACELINE_OFFSET_Y = 8;
const STEP_DURATION_MS = 100;

export function TrackMap({ players, playerOrder, trackLength, mapConfig }: TrackMapProps) {
  if (mapConfig.width === 0 || mapConfig.height === 0 || mapConfig.waypoints.length === 0) {
    return (
      <div className="w-full max-w-3xl mx-auto bg-slate-800 rounded-lg p-6 text-center text-red-400">
        Map data is not available for this track.
      </div>
    );
  }

  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [displayPositions, setDisplayPositions] = useState<Record<string, number>>({});
  const animationRefs = useRef<Record<string, number>>({});

  // Animate display positions toward actual positions
  useEffect(() => {
    const playerList = Object.values(players);

    for (const player of playerList) {
      const currentDisplay = displayPositions[player.id];
      const target = player.position;

      // Initialize display position if not set
      if (currentDisplay === undefined) {
        setDisplayPositions((prev) => ({ ...prev, [player.id]: target }));
        continue;
      }

      // Already at target
      if (currentDisplay === target) {
        continue;
      }

      // Clear any existing animation for this player
      if (animationRefs.current[player.id]) {
        clearTimeout(animationRefs.current[player.id]);
      }

      // Animate one step toward target
      const step = currentDisplay < target ? 1 : -1;
      animationRefs.current[player.id] = window.setTimeout(() => {
        setDisplayPositions((prev) => ({
          ...prev,
          [player.id]: (prev[player.id] ?? currentDisplay) + step,
        }));
      }, STEP_DURATION_MS);
    }

    return () => {
      // Cleanup timeouts on unmount
      for (const timeoutId of Object.values(animationRefs.current)) {
        clearTimeout(timeoutId);
      }
    };
  }, [players, displayPositions]);

  const getPlayerColor = (playerId: string): string => {
    const index = playerOrder.indexOf(playerId);
    return playerColors[index % playerColors.length] ?? "#888888";
  };

  const getMarkerPosition = (
    playerId: string,
    displayPosition: number,
    onRaceline: boolean,
    allDisplayPositions: Record<string, number>,
    allPlayers: PlayerData[]
  ): { x: number; y: number } | null => {
    const positionOnTrack = (((displayPosition + mapConfig.startOffset) % trackLength) + trackLength) % trackLength;
    const waypoint = mapConfig.waypoints[positionOnTrack];
    if (!waypoint) {
      return null;
    }

    // Check if others are at the same display position
    const othersAtSamePosition = allPlayers.some((p) => {
      if (p.id === playerId) return false;
      const otherDisplay = allDisplayPositions[p.id];
      return otherDisplay !== undefined && otherDisplay === displayPosition;
    });

    const yOffset = othersAtSamePosition
      ? (onRaceline ? -RACELINE_OFFSET_Y : RACELINE_OFFSET_Y)
      : 0;

    return {
      x: waypoint.x,
      y: waypoint.y + yOffset,
    };
  };

  const handleMouseEnter = (player: PlayerData, x: number, y: number) => {
    setTooltip({ player, x, y });
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  const playerList = Object.values(players);

  return (
    <div className="relative w-full max-w-3xl mx-auto bg-slate-800 rounded-lg overflow-hidden">
      <svg
        viewBox={`0 0 ${mapConfig.width} ${mapConfig.height}`}
        className="w-full h-auto"
      >
        {/* Background map image */}
        <image
          href={mapConfig.image}
          width={mapConfig.width}
          height={mapConfig.height}
        />

        {/* Player markers */}
        {playerList.map((player) => {
          const displayPos = displayPositions[player.id] ?? player.position;
          const pos = getMarkerPosition(
            player.id,
            displayPos,
            player.onRaceline,
            displayPositions,
            playerList
          );
          if (!pos) return null;

          return (
            <g key={player.id}>
              <circle
                cx={pos.x}
                cy={pos.y}
                r={MARKER_RADIUS}
                fill={getPlayerColor(player.id)}
                stroke="white"
                strokeWidth="2"
                className="cursor-pointer"
                onMouseEnter={() => handleMouseEnter(player, pos.x, pos.y)}
                onMouseLeave={handleMouseLeave}
              />
              {player.finished && (
                <text
                  x={pos.x}
                  y={pos.y + 4}
                  textAnchor="middle"
                  fontSize="10"
                  fill="white"
                >
                  🏁
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute bg-slate-900 text-white px-3 py-2 rounded shadow-lg text-sm pointer-events-none z-10 border border-slate-600"
          style={{
            left: `${(tooltip.x / mapConfig.width) * 100}%`,
            top: `${(tooltip.y / mapConfig.height) * 100}%`,
            transform: "translate(-50%, -120%)",
          }}
        >
          <div className="font-bold">{tooltip.player.username}</div>
          <div className="text-slate-300">
            Gear: {tooltip.player.gear} | Lap: {tooltip.player.lap}
          </div>
        </div>
      )}
    </div>
  );
}
