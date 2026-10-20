import { LayoutDashboard, type LucideIcon } from "lucide-react";

// Sidebar structure = permission-driven config, single source of truth
//. `title` is a translation key (namespaced under
// `nav.*`), never display text — see components/navbar/nav-main.tsx.
//
// Permission gating: an entry with `anyPermission` is only shown to (and
// reachable by, via RoutePermissionGuard) users holding at least one of those
// `permission_key`s; an entry without it is open to every authenticated user.
// A group with `items` is a collapsible parent (`url: "#"`) shown only when at
// least one of its sub-items is visible.
export type NavMainSubConfig = {
  title: string;
  url: string;
  anyPermission?: string[];
  // Renders a small "Coming Soon" badge next to the label (nav-main.tsx).
  comingSoon?: boolean;
};

export type NavMainGroupConfig = {
  title: string;
  url: string;
  icon: LucideIcon;
  items?: NavMainSubConfig[];
  anyPermission?: string[];
  comingSoon?: boolean;
};

// Add new routes here (and to `lib/constants/breadcrumb.ts`).
export const NAV_MAIN_CONFIG: NavMainGroupConfig[] = [
  // Placeholder landing page — the `/admin` index. No `anyPermission`, so it
  // is open to every authenticated user.
  { title: "nav.dashboard", url: "/admin", icon: LayoutDashboard },
];

function hasAnyPermission(userPermissions: string[], required?: string[]): boolean {
  if (!required || required.length === 0) return true;
  return required.some((p) => userPermissions.includes(p));
}

export function buildNavMainItemsForUser(
  userPermissions: string[],
  config: NavMainGroupConfig[] = NAV_MAIN_CONFIG
): NavMainGroupConfig[] {
  return config
    .map((group) => {
      if (group.items?.length) {
        const items = group.items.filter((item) =>
          hasAnyPermission(userPermissions, item.anyPermission)
        );
        return items.length ? { ...group, items } : null;
      }
      return hasAnyPermission(userPermissions, group.anyPermission) ? group : null;
    })
    .filter((group): group is NavMainGroupConfig => group !== null);
}

export function getFirstAllowedAdminPath(userPermissions: string[]): string | null {
  for (const group of NAV_MAIN_CONFIG) {
    if (group.items?.length) {
      const firstItem = group.items.find((item) =>
        hasAnyPermission(userPermissions, item.anyPermission)
      );
      if (firstItem) return firstItem.url;
    } else if (hasAnyPermission(userPermissions, group.anyPermission)) {
      return group.url;
    }
  }
  return null;
}

// Flatten every group/item into (url, permissions) pairs, then pick the
// longest matching `url` prefix — a route guard on `/admin/users/5/edit`
// must not be satisfied by the `/admin/users` list's (possibly looser)
// permission entry.
export function getPermissionsForPath(pathname: string): string[] | undefined {
  const entries: { url: string; anyPermission?: string[] }[] = [];
  for (const group of NAV_MAIN_CONFIG) {
    entries.push({ url: group.url, anyPermission: group.anyPermission });
    if (group.items) entries.push(...group.items);
  }

  const match = entries
    .filter((e) => pathname === e.url || pathname.startsWith(`${e.url}/`))
    .sort((a, b) => b.url.length - a.url.length)[0];

  return match?.anyPermission;
}
