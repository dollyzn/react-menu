import cookie from "js-cookie";

const COOKIE_NAME = process.env.NEXT_PUBLIC_AUTH_COOKIE_NAME;

function setCookie(token: string) {
  cookie.set(COOKIE_NAME as string, token, {
    expires: new Date(2147483647 * 1000),
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
}

function removeCookie() {
  cookie.remove(COOKIE_NAME as string);
}

function getCookie(): string | undefined {
  return cookie.get(COOKIE_NAME as string) || undefined;
}

export { getCookie, setCookie, removeCookie };
