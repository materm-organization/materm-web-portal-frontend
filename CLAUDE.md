# CLAUDE.md

This file provides guidance to Claude Code when working on this project.

## What this is

`materm-web-portal-frontend` — a Next.js 16 App Router web portal frontend. It currently contains only the shared foundation: the
sign-in/auth flow, the `(protected)` layout shell (sidebar + header), and shared
infrastructure. It has no business features yet — a minimal placeholder dashboard at
`/admin` is the only protected page. Add the project's real feature modules on top.

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router), TypeScript |
| Server state | TanStack React Query |
| Client-only state | Redux Toolkit (one small `ui` slice, currently just an example `activeWorkspaceId`) |
| HTTP | axios (`src/lib/axios.ts` — one authenticated + one public instance, 401 -> silent refresh -> retry) |
| Forms | react-hook-form + zod |
| UI kit | shadcn/ui ("new-york" style) + Tailwind v4 |
| i18n | next-intl, cookie-based locale (`la` default, `en`) — no `[locale]` route segment |
| Auth | JWT in cookies (`js-cookie`), client-side `(protected)` route-group guard, no edge middleware |

## Run it

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
npm run lint
```

Env vars: `.env.development` / `.env.production`. `NEXT_PUBLIC_API_BASE_URL` is the backend
base URL. `.env.development` also sets `NEXT_PUBLIC_DISABLE_AUTH_GUARD=true`, a dev-only flag
that skips the login/route-guard check (see `DEV_BYPASS_AUTH` in `src/hooks/use-auth.ts`) —
never set it in `.env.production`. No secrets belong in these files.

## What is in the codebase

- `src/app/auth/sign-in` — public sign-in page (`components/auth/signin-form.tsx`).
- `src/app/(protected)/(routes)/layout.tsx` — the protected shell: `SidebarProvider` +
  `AppSidebar` + `AppHeader` + `RoutePermissionGuard` around `{children}`.
- `src/app/(protected)/(routes)/admin/page.tsx` — placeholder dashboard (post-login landing).
- `src/components/navbar` (sidebar: `app-sidebar`, `nav-main`, `nav-user`), `src/components/layout`
  (`app-header`, `route-permission-guard`), `src/components/auth` (sign-in form, change-password
  dialog), `src/components/provider` (query/redux/theme providers).
- `src/components/ui` — shadcn primitives. `src/components/global` — shared, feature-agnostic
  building blocks (data-table, pagination, keyword/date-range/single-select/multi-select filters,
  export-csv dialog, empty state, language/theme toggles, logo icon).
- `src/lib` — `axios.ts`, `utils.ts`, `nav-main-items.ts` (the sidebar config AND the route
  permission map — single source of truth), `constants/` (api endpoints, breadcrumb map,
  cookies, locales, pagination).
- `src/hooks/use-auth.ts` (current user, login, change password, `useHasAction`),
  `use-mobile.ts`, `use-workspace-initializer.ts`; `src/services/auth.api.ts`;
  `src/types/{api,user}.d.ts`; `src/redux/` (store, typed hooks, `ui` slice); `src/i18n/request.ts`
  and `i18n/{en,la}.json`.

## Adding a feature

1. Add the page under `src/app/(protected)/(routes)/<route>/page.tsx`.
2. Register it in `src/lib/nav-main-items.ts` (`NAV_MAIN_CONFIG`; use `anyPermission` to gate it —
   the same config drives `RoutePermissionGuard`) and in `src/lib/constants/breadcrumb.ts`.
3. Add its i18n keys (`nav.*`, `breadcrumb.*`, feature namespace) to BOTH `i18n/en.json` and
   `i18n/la.json`.
4. Add endpoints to `src/lib/constants/api-endpoints.ts`, a `src/services/<feature>.api.ts`,
   types in `src/types/`, a React Query hook in `src/hooks/`, and feature components under
   `src/components/<feature>/` (or `components/protected/<feature>/`).
5. If a gated route is added, also add the matching permission grant to `DEV_BYPASS_USER` in
   `src/hooks/use-auth.ts` so it shows up in dev-bypass mode.

## Things to know

- The auth model (`/login`, `/auth/me`, `/jwt/refresh`, `/auth/users/change-password`; `CurrentUser`
  with `permissions[]`) is a placeholder. Verify the endpoint paths and payload shapes in
  `lib/constants/api-endpoints.ts` and `types/user.d.ts` against the real backend.
- The protected area lives under the `/admin` path. Sign-in redirects there on success.
