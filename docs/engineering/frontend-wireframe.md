# Frontend route hierarchy and wireframe

This note records the routes implemented by the current role-based demo. It is a navigation outline rather than a claim that protected backend resources or LMS capabilities exist.

```text
/login
└── /signup

/student/home
├── /student/courses
├── /student/documents       # Personal demo metadata; no file transfer
├── /student/assistant       # Fixed demo answer states and citations
├── /student/history         # In-memory demo conversation history
└── /student/account

/teacher/home
├── /teacher/courses
├── /teacher/documents       # Seeded shared demo materials
└── /teacher/feedback        # Seeded feedback

/admin/overview
├── /admin/documents
├── /admin/evaluation        # Fixed local evaluation fixtures
├── /admin/feedback
├── /admin/courses
└── /admin/settings

unknown URL → recoverable not-found page
```

## Shared page composition

- **Login/signup:** product introduction and a form or seeded quick-entry choices.
- **Role workspaces:** role-labeled sidebar, active route navigation, breadcrumb, demo-session indicator, identity, logout action, and page content.
- **Feature pages:** a page heading and primary action, with explicit demo disclosure and relevant empty, validation, progress, success, or error state.
- **Not found:** explains that the route is unavailable and provides a way back into the demo.

The route hierarchy is implemented in `apps/web/src/app/routes.ts`; route composition is in `apps/web/src/app/App.tsx`. These role-scoped routes improve demo navigation only and must not be used as an authorization boundary.

## Rendered artifact availability

No screenshot artifact was captured for this setup. The production build succeeds, but starting the Vite server in the current sandbox fails with `listen EPERM` on `127.0.0.1:4173`; consequently Playwright cannot reach its configured web server here. A screenshot and browser smoke run should be captured in an environment that permits local server binding and has Playwright Chromium installed.
