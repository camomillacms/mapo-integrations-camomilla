// TODO: evaluate importing MAPO_SESSION_COOKIE from @mapomodule/core (CoreCookieEnum.Session)
// and MAPO_AUTH_* paths from MAPO_DEFAULTS once the cross-package dependency is justified.
/** Session cookie name consumed by Mapo auth layers. */
export const MAPO_SESSION_COOKIE = "__mapo_session" as const;
/** Mapo login API path routed through this integration. */
export const MAPO_AUTH_LOGIN_PATH = "/api/auth/login" as const;
/** Mapo logout API path routed through this integration. */
export const MAPO_AUTH_LOGOUT_PATH = "/api/auth/logout" as const;
/** Mapo current-user endpoint path routed through this integration. */
export const MAPO_USER_INFO_PATH = "/api/profiles/me" as const;

/** Default Django session cookie name from Camomilla backend. */
export const DJANGO_SESSION_COOKIE = "sessionid" as const;
/** Default Django CSRF cookie name from Camomilla backend. */
export const CSRF_COOKIE = "csrftoken" as const;

/** Allowed cookie names participating in Camomilla proxy session handling. */
export const CAMOMILLA_COOKIES = [
  MAPO_SESSION_COOKIE,
  DJANGO_SESSION_COOKIE,
  CSRF_COOKIE,
] as const;

/** Camomilla login endpoint. */
export const CAMOMILLA_AUTH_LOGIN_PATH = "/api/camomilla/auth/login/" as const;
/** Camomilla logout endpoint. */
export const CAMOMILLA_AUTH_LOGOUT_PATH =
  "/api/camomilla/auth/logout/" as const;
/** Camomilla current user endpoint. */
export const CAMOMILLA_USER_CURRENT_PATH =
  "/api/camomilla/users/current/" as const;
/** Camomilla media folders endpoint. */
export const CAMOMILLA_MEDIA_FOLDERS_PATH =
  "/api/camomilla/media-folders" as const;
/** Camomilla media endpoint. */
export const CAMOMILLA_MEDIA_PATH = "/api/camomilla/media" as const;

/** Camomilla auth endpoints used to trigger auth-specific cookie logic. */
export const CAMOMILLA_AUTH_PATHS = [
  CAMOMILLA_AUTH_LOGIN_PATH,
  CAMOMILLA_AUTH_LOGOUT_PATH,
] as const;
