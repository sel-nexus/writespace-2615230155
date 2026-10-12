/** Verify each field rule independently, including invalid primitive types. */
import { describe, it, expect } from 'vitest';
import { normalizeUsername, validateLogin, validateRegistration, validateManagedUser, validatePost } from '../src/lib/validation.js';
const account = { displayName: ' Writer ', username: ' Writer1 ', password: ' demo ', confirmPassword: ' demo ', role: 'user' };

it.each([[' ADMIN ', 'admin'], ['Writer', 'writer'], [null, ''], [3, ''], ['', '']])('normalizes %j', (input, expected) => { expect(normalizeUsername(input)).toBe(expected); });
it('validates exact login without trimming password input', () => {
  expect(validateLogin({ username: 'writer', password: ' ' })).toEqual({});
  expect(validateLogin()).toEqual({ username: 'Username is required.', password: 'Password is required.' });
  expect(validateLogin(null)).toEqual({ username: 'Username is required.', password: 'Password is required.' });
});
describe.each([
  ['registration', validateRegistration, ['displayName', 'username', 'password', 'confirmPassword']],
  ['managed user', validateManagedUser, ['displayName', 'username', 'password']],
])('%s', (_name, validate, fields) => {
  it('accepts complete fields and does not mutate input', () => {
    expect(validate(account)).toEqual({});
    expect(account.password).toBe(' demo '); expect(account.username).toBe(' Writer1 ');
  });
  it.each(fields)('rejects missing/empty/non-string %s', (field) => {
    for (const value of [undefined, null, '', 3, {}, []]) {
      expect(validate({ ...account, [field]: value })[field]).toMatch(/required/);
    }
  });
  it.each(['displayName', 'username'])('rejects whitespace-only %s', (field) => {
    expect(validate({ ...account, [field]: ' \n ' })[field]).toMatch(/required/);
  });
  it.each(['admin', ' ADMIN ', 'AdMiN'])('rejects reserved %s', (username) => {
    expect(validate({ ...account, username }).username).toBe('Username admin is reserved.');
  });
  it('rejects normalized duplicates and permits distinct identities', () => {
    expect(validate(account, [{ username: 'wRiTeR1' }]).username).toBe('Username is already taken.');
    expect(validate(account, [null, { username: 'different' }])).toEqual({});
    expect(validate(account, null)).toEqual({});
  });
});
it('rejects mismatch while preserving password whitespace and ignores self-registration role', () => {
  expect(validateRegistration({ ...account, confirmPassword: 'demo' }).confirmPassword).toBe('Passwords do not match.');
  expect(validateRegistration({ ...account, role: 'admin' })).toEqual({});
  expect(validateRegistration()).toHaveProperty('displayName');
  expect(validateRegistration(null)).toHaveProperty('username');
});
it.each(['admin', 'user'])('accepts managed canonical role %s', (role) => { expect(validateManagedUser({ ...account, role })).toEqual({}); });
it.each(['Admin', 'guest', '', null, undefined, 3])('rejects managed role %j', (role) => { expect(validateManagedUser({ ...account, role }).role).toBe('Choose Admin or user.'); });
it('rejects missing managed input', () => { expect(validateManagedUser()).toHaveProperty('role'); expect(validateManagedUser(null)).toHaveProperty('role'); });
it('accepts plain-text post whitespace around meaningful text and long input', () => {
  const input = { title: ' title ', content: ' \n<script>text</script>\n ' };
  expect(validatePost(input)).toEqual({}); expect(input.content).toBe(' \n<script>text</script>\n ');
  expect(validatePost({ title: 'x'.repeat(10000), content: 'y'.repeat(10000) })).toEqual({});
});
it.each(['title', 'content'])('rejects each missing/whitespace/invalid post field %s', (field) => {
  for (const value of [undefined, null, '', ' \n ', 3, [], {}]) {
    expect(validatePost({ title: 'Title', content: 'Text', [field]: value })[field]).toMatch(/required/);
  }
});
it('rejects absent post values', () => { expect(validatePost()).toHaveProperty('title'); expect(validatePost(null)).toHaveProperty('content'); });
