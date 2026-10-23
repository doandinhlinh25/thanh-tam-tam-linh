# Minh Tâm role-based demo frontend

## Run from the repository root

```sh
npm install --prefix apps/web
npm run dev
```

## Run from `apps/web`

```sh
npm install
npm run dev
```

The interface uses synthetic data and in-memory UI state. It does not connect to an API, store uploaded file contents, or persist edits after refresh.

Students can add PDF/DOCX metadata to a personal demo library for one of their seeded courses. The selected file's contents are not read, uploaded, or retained; personal entries disappear when the student session ends and do not appear in teacher/admin shared course materials. The assistant may show fixed synthetic examples, but it does not analyze or cite the selected file.

The admin AI evaluation page also uses fixed demo fixtures. Runs do not call an AI model or evaluation service; seeded questions show deterministic sample scores, and questions without a matching result remain unevaluated.

## Demo roles

The first screen is Login. Use a quick-entry card to open one of the three role views:

- **Sinh viên:** `minhanh@minhtam.demo`
- **Giáo viên:** `colan@minhtam.demo`
- **Quản trị viên tổ chức:** `admin@minhtam.demo`

All three demo accounts use the public sample password `demo1234`. Sign up opens a temporary student or teacher session; it does not create a persistent account. Admin is available only as the seeded demo persona. Role-scoped menus and data are for product review and do not enforce authorization.

## Checks

```sh
# From the repository root
npm run typecheck --prefix apps/web
npm run build --prefix apps/web
npm test --prefix apps/web -- --run
npm run test:e2e --prefix apps/web

# Or from apps/web
npm run typecheck
npm run build
npm test -- --run
npm run test:e2e
```

The UI tests use Vitest, jsdom, and Testing Library. Playwright uses Chromium and starts the local Vite server on `127.0.0.1:4173`; install its browser with `npx playwright install chromium` in an environment where browser downloads and local server binding are allowed. A failed E2E run caused by environment permissions does not establish a browser test result.

## Frontend structure and API boundary

- `src/app/` owns providers, URL routes, and demo-session composition.
- `src/features/` owns role and feature pages plus demo adapters.
- `src/shared/` owns the generic public-gateway transport, query setup, shared UI, domain types, and theme.
- `src/test/` and `e2e/` contain component and browser test support.

The API client understands only the shared response envelope. It is not connected to a business operation: [`contracts/openapi/common.yaml`](../../contracts/openapi/common.yaml) currently defines no paths. See [`frontend-api-map.md`](../../docs/engineering/frontend-api-map.md) for each screen's mock or contract-blocked status, and [`frontend-wireframe.md`](../../docs/engineering/frontend-wireframe.md) for the route hierarchy. Do not treat demo role routes as server authorization.
