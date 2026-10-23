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

# Or from apps/web
npm run typecheck
npm run build
```
