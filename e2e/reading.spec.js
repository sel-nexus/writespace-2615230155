/** Exercise guarded reading via real local storage, UI login and native links. */
import { test, expect } from './fixtures.js';

const owner = { id: 'reading-owner', displayName: 'Demo Reader', username: 'reading-owner', password: 'synthetic', role: 'user', createdAt: '2026-01-01T12:00:00' };
const other = { ...owner, id: 'reading-other', username: 'reading-other', displayName: 'Other Reader' };
const content = '  First line\n\n\t<script>alert("synthetic")</script> & <b>literal</b>\n' + 'x'.repeat(200) + '  ';
const older = { id: 'older', title: 'Older writing', content: 'An earlier thought.', createdAt: '2026-01-02T12:00:00', authorId: other.id, authorName: 'Original Other' };
const newer = { id: 'newer', title: 'Newest writing', content, createdAt: '2026-02-03T12:00:00', authorId: owner.id, authorName: 'Original Reader' };

for (const entry of ['/blogs', '/blog/newer']) {
  test(`guest entering ${entry} logs in through UI then reads persisted plain text`, async ({ page }) => {
    await page.addInitScript(({ users, posts }) => {
      if (localStorage.getItem('writespace_users') === null) localStorage.setItem('writespace_users', JSON.stringify(users));
      if (localStorage.getItem('writespace_posts') === null) localStorage.setItem('writespace_posts', JSON.stringify(posts));
    }, { users: [owner, other], posts: [older, newer] });
    await page.goto(entry);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Newest writing' })).toHaveCount(0);
    await page.getByLabel('Username', { exact: true }).fill(owner.username);
    await page.getByLabel('Password', { exact: true }).fill(owner.password);
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(page).toHaveURL(/\/blogs$/);
    const cards = page.getByRole('article');
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0).getByRole('heading')).toHaveText(newer.title);
    await expect(cards.nth(1).getByRole('heading')).toHaveText(older.title);
    await expect(cards.nth(0)).toHaveClass(/border-t-indigo-600/);
    await expect(cards.nth(1)).toHaveClass(/border-t-violet-600/);
    expect(await cards.nth(0).locator('.post-excerpt').textContent()).toBe(content.slice(0, 120));
    await expect(cards.nth(0).getByText('Feb 03, 2026')).toBeVisible();
    await expect(cards.nth(0).getByRole('img', { name: 'Original Reader, user' })).toBeVisible();
    await cards.nth(0).getByRole('link', { name: newer.title }).click();
    await expect(page).toHaveURL(/\/blog\/newer$/);
    expect(await page.locator('.post-content').textContent()).toBe(content);
    await expect(page.locator('.post-content script, .post-content b')).toHaveCount(0);
    expect(await page.locator('.post-content').evaluate((element) => getComputedStyle(element).whiteSpace)).toBe('pre-wrap');
    await expect(page.getByRole('link', { name: 'Edit Post' })).toHaveAttribute('href', '/edit/newer');
    await expect(page.getByRole('button', { name: 'Delete Post', exact: true })).toBeVisible();
    await page.reload();
    expect(await page.locator('.post-content').textContent()).toBe(content);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([older, newer]);
    await page.getByRole('link', { name: 'Back to All Blogs' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('All Blogs');
    await page.getByRole('link', { name: older.title }).click();
    await expect(page.getByRole('link', { name: 'Edit Post' })).toHaveCount(0);
    await expect(page.getByText(older.content)).toBeVisible();
  });
}

test('Admin logs in through UI and may edit a post by another author without changing metadata', async ({ page }) => {
  await page.goto('/login');
  await page.evaluate((posts) => localStorage.setItem('writespace_posts', JSON.stringify(posts)), [older, newer]);
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.getByRole('link', { name: 'All Blogs', exact: true }).click();
  await page.getByRole('link', { name: newer.title }).click();
  await expect(page.getByRole('link', { name: 'Edit Post' })).toHaveAttribute('href', '/edit/newer');
  await expect(page.getByText('Original Reader')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Edit Post' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([older, newer]);
});

test('a post removed after listing shows missing feedback and a working list back link', async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(({ users, posts }) => {
    localStorage.setItem('writespace_users', JSON.stringify(users));
    localStorage.setItem('writespace_posts', JSON.stringify(posts));
  }, { users: [owner], posts: [newer] });
  await page.getByLabel('Username', { exact: true }).fill(owner.username);
  await page.getByLabel('Password', { exact: true }).fill(owner.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('link', { name: newer.title })).toBeVisible();
  await page.evaluate(() => localStorage.setItem('writespace_posts', '[]'));
  await page.getByRole('link', { name: newer.title }).click();
  await expect(page.getByRole('heading', { name: 'Post not found' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Edit Post' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Post not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to All Blogs' }).click();
  await expect(page.getByRole('heading', { name: 'No posts yet' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Write a Post' })).toHaveAttribute('href', '/write');
});

for (const value of ['[]', '{malformed', '{}']) {
  test(`mobile list has an empty write journey for post storage ${value}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/login');
    await page.evaluate(({ users, value }) => {
      localStorage.setItem('writespace_users', JSON.stringify(users));
      localStorage.setItem('writespace_posts', value);
    }, { users: [owner], value });
    await page.getByLabel('Username', { exact: true }).fill(owner.username);
    await page.getByLabel('Password', { exact: true }).fill(owner.password);
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'No posts yet' })).toBeVisible();
    await expect(page.getByRole('article')).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'No posts yet' })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBe(value);
    await page.getByRole('link', { name: 'Write a Post' }).click();
    await expect(page).toHaveURL(/\/write$/);
  });
}

test('mobile reader reaches a card from the hamburger navigation without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await page.evaluate(({ users, posts }) => {
    localStorage.setItem('writespace_users', JSON.stringify(users));
    localStorage.setItem('writespace_posts', JSON.stringify(posts));
  }, { users: [owner], posts: [older, newer] });
  await page.getByLabel('Username', { exact: true }).fill(owner.username);
  await page.getByLabel('Password', { exact: true }).fill(owner.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.getByRole('link', { name: 'WriteSpace', exact: true }).click();
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('navigation', { name: 'Account navigation' }).getByRole('link', { name: 'All Blogs' }).click();
  await page.getByRole('link', { name: newer.title }).click();
  expect(await page.locator('.post-content').textContent()).toBe(content);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/reading-mobile.png', fullPage: true });
});
