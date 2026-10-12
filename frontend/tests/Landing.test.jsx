/** Verify empty/populated landing content, escaped previews and entry links. */
import { it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Landing from '../src/pages/Landing.jsx';
import { writePosts } from '../src/lib/storage.js';
import { DEFAULT_ADMIN } from '../src/lib/permissions.js';

it('shows exact hero/features, local empty state, guest actions and warning', () => {
  render(<MemoryRouter><Landing /></MemoryRouter>);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Your thoughts. Your space. Beautifully simple.');
  for (const name of ['Write Freely', 'Private & Local', 'Instant & Fast', 'No posts yet']) {
    expect(screen.getByRole('heading', { name })).toBeInTheDocument();
  }
  expect(screen.getByRole('link', { name: 'Get Started Free' })).toHaveAttribute('href', '/register');
  expect(screen.getByRole('link', { name: 'Start Reading' })).toHaveAttribute('href', '/blogs');
  expect(screen.getByText(/credentials are stored in plaintext/)).toBeInTheDocument();
  const footer = screen.getByRole('navigation', { name: 'Footer navigation' });
  for (const name of ['Home', 'All Blogs', 'Login', 'Register']) expect(within(footer).getByRole('link', { name })).toBeInTheDocument();
});
it('shows only three newest real previews in order with exact excerpts and author', () => {
  writePosts([1, 4, 2, 3].map((id) => ({
    id: String(id), title: `Post ${id}`, content: '<script>unsafe()</script>' + 'x'.repeat(150),
    createdAt: `2026-01-0${id}T12:00:00`, authorId: 'u1', authorName: '<b>Writer</b>',
  })));
  const { container } = render(<MemoryRouter><Landing /></MemoryRouter>);
  const cards = screen.getAllByRole('article').filter((node) => node.classList.contains('preview-card'));
  expect(cards).toHaveLength(3);
  expect(cards.map((node) => within(node).getByRole('heading').textContent)).toEqual(['Post 4', 'Post 3', 'Post 2']);
  expect(screen.queryByRole('link', { name: 'Post 1' })).not.toBeInTheDocument();
  expect(within(cards[0]).getByRole('link', { name: 'Post 4' })).toHaveAttribute('href', '/blog/4');
  expect(within(cards[0]).getByText('Jan 04, 2026')).toBeInTheDocument();
  expect(within(cards[0]).getByText('<script>unsafe()</script>' + 'x'.repeat(95))).toBeInTheDocument();
  expect(within(cards[0]).getByText('<b>Writer</b>')).toBeInTheDocument();
  expect(container.querySelector('script')).toBeNull();
});
it.each([['admin', '/admin'], ['user', '/blogs']])('shows signed-in %s hero destination and write empty action', (role, home) => {
  render(<MemoryRouter><Landing session={{ ...DEFAULT_ADMIN, role }} /></MemoryRouter>);
  expect(screen.getByRole('link', { name: 'Go to Dashboard' })).toHaveAttribute('href', home);
  expect(screen.getByRole('link', { name: 'Get Started' })).toHaveAttribute('href', '/write');
});
it('falls back to empty preview for malformed browser data', () => {
  localStorage.setItem('writespace_posts', '{');
  render(<MemoryRouter><Landing /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: 'No posts yet' })).toBeInTheDocument();
});
