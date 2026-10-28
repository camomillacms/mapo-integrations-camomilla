import { describe, expect, it } from "vitest";
import { buildRequestCookies, processResponseCookies } from "../cookieSync";

function forwardedSession(
  cookies: Record<string, string>,
  syncSession: boolean,
  pathname = "/api/profiles/me",
) {
  const { cookieHeader } = buildRequestCookies(cookies, pathname, syncSession);
  return cookieHeader
    .split("; ")
    .find((cookie) => cookie.startsWith("sessionid="));
}

describe("buildRequestCookies", () => {
  it.each(["other-live-account", "dead"])(
    "prefers the shared Django session to the %s copy when synced",
    (copy) => {
      expect(
        forwardedSession(
          { sessionid: "current-account", __mapo_session: copy },
          true,
        ),
      ).toBe("sessionid=current-account");
    },
  );

  it.each([true, false])("uses a Mapo-only session (sync=%s)", (sync) => {
    expect(forwardedSession({ __mapo_session: "mapo" }, sync)).toBe(
      "sessionid=mapo",
    );
  });

  it("forwards a Django-only session when synced", () => {
    expect(forwardedSession({ sessionid: "django" }, true)).toBe(
      "sessionid=django",
    );
  });

  it("keeps the Mapo copy authoritative when isolated", () => {
    expect(
      forwardedSession({ sessionid: "django", __mapo_session: "mapo" }, false),
    ).toBe("sessionid=mapo");
  });

  it("does not forward a Django-only session on isolated API calls", () => {
    expect(forwardedSession({ sessionid: "django" }, false)).toBeUndefined();
  });

  it.each([true, false])("allows anonymous calls (sync=%s)", (sync) => {
    expect(buildRequestCookies({}, "/api/profiles/me", sync)).toEqual({
      cookieHeader: "",
      csrfToken: undefined,
    });
  });

  it.each([true, false])(
    "strips session and CSRF cookies on login (sync=%s)",
    (sync) => {
      expect(
        buildRequestCookies(
          {
            sessionid: "django",
            __mapo_session: "mapo",
            csrftoken: "csrf",
            unrelated: "private",
          },
          "/api/auth/login",
          sync,
        ),
      ).toEqual({ cookieHeader: "", csrfToken: undefined });
    },
  );

  it.each([
    [true, "sessionid=django"],
    [false, "sessionid=mapo"],
  ] as const)(
    "uses the correct session on logout (sync=%s)",
    (sync, expected) => {
      expect(
        forwardedSession(
          { sessionid: "django", __mapo_session: "mapo" },
          sync,
          "/api/auth/logout",
        ),
      ).toBe(expected);
    },
  );

  it("preserves the Django-only logout exception when isolated", () => {
    expect(
      forwardedSession({ sessionid: "django" }, false, "/api/auth/logout"),
    ).toBe("sessionid=django");
  });

  it("forwards CSRF and only allowlisted cookies", () => {
    expect(
      buildRequestCookies(
        { sessionid: "django", csrftoken: "csrf", unrelated: "private" },
        "/api/articles",
        true,
      ),
    ).toEqual({
      cookieHeader: "sessionid=django; csrftoken=csrf",
      csrfToken: "csrf",
    });
  });

  it("does not mutate the incoming cookies", () => {
    const cookies = Object.freeze({
      sessionid: "django",
      __mapo_session: "mapo",
    });
    buildRequestCookies(cookies, "/api/profiles/me", false);
    expect(cookies.sessionid).toBe("django");
  });
});

describe("processResponseCookies", () => {
  it.each([true, false])(
    "keeps auth response mirroring unchanged (sync=%s)",
    (sync) => {
      const cookie = "sessionid=new; Path=/; HttpOnly; SameSite=Lax";
      expect(processResponseCookies([cookie], true, sync)).toEqual([
        ...(sync ? [cookie] : []),
        "__mapo_session=new; Path=/; HttpOnly; SameSite=Lax",
      ]);
    },
  );
});
