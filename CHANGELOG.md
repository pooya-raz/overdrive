# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2025-01-06

### Added

- **Position collision**: Maximum 2 players per track position. Third+ players cascade back to previous positions until finding space.
- **Raceline**: First player to arrive at a position gets the raceline (front). Players on the raceline go first when sharing a position.
- **Turn order**: Players are processed in race order during movement (leader first, based on position and raceline).
- **Staggered starting grid**: Players start at positions 0, 0, -1, -1, -2... with alternating raceline assignment.
- **Adrenaline**: Trailing players receive adrenaline after movement. Last place in 2-4 player games, last 2 places in 5+ player games. Resets each turn.
