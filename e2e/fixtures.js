/** Capture browser failures before navigation and enforce clean journey teardown. */
import { test as base, expect } from '../frontend/node_modules/@playwright/test/index.mjs';

export const test = base.extend({
  browserErrors: [async ({ page }, use) => {
    const errors = [];
    const consoleListener = (message) => {
      if (message.type() === 'error') errors.push(message.text());
    };
    const pageListener = (error) => errors.push(error.message);
    page.on('console', consoleListener);
    page.on('pageerror', pageListener);
    try {
      await use(errors);
    } finally {
      page.off('console', consoleListener);
      page.off('pageerror', pageListener);
      expect(errors, 'Browser console and runtime errors').toEqual([]);
    }
  }, { auto: true }],
});
export { expect };
