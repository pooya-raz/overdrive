import { test, expect, Page, BrowserContext } from '@playwright/test';

async function setupPlayer(context: BrowserContext, username: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto('/');
  await page.getByPlaceholder('Enter your username').fill(username);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Heat - Lobby')).toBeVisible();
  return page;
}

async function planTurn(page: Page, playerName: string) {
  await test.step(`${playerName}: Plan turn`, async () => {
    // Wait for planning phase
    await expect(page.getByText('Planning Phase')).toBeVisible();

    // Select gear 1 (always valid, needs only 1 card)
    await page.locator('text=Gear:').locator('..').getByRole('button', { name: '1' }).click();

    // Select first enabled card (heat cards are disabled)
    await page.locator('.grid-cols-7').locator('button:enabled').first().click();

    // Confirm plan
    await page.getByRole('button', { name: 'Confirm Plan' }).click();
  });
}

async function resolvePlayerPhases(page: Page, playerName: string): Promise<'done' | 'finished'> {
  // Complete all resolution phases for this player in order
  return await test.step(`${playerName}: Resolve`, async () => {
    // Move acknowledgment phase
    if (await page.getByRole('button', { name: 'Move', exact: true }).isVisible({ timeout: 500 }).catch(() => false)) {
      await page.getByRole('button', { name: 'Move', exact: true }).click();
    }

    // Adrenaline phase (only if in last place)
    if (await page.getByText('Adrenaline').first().isVisible({ timeout: 500 }).catch(() => false)) {
      await page.getByRole('button', { name: 'Skip' }).click();
    }

    // React phase (may loop multiple times)
    while (await page.getByText('React').first().isVisible({ timeout: 500 }).catch(() => false)) {
      await page.getByRole('button', { name: 'Skip' }).click();
    }

    // Slipstream phase
    if (await page.getByText('Slipstream').first().isVisible({ timeout: 500 }).catch(() => false)) {
      await page.getByRole('button', { name: 'Skip' }).click();
    }

    // Discard phase - may not happen if game finished
    try {
      await page.getByRole('button', { name: 'Skip Discard' }).click({ timeout: 500 });
      return 'done';
    } catch {
      // Button not available, continue to check if game finished
    }

    // Check if game finished (no discard because race ended)
    if (await page.getByText('Race Finished!').isVisible({ timeout: 500 }).catch(() => false)) {
      return 'finished';
    }

    return 'done';
  });
}

async function isPlayersTurn(page: Page): Promise<boolean> {
  // Check if this player has an action (any resolution phase visible)
  // Use short timeouts for quick polling
  // Check for move acknowledgment
  if (await page.getByRole('button', { name: 'Move', exact: true }).isVisible({ timeout: 50 }).catch(() => false)) {
    return true;
  }
  const phases = ['Adrenaline', 'React', 'Slipstream'];
  for (const phase of phases) {
    if (await page.getByText(phase).first().isVisible({ timeout: 50 }).catch(() => false)) {
      return true;
    }
  }
  // Check for discard phase via button (not text, since "Discard" appears in deck info)
  if (await page.getByRole('button', { name: 'Skip Discard' }).isVisible({ timeout: 50 }).catch(() => false)) {
    return true;
  }
  return false;
}

async function resolveAllPhases(playerA: Page, playerB: Page): Promise<'finished' | 'planning'> {
  while (true) {
    // Check if game finished
    if (await playerA.getByText('Race Finished!').isVisible({ timeout: 200 }).catch(() => false)) {
      return 'finished';
    }

    // Check if both players are back to planning
    const aInPlanning = await playerA.getByText('Planning Phase').isVisible({ timeout: 200 }).catch(() => false);
    const bInPlanning = await playerB.getByText('Planning Phase').isVisible({ timeout: 200 }).catch(() => false);

    if (aInPlanning && bInPlanning) {
      return 'planning';
    }

    // Find which player's turn it is and resolve all their phases
    if (await isPlayersTurn(playerA)) {
      const result = await resolvePlayerPhases(playerA, 'Alice');
      if (result === 'finished') return 'finished';
    } else if (await isPlayersTurn(playerB)) {
      const result = await resolvePlayerPhases(playerB, 'Bob');
      if (result === 'finished') return 'finished';
    } else {
      // Neither player has an action yet, wait a bit
      await playerA.waitForTimeout(100);
    }
  }
}

test('two players can play a complete game', async ({ browser }) => {
  test.setTimeout(180000); // 3 minute timeout for full game

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const roomName = `Game ${crypto.randomUUID()}`;

  // Setup players and create room
  const playerA = await setupPlayer(contextA, 'Alice');
  await playerA.getByPlaceholder('Room name').fill(roomName);
  await playerA.getByRole('button', { name: 'Create' }).click();
  await expect(playerA.getByText('Players (1/6)')).toBeVisible();

  const playerB = await setupPlayer(contextB, 'Bob');
  await playerB.locator('li').filter({ hasText: roomName }).getByRole('button', { name: 'Join' }).click();
  await expect(playerB.getByText('Players (2/6)')).toBeVisible();

  // Start game
  await playerA.getByRole('button', { name: 'Start Game' }).click();
  await expect(playerA.getByText('Planning Phase')).toBeVisible();
  await expect(playerB.getByText('Planning Phase')).toBeVisible();

  // Play until game finishes
  let turnCount = 0;
  const maxTurns = 100; // Track has finite length, should finish

  gameLoop: while (turnCount < maxTurns) {
    turnCount++;

    const result = await test.step(`Turn ${turnCount}`, async () => {
      // Both players plan their turn
      await planTurn(playerA, 'Alice');
      await planTurn(playerB, 'Bob');

      // Resolve phases for both players (order determined by game)
      return await resolveAllPhases(playerA, playerB);
    });

    if (result === 'finished') {
      break gameLoop;
    }
  }

  // Verify game finished
  await expect(playerA.getByText('Race Finished!')).toBeVisible();
  await expect(playerB.getByText('Race Finished!')).toBeVisible();

  // Cleanup
  await contextA.close();
  await contextB.close();
});
