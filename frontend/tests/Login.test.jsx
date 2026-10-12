/** Verify login UI through real validators and local persistence. */
import { it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Login from '../src/pages/Login.jsx';
import { readSession, writeUsers } from '../src/lib/storage.js';
import { DEFAULT_ADMIN } from '../src/lib/permissions.js';

function renderLogin(session = null) {
  const onSession = vi.fn();
  render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<Login session={session} onSession={onSession} />} />
        <Route path="/admin" element={<h1>Admin destination</h1>} />
        <Route path="/blogs" element={<h1>Member destination</h1>} />
        <Route path="/register" element={<h1>Registration destination</h1>} />
      </Routes>
    </MemoryRouter>
  );
  return onSession;
}
it('shows required field associations and exact invalid error without session', async () => {
  renderLogin();
  await userEvent.click(screen.getByRole('button', { name: 'Login' }));
  expect(screen.getByText('Invalid username or password.')).toHaveAttribute('role', 'alert');
  expect(screen.getByLabelText('Username')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByLabelText('Username')).toHaveAccessibleDescription('Username is required.');
  expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Password is required.');
  expect(readSession()).toBeNull();
});
it('keeps incorrect credentials on form with exact error', async () => {
  const callback = renderLogin();
  await userEvent.type(screen.getByLabelText('Username'), 'admin');
  await userEvent.type(screen.getByLabelText('Password'), 'incorrect');
  await userEvent.click(screen.getByRole('button', { name: 'Login' }));
  expect(screen.getByText('Invalid username or password.')).toBeInTheDocument();
  expect(screen.getByLabelText('Password')).toHaveValue('incorrect');
  expect(callback).not.toHaveBeenCalled(); expect(readSession()).toBeNull();
});
it('persists fixed admin and navigates to role destination', async () => {
  const callback = renderLogin();
  await userEvent.type(screen.getByLabelText('Username'), 'admin');
  await userEvent.type(screen.getByLabelText('Password'), 'admin');
  await userEvent.click(screen.getByRole('button', { name: 'Login' }));
  expect(screen.getByRole('heading', { name: 'Admin destination' })).toBeInTheDocument();
  expect(readSession()).toEqual(DEFAULT_ADMIN); expect(callback).toHaveBeenCalledWith(DEFAULT_ADMIN);
});
it.each([['admin', 'Admin destination'], ['user', 'Member destination']])('routes stored %s login after write', async (role, heading) => {
  writeUsers([{ id: 'u1', displayName: 'Writer', username: 'writer', password: 'demo', role, createdAt: '2026-01-01' }]);
  renderLogin();
  await userEvent.type(screen.getByLabelText('Username'), 'writer');
  await userEvent.type(screen.getByLabelText('Password'), 'demo');
  await userEvent.click(screen.getByRole('button', { name: 'Login' }));
  expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument(); expect(readSession().role).toBe(role);
});
it('stays on form when session write fails and does not update App identity', async () => {
  const callback = renderLogin();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('private'); });
  await userEvent.type(screen.getByLabelText('Username'), 'admin');
  await userEvent.type(screen.getByLabelText('Password'), 'admin');
  await userEvent.click(screen.getByRole('button', { name: 'Login' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Changes could not be saved in this browser.');
  expect(callback).not.toHaveBeenCalled(); expect(readSession()).toBeNull();
  expect(screen.getByLabelText('Username')).toHaveValue('admin');
});
it.each([['admin', 'Admin destination'], ['user', 'Member destination']])('redirects existing %s session', (role, heading) => {
  renderLogin({ ...DEFAULT_ADMIN, role });
  expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
});
it('offers local demo hint and clickable registration link', async () => {
  renderLogin();
  expect(screen.getByText(/Try the default Admin/)).toHaveTextContent('username admin, password admin');
  await userEvent.click(screen.getByRole('link', { name: 'Get Started Free' }));
  expect(screen.getByRole('heading', { name: 'Registration destination' })).toBeInTheDocument();
});
