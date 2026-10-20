# materm-web-portal-frontend

Frontend for the Materm web portal — a Next.js 16 App Router app. This repo currently holds the
shared foundation only: sign-in/auth flow, the protected layout shell (sidebar + header), and
shared infrastructure. Business feature modules have not been built yet.

## What's included

- **Auth**: `/auth/sign-in` page, JWT stored in cookies, a client-side guard on the `(protected)`
  route group, silent token refresh and sign-out, change-password dialog.
- **Protected shell**: collapsible sidebar (permission-driven nav config in `src/lib/nav-main-items.ts`),
  header with breadcrumb, and a placeholder dashboard at `/admin`.
- **Infrastructure**: axios clients (`src/lib/axios.ts`), React Query, a small Redux store,
  next-intl i18n (`la` default, `en`, cookie-based), theming (light/dark), react-hook-form + zod,
  shadcn/ui + Tailwind v4, and a set of feature-agnostic shared components in
  `src/components/global`.

## Running it

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
npm run lint
```

Set `NEXT_PUBLIC_API_BASE_URL` (in `.env.development` / `.env.production`) to your backend.

`.env.development` sets `NEXT_PUBLIC_DISABLE_AUTH_GUARD=true`, which skips the login/route-guard
check entirely (see `DEV_BYPASS_AUTH` in `src/hooks/use-auth.ts`) so `/admin` can be previewed
without a backend. This flag is dev-only and must never be set in `.env.production`. Real auth
(`src/services/auth.api.ts`, `src/hooks/use-auth.ts`) talks to `/login`, `/auth/me`,
`/jwt/refresh` and `/auth/users/change-password`; adjust the paths and payload shapes in
`src/lib/constants/api-endpoints.ts` and `src/types/user.d.ts` to match the real backend.

## Adding a feature

Add a page under `src/app/(protected)/(routes)/`, register it in `src/lib/nav-main-items.ts` and
`src/lib/constants/breadcrumb.ts`, and add its translations to both `i18n/en.json` and
`i18n/la.json`. See `CLAUDE.md` for the full checklist.

## Learn more

- [Next.js Documentation](https://nextjs.org/docs)
- [next-intl Documentation](https://next-intl.dev)
- [shadcn/ui](https://ui.shadcn.com)
