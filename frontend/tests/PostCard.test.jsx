/** Verify exact card formatting, safe text and repeating accents. */
import { it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PostCard } from '../src/components/PostCard.jsx';

const post = {
  id: 'post / one', title: 'A local thought', content: 'Plain text',
  createdAt: '2026-01-02T12:00:00', authorId: 'u1', authorName: 'Original Author',
};

it('shows original metadata, default accent and an encoded detail link that navigates', async () => {
  render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<PostCard post={post} />} />
        <Route path="/blog/:id" element={<h1>Detail destination</h1>} />
      </Routes>
    </MemoryRouter>
  );
  expect(screen.getByText('Jan 02, 2026')).toHaveAttribute('dateTime', post.createdAt);
  expect(screen.getByText('Original Author')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Original Author, user' })).toHaveTextContent('📚');
  expect(screen.getByRole('article')).toHaveClass('border-t-indigo-600');
  const link = screen.getByRole('link', { name: post.title });
  expect(link).toHaveAttribute('href', '/blog/post%20%2F%20one');
  await userEvent.click(link);
  expect(screen.getByRole('heading', { name: 'Detail destination' })).toBeInTheDocument();
});

it.each([0, 1, 119, 120, 121, 1000])('renders exactly the first 120 characters for length %s without ellipsis', (length) => {
  const content = 'x'.repeat(length);
  const { container } = render(
    <MemoryRouter>
      <PostCard post={{ ...post, content }} />
    </MemoryRouter>
  );
  expect(container.querySelector('.post-excerpt').textContent).toBe(content.slice(0, 120));
});

it.each([
  [0, 'indigo-600'], [1, 'violet-600'], [2, 'pink-500'], [3, 'teal-500'], [4, 'indigo-600'], [7, 'teal-500'],
])('uses the index modulo four accent for position %s', (index, color) => {
  render(
    <MemoryRouter>
      <PostCard post={post} index={index} />
    </MemoryRouter>
  );
  expect(screen.getByRole('article')).toHaveClass(`border-t-${color}`);
});

it('escapes title, author and excerpt markup, preserves whitespace and handles an invalid date', () => {
  const content = '  <script>alert("demo")</script>\n\t& <b>not bold</b>  ';
  const { container } = render(
    <MemoryRouter>
      <PostCard post={{ ...post, title: '<img src=x>', authorName: '<b>Author</b>', content, createdAt: 'bad-date' }} />
    </MemoryRouter>
  );
  expect(screen.getByRole('link', { name: '<img src=x>' })).toBeInTheDocument();
  expect(screen.getByText('<b>Author</b>')).toBeInTheDocument();
  expect(screen.getByText('Unknown date')).toBeInTheDocument();
  expect(container.querySelector('.post-excerpt').textContent).toBe(content);
  expect(container.querySelector('script, img, b')).toBeNull();
});
