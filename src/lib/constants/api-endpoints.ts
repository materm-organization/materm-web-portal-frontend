// Every API path the app calls, centralized
// Paths are relative to the axios instances' baseURL (see `lib/axios.ts`).
// Adjust the auth paths to match the backend this project talks to, and add
// one group per feature as you build it.
export const API_ENDPOINTS = {
  AUTH: {
    // LOGIN and REFRESH sit outside the `/auth` group; REFRESH is a GET that
    // expects the refresh token as a Bearer header (which lib/axios.ts's
    // interceptor already does).
    LOGIN: "/login",
    ME: "/auth/me",
    REFRESH: "/jwt/refresh",
    CHANGE_PASSWORD: "/auth/users/change-password",
  },
} as const;
