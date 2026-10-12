/** Verify registration field feedback, persisted identity and retry-login recovery. */
import { it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Register from '../src/pages/Register.jsx';
import { readUsers, readSession, writeUsers, STORAGE_KEYS } from '../src/lib/storage.js';
import { DEFAULT_ADMIN } from '../src/lib/permissions.js';

function renderRegister(session = null) {
  const callback = vi.fn();
  render(
    <MemoryRouter initialEntries={['/register']}>
      <Routes>
        <Route path="/register" element={<Register session={session} onSession={callback} />} />
        <Route path="/blogs" element={<h1>Member destination</h1>} />
        <Route path="/admin" element={<h1>Admin destination</h1>} />
        <Route path="/login" element={<h1>Login destination</h1>} />
      </Routes>
    </MemoryRouter>
  );
  return callback;
}
async function fill(username = 'writer', confirmation = 'demo') {
  await userEvent.type(screen.getByLabelText('Display Name'), ' Writer ');
  await userEvent.type(screen.getByLabelText('Username'), username);
  await userEvent.type(screen.getByLabelText('Password'), 'demo');
  await userEvent.type(screen.getByLabelText('Confirm Password'), confirmation);
}
it('associates all required field errors and writes nothing', async () => {
  renderRegister();
  await userEvent.click(screen.getByRole('button', { name: 'Create Account' }));
  for (const label of ['Display Name', 'Username', 'Password', 'Confirm Password']) {
    expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(label)).toHaveAttribute('aria-describedby');
  }
  expect(screen.getAllByRole('alert')).toHaveLength(4);
  expect(readUsers()).toEqual([]); expect(readSession()).toBeNull();
});
it.each([
  ['ADMIN', 'demo', 'Username admin is reserved.'],
  ['writer', 'other', 'Passwords do not match.'],
])('rejects invalid registration %s/%s without persistence', async (username, confirmation, message) => {
  renderRegister(); await fill(username, confirmation);
  await userEvent.click(screen.getByRole('button', { name: 'Create Account' }));
  expect(screen.getByRole('alert')).toHaveTextContent(message); expect(readUsers()).toEqual([]);
});
it('rejects case-insensitive duplicate without changing collection', async () => {
  const existing = { id: 'old', displayName: 'Old', username: 'WRITER', password: 'demo', role: 'user', createdAt: '2026-01-01' };
  writeUsers([existing]); renderRegister(); await fill();
  await userEvent.click(screen.getByRole('button', { name: 'Create Account' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Username is already taken.'); expect(readUsers()).toEqual([existing]);
});
it('persists user-only account/session and navigates on successful registration', async () => {
  vi.spyOn(crypto, 'randomUUID').mockReturnValue('new-user');
  const callback = renderRegister(); await fill();
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Create Account' }));
  expect(screen.getByRole('heading', { name: 'Member destination' })).toBeInTheDocument();
  expect(readUsers()[0]).toMatchObject({ id: 'new-user', displayName: 'Writer', username: 'writer', password: 'demo', role: 'user' });
  expect(readSession()).toEqual({ userId: 'new-user', displayName: 'Writer', username: 'writer', role: 'user' });
  expect(callback).toHaveBeenCalledWith(readSession());
});
it('keeps form data and no account when account storage fails', async () => {
  const callback = renderRegister(); await fill();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('private'); });
  await userEvent.click(screen.getByRole('button', { name: 'Create Account' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Changes could not be saved in this browser.');
  expect(screen.getByLabelText('Username')).toHaveValue('writer');
  expect(readUsers()).toEqual([]); expect(callback).not.toHaveBeenCalled();
});
it('explains saved-account partial failure and offers retry login', async () => {
  const callback = renderRegister(); await fill();
  const original = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
    if (key === STORAGE_KEYS.session) throw new Error('private');
    original.call(this, key, value);
  });
  await userEvent.click(screen.getByRole('button', { name: 'Create Account' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Your account was saved, but registration was not completed. Please retry login to sign in.');
  expect(readUsers()).toHaveLength(1); expect(readSession()).toBeNull(); expect(callback).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Password')).toHaveValue('demo');
  await userEvent.click(screen.getByRole('link', { name: 'Login' }));
  expect(screen.getByRole('heading', { name: 'Login destination' })).toBeInTheDocument();
});
it.each([['admin', 'Admin destination'], ['user', 'Member destination']])('redirects existing %s away from registration', (role, heading) => {
  renderRegister({ ...DEFAULT_ADMIN, role }); expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
});
it('clears stale field errors when a corrected submission hits storage failure', async () => {
  renderRegister(); await userEvent.click(screen.getByRole('button', { name: 'Create Account' }));
  await fill();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('private'); });
  await userEvent.click(screen.getByRole('button', { name: 'Create Account' }));
  expect(screen.getByLabelText('Username')).toHaveAttribute('aria-invalid', 'false');
  expect(screen.getAllByRole('alert')).toHaveLength(1);
});
