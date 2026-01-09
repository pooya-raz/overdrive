import { test, expect, Page, BrowserContext } from '@playwright/test';

async function setupPlayer(context: BrowserContext, username: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto('/');
  await page.getByPlaceholder('Enter your username').fill(username);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Heat - Lobby')).toBeVisible();
  return page;
}

test('two players can create and start a game', async ({ browser }) => {
  // Create two separate browser contexts (isolated localStorage)
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();

  // Use unique room name to avoid conflicts with parallel tests
  const roomName = `Test Room ${crypto.randomUUID()}`;

  // Player A: Create room
  const playerA = await setupPlayer(contextA, 'Alice');
  await playerA.getByPlaceholder('Room name').fill(roomName);
  await playerA.getByRole('button', { name: 'Create' }).click();

  // Player A: Verify in room, Start Game disabled
  await expect(playerA.getByText('Players (1/6)')).toBeVisible();
  await expect(playerA.getByRole('button', { name: 'Start Game' })).toBeDisabled();

  // Player B: Join room
  const playerB = await setupPlayer(contextB, 'Bob');
  const roomRow = playerB.locator('li').filter({ hasText: roomName });
  await expect(roomRow).toBeVisible();
  await roomRow.getByRole('button', { name: 'Join' }).click();

  // Player B: Verify in room as non-host
  await expect(playerB.getByText('Players (2/6)')).toBeVisible();
  await expect(playerB.getByText('Waiting for host to start')).toBeVisible();

  // Player A: Verify 2 players, Start Game enabled
  await expect(playerA.getByText('Players (2/6)')).toBeVisible();
  await expect(playerA.getByRole('button', { name: 'Start Game' })).toBeEnabled();

  // Player A: Start game
  await playerA.getByRole('button', { name: 'Start Game' }).click();

  // Both players: Verify game started (check for Planning Phase card)
  await expect(playerA.getByText('Planning Phase')).toBeVisible();
  await expect(playerB.getByText('Planning Phase')).toBeVisible();

  // Cleanup
  await contextA.close();
  await contextB.close();
});
