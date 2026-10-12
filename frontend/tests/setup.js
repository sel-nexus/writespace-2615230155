/** Isolate each DOM test and restore browser-local state. */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { beforeEach, afterEach, vi } from 'vitest';

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState({}, '', '/');
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});
