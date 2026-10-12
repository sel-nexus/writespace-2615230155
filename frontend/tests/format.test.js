/** Verify exact date/excerpt output and immutable bounded ordering. */
import { it, expect } from 'vitest';
import { formatDate, newestPosts, excerpt } from '../src/lib/format.js';

it('formats an English month and zero-padded local day', () => { expect(formatDate('2026-01-02T12:00:00')).toBe('Jan 02, 2026'); });
it.each(['invalid', '', ' ', null, 3])('uses unknown-date fallback for %j', (value) => { expect(formatDate(value)).toBe('Unknown date'); });
it('sorts newest first, bounds three/five, and leaves source unchanged', () => {
  const posts = [1, 4, 2, 6, 3, 5].map((id) => ({ id, createdAt: `2026-01-0${id}` }));
  expect(newestPosts(posts, 3).map((p) => p.id)).toEqual([6, 5, 4]);
  expect(newestPosts(posts, 5).map((p) => p.id)).toEqual([6, 5, 4, 3, 2]);
  expect(newestPosts(posts).map((p) => p.id)).toEqual([6, 5, 4, 3, 2, 1]);
  expect(posts.map((p) => p.id)).toEqual([1, 4, 2, 6, 3, 5]);
});
it('retains tie order and places malformed dates last', () => {
  const a = { id: 'a', createdAt: 'bad' }, b = { id: 'b', createdAt: '2026-01-01' }, c = { id: 'c', createdAt: '2026-01-01' };
  expect(newestPosts([a, b, c, {}])).toEqual([b, c, a, {}]);
  expect(newestPosts([b, a])).toEqual([b, a]);
});
it.each([-1, 1.5, NaN, '3', null])('rejects invalid view bound %j', (limit) => { expect(newestPosts([{ createdAt: '2026-01-01' }], limit)).toEqual([]); });
it('handles empty source, non-arrays and zero bounds', () => { expect(newestPosts([])).toEqual([]); expect(newestPosts(null)).toEqual([]); expect(newestPosts([{}], 0)).toEqual([]); });
it('returns exactly the first 120 characters with no added ellipsis', () => { const text = 'a'.repeat(121); expect(excerpt(text)).toBe('a'.repeat(120)); });
it.each([0, 1, 119, 120])('handles content length boundary %i', (length) => { expect(excerpt('x'.repeat(length))).toBe('x'.repeat(length)); });
it('preserves markup as plain text and honors a custom length', () => { expect(excerpt(' <b>text</b> ', 4)).toBe(' <b>'); });
it.each([-1, 2.5, Infinity, '3'])('rejects invalid excerpt bound %j', (limit) => { expect(excerpt('text', limit)).toBe(''); });
it.each([null, 3, {}])('rejects non-string excerpt %j', (input) => { expect(excerpt(input)).toBe(''); });
