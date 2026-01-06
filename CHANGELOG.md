# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2025-01-06

### Added

- **Slipstream**: After reacting, players adjacent to another car (same position or 1 behind) may draft +2 spaces. Does not count toward corner speed.
- **Adrenaline bonuses**: Trailing players can accept +1 move (counts toward corner penalties) and/or +1 cooldown reaction.
- **Corner checking phase**: Separate phase for checking corner speed limits and paying heat penalties.
- **React phase**: Players can use cooldown (move heat from hand to engine) or skip reactions.
- **Spin out**: When unable to pay full heat penalty at a corner, player stops before the corner, gear resets to 1, and gains 1-2 stress cards based on gear.

### Changed

- **Resolution phase structure**: Now consists of 7 distinct steps: reveal & move, adrenaline, react, slipstream, check corner, check collision, discard & replenish.
- **Player encapsulation**: Per-player turn state (start position, card speed, available reactions) moved from Game to Player class.

## [0.1.0] - 2025-01-06

### Added

- **Position collision**: Maximum 2 players per track position. Third+ players cascade back to previous positions until finding space.
- **Raceline**: First player to arrive at a position gets the raceline (front). Players on the raceline go first when sharing a position.
- **Turn order**: Players are processed in race order during movement (leader first, based on position and raceline).
- **Staggered starting grid**: Players start at positions 0, 0, -1, -1, -2... with alternating raceline assignment.
- **Adrenaline**: Trailing players receive adrenaline after movement. Last place in 2-4 player games, last 2 places in 5+ player games. Resets each turn.
