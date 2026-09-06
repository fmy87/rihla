import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// @testing-library/react's auto-cleanup only self-registers when it can see
// a global `afterEach` (i.e. with vitest's `test.globals: true`) — this
// project imports `describe`/`it`/`expect` explicitly per file instead, so
// without this, jsdom from one test's render() would still be in the
// document when the next test in the same file runs.
afterEach(() => {
  cleanup();
});
