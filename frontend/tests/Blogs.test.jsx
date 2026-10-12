/** Verify real guarded list entry, safe storage and complete newest-first views. */
import { it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App.jsx';
import { writePosts, writeSession } from '../src/lib/storage.js';
import { DEFAULT_ADMIN } from '../src/lib/permissions.js';

const member = { userId: 'u1', username: 'reader', displayName: 'Reader', role: 'user' };
const old = { id: 'old', title: 'Older words', content: 'old content', createdAt: '2026-01-02T12:00:00', authorId: 'u2', authorName: 'Other Author' };

it.each([member, DEFAULT_ADMIN])('lists all posts newest first for signed-in role $role without changing storage', (session) => {
  const posts = [old, ...Array.from({ length: 4 }, (_, index) => ({
    ...old, id: `p${index}`, title: `New ${index}`, content: 'a'.repeat(121), createdAt: `2026-02-0${index + 1}T12:00:00`,
  })), { ...old, id: 'bad-date', title: 'Unknown date post', createdAt: 'invalid' }];
  writePosts(posts);
  const stored = localStorage.getItem('writespace_posts');
  writeSession(session);
  window.history.replaceState({}, '', '/blogs');
  const { container } = render(<App />);
  expect(screen.getByRole('heading', { level: 1, name: 'All Blogs' })).toBeInTheDocument();
  expect(screen.getAllByRole('article')).toHaveLength(6);
  expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent))
    .toEqual(['New 3', 'New 2', 'New 1', 'New 0', 'Older words', 'Unknown date post']);
  expect(container.querySelector('.post-excerpt').textContent).toBe('a'.repeat(120));
  expect(screen.getAllByRole('article')[4]).toHaveClass('border-t-indigo-600');
  expect(localStorage.getItem('writespace_posts')).toBe(stored);
});

it('opens a listed post through its title and returns through the detail back link', async () => {
  writePosts([old]);
  writeSession(member);
  window.history.replaceState({}, '', '/blogs');
  render(<App />);
  await userEvent.click(screen.getByRole('link', { name: old.title }));
  expect(window.location.pathname).toBe('/blog/old');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(old.title);
  await userEvent.click(screen.getByRole('link', { name: 'Back to All Blogs' }));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('All Blogs');
});

it.each([null, '{}'])('redirects missing or malformed session %s before exposing stored posts', (session) => {
  writePosts([old]);
  if (session !== null) localStorage.setItem('writespace_session', session);
  window.history.replaceState({}, '', '/blogs');
  render(<App />);
  expect(window.location.pathname).toBe('/login');
  expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument();
  expect(screen.queryByText(old.title)).not.toBeInTheDocument();
});

it.each([null, '[]', '{bad', '{}', '[null, {}, 42]'])('shows an empty write journey for storage %s without repairing it', async (value) => {
  writeSession(member);
  if (value !== null) localStorage.setItem('writespace_posts', value);
  window.history.replaceState({}, '', '/blogs');
  render(<App />);
  expect(screen.getByRole('heading', { name: 'No posts yet' })).toBeInTheDocument();
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
  const link = screen.getByRole('link', { name: 'Write a Post' });
  expect(link).toHaveAttribute('href', '/write');
  expect(localStorage.getItem('writespace_posts')).toBe(value);
  await userEvent.click(link);
  expect(window.location.pathname).toBe('/write');
});

it('renders empty feedback when post storage is inaccessible but session is readable', () => {
  writeSession(member);
  const read = Storage.prototype.getItem;
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
    if (key === 'writespace_posts') throw new Error('unavailable');
    return read.call(this, key);
  });
  window.history.replaceState({}, '', '/blogs');
  render(<App />);
  expect(screen.getByRole('heading', { name: 'No posts yet' })).toBeInTheDocument();
});

it('discards malformed rows while retaining valid posts and their original source metadata', () => {
  const source = JSON.stringify([null, { ...old, content: 12 }, old]);
  localStorage.setItem('writespace_posts', source);
  writeSession(member);
  window.history.replaceState({}, '', '/blogs');
  render(<App />);
  expect(screen.getAllByRole('article')).toHaveLength(1);
  expect(screen.getByText('Other Author')).toBeInTheDocument();
  expect(localStorage.getItem('writespace_posts')).toBe(source);
});
