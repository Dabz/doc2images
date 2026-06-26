import {Const} from "./const";

export function getCookie(request: Request, name: string) {
  const cookie = request.headers.get("Cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

export function serializeCookie(
  name: string,
  value: string,
  request: Request,
  maxAge?: number,
) {
  const url = new URL(request.url);
  const secure = url.protocol === "https:" ? "; Secure" : "";
  const age = maxAge ? `; Max-Age=${maxAge}` : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax${secure}${age}`;
}

export function expireCookie(name: string, request: Request) {
  const url = new URL(request.url);
  const secure = url.protocol === "https:" ? "; Secure" : "";
  return `${name}=; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=0`;
}

export function clearOAuthCookieHeaders() {
  return new Headers([
    [
      "Set-Cookie",
      `${Const.COOKIES_TOKEN}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    ],
  ]);
}

export function encodeR2ObjectKey(key: string) {
  return key.split("/").map(encodeURIComponent).join("/");
}
