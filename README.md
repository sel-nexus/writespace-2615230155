# WriteSpace

A browser-local writing and reading demo built with React 18.3.1, JavaScript JSX, Vite 5.4.11, React Router DOM 6.30.6 and Tailwind CSS 3.4.16. One static frontend; no application server, API, database, hosted identity or synchronization.

## Demo safety

**Use synthetic data only. Never enter a real password or sensitive writing.** Credentials are plaintext in localStorage. Sessions and roles are user-modifiable; route guards and ownership checks are usability controls, not trusted authorization. Data belongs to the current browser profile/origin, is not shared across devices, has no backup, and is lost when storage is cleared. Tabs do not synchronize and concurrent writes may overwrite each other.

The public demo account is **admin / admin**. Registration creates a `user` account; Admin may create managed `admin` and `user` accounts. The fixed Admin and current account cannot be deleted through the UI. No accounts/posts are automatically seeded into browser storage.

## Features and routes

- `/`: introduction, three latest local previews, login/registration entry and demo warning.
- `/login`, `/register`: validated local account entry, role destination, partial-registration recovery if session storage fails.
- `/blogs`, `/blog/:id`: newest-first list and escaped, whitespace-preserved plain text; meaningful empty/missing states.
- `/write`, `/edit/:id`: required-field editor, counter, UUID/author/timestamp creation, metadata-preserving updates, owner/Admin controls and no-write cancellation.
- `/admin`, `/users`: four activity counts, five latest posts, all-author post management and protected managed-account tools.
- Logout removes only `writespace_session`; users and posts remain. All writes report failure rather than claiming success on quota/access errors.

Storage keys: `writespace_posts`, `writespace_users`, `writespace_session`. Structurally invalid records are discarded on read without rewriting the original key. Invalid collections become empty and invalid sessions become guest state.

## Local setup

Requires Node 20+ and npm. From the repository root:

```bash
cd frontend
npm ci --no-bin-links
cp .env.example .env
npm run dev -- --host 0.0.0.0
```

`VITE_PORT` is a public development/preview port setting, default 5173. There are no application secrets or API URLs. `.env` is ignored; the static production assets do not consume runtime `.env` changes. Use HTTP localhost or HTTPS so `crypto.randomUUID()` is available.

## Build and tests

Run from `frontend/`:

```bash
npm test
npm run coverage
NODE_ENV=production npm run build
node node_modules/@playwright/test/cli.js install chromium
VITE_PORT=4173 npm run e2e -- --reporter=html,line
```

Build output: `frontend/dist/`. Scripts invoke Node package entries directly, so they work where npm bin symlinks are unavailable. Playwright starts its production-preview webServer if one is not already running; one worker uses isolated browser contexts. Tests use synthetic fixtures only. Browser specs in root `e2e/` import the tier-local Playwright through `fixtures.js`, which enforces no console/page errors for every test.

Verification in Development:
- 18 unit/component files, **513 passing cases**.
- V8 coverage before the final Router dependency patch: 99.82% statements/lines, 99.56% branches, 100% functions. All 513 cases reran successfully after the patch.
- Independent critic: round 3 **PASS, score 1.0, high failures 0**.
- **43 browser cases verified**: full run 42 passed and one ambiguous Users locator failed; the exact locator was corrected, then account-entry's seven cases all passed. No assertions were removed or skipped.
- Mobile/desktop preflight captures accessibility trees, computed styles, HTML and screenshots; full browser run also covers 390/768/1024 breakpoints, storage corruption, route boundaries and cross-feature records.
- Production Vite build and static Docker image build passed; root/deep-route SPA fallback and missing-asset 404 smoke tests passed.

API tests, backend integration tests, database persistence and multi-tier Compose are not applicable. Cross-feature persistence is tested through the browser, not a fictitious backend.

Generated browser HTML reports are workspace evidence, not committed source. The full-suite report contains its initial locator failure; the separate account report supplies the passing retry. The pipeline test report records both honestly.

## Static container

From repository root:

```bash
docker build -t writespace-local frontend
docker run --rm -p 8080:80 writespace-local
```

Two-stage image: Node builds assets; nginx serves them on `0.0.0.0:80`. Container command is `nginx -g 'daemon off;'`, health path `/`. `frontend/nginx.conf` serves `index.html` for SPA paths and returns 404 for missing `/assets/` files. No proxy or backend host is configured, and no browser data is stored in the image. Docker build context is `frontend/`.

## AWS handoff and release gate

The required topology is ECR → frontend-only ECS service → shared ALB → CloudFront, using the existing pipeline's CloudFormation/VPC. The nginx origin fallback is implemented and locally verified. **AWS deployment, HTTPS and direct-route behavior through CloudFront have not been verified in Development.** The deployment owner must approve the exact AWS configuration and capture public root/asset/direct `/blogs`, `/blog/<id>`, `/admin`, `/users` and refresh evidence before promotion. Root health alone is not proof of deep-link correctness. A Vercel rewrite is not AWS configuration; none is supplied as a substitute.

Rollback restores the previous frontend image through the platform. It cannot restore cleared browser data. Region, task sizing and shared infrastructure inputs must come from the deployment platform, not invented application settings.

## Known risks and design notes

- `npm audit --omit=dev` after Router 6.30.6 reports two moderate affected packages (`react-router`, `react-router-dom`), no high/critical production findings. Advisories include backslash open redirects and SSR hydration constructor injection; this app uses encoded internal resource links and no SSR. The audit's full fix requires Router v7, outside the mandated v6 design. Review residual risk before public release.
- The build/test toolchain audit also reports vulnerabilities. Do not expose Vite/Vitest development servers publicly. Only static assets are copied into the final nginx stage; this does not constitute a clean dependency or image security audit. Toolchain/container patching remains a release review item.
- jsdom emits native-navigation diagnostics for deliberately uncancelled modified-click tests; Router warns on malformed-percent test cases. Those diagnostics were not used to skip assertions.
- The source-specified full indigo/violet/pink hero conflicts with the development UI rule. The documented deviation uses an editorial paper-wash hero, while retaining the specified text, palette accents, source avatars, responsive behavior and Admin banner. No unrelated features or telemetry were added.

Source modules are in `frontend/src/`, unit/component tests in `frontend/tests/`, browser journeys in `e2e/`, and the final code graph in `graphify-out/graph.json`.
