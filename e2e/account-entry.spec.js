/** Exercise account entry through links and real browser-local persistence. */
import { test, expect } from './fixtures.js';

test('guest preview and protected reading action lead to login with exact invalid error', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'No posts yet' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your thoughts. Your space. Beautifully simple.');
  await page.getByRole('link', { name: 'Start Reading' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('wrong');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Invalid username or password.');
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  await page.getByRole('link', { name: 'Get Started Free', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
});

for (const mobile of [false, true]) {
  test(`${mobile ? 'mobile' : 'desktop'} navbar Get Started opens the real registration form`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 });
    await page.goto('/');
    if (mobile) await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('navigation', { name: 'Public navigation' })
      .getByRole('link', { name: 'Get Started', exact: true }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByLabel('Display Name')).toBeVisible();
    await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Confirm Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
    if (mobile) {
      await expect(page.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
    }
  });
}

test('footer Register opens the real form and creates a stored user', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Footer navigation' })
    .getByRole('link', { name: 'Register', exact: true }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
  await page.getByLabel('Display Name').fill('Footer Writer');
  await page.getByLabel('Username', { exact: true }).fill('footer-writer');
  await page.getByLabel('Password', { exact: true }).fill('synthetic');
  await page.getByLabel('Confirm Password').fill('synthetic');
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  const users = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')));
  expect(users).toHaveLength(1);
  expect(users[0]).toMatchObject({ displayName: 'Footer Writer', username: 'footer-writer', role: 'user' });
});

test('registration validation, user persistence, logout and exact stored login survive reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Get Started Free', exact: true }).click();
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page.getByRole('alert')).toHaveCount(4);
  await page.getByLabel('Display Name').fill('Demo Writer');
  await page.getByLabel('Username', { exact: true }).fill('ADMIN');
  await page.getByLabel('Password', { exact: true }).fill('synthetic');
  await page.getByLabel('Confirm Password').fill('other');
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page.getByText('Username admin is reserved.')).toBeVisible();
  await expect(page.getByText('Passwords do not match.')).toBeVisible();
  await page.getByLabel('Username', { exact: true }).fill('demo-writer');
  await page.getByLabel('Confirm Password').fill('synthetic');
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  const stored = await page.evaluate(() => ({
    users: JSON.parse(localStorage.getItem('writespace_users')),
    session: JSON.parse(localStorage.getItem('writespace_session')),
  }));
  expect(stored.users).toHaveLength(1);
  expect(stored.users[0]).toMatchObject({ displayName: 'Demo Writer', username: 'demo-writer', role: 'user', password: 'synthetic' });
  expect(stored.session.userId).toBe(stored.users[0].id);
  expect(stored.session).not.toHaveProperty('password');
  await page.reload();
  await expect(page.getByRole('button', { name: /Demo Writer/ })).toBeVisible();
  await page.getByRole('button', { name: /Demo Writer/ }).click();
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')).length)).toBe(1);
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill('demo-writer');
  await page.getByLabel('Password', { exact: true }).fill('synthetic');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await page.reload();
  await expect(page.getByRole('button', { name: /Demo Writer/ })).toBeVisible();
});

test('fixed Admin login persists canonical role and logs out via account dropdown', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual({ userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' });
  await expect(page.getByRole('link', { name: 'Users', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /Admin/ }).click();
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your thoughts. Your space. Beautifully simple.');
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
});

test('mobile hamburger opens public entry and signed-in navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('button', { name: /Admin/ }).click();
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/$/);
});
