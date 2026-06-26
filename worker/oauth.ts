import * as oidc from "openid-client";
import { Const } from "./const";
import { expireCookie, getCookie, serializeCookie } from "./cookies";
import { env } from "cloudflare:workers";

export async function redirectToCloudflareOAuth(request: Request) {
  const OIDC_CONFIG: oidc.Configuration = await oidc.discovery(
    new URL(Const.CLOUDFLARE_OIDC_URL),
    env.OAUTH_CLIENT_ID,
    env.OAUTH_SECRET,
  );

  const requestUrl = new URL(request.url);
  const redirectUri = `${requestUrl.protocol}//${requestUrl.hostname}${requestUrl.port ? ":" + requestUrl.port : ""}/callback`;
  const isPopup = requestUrl.searchParams.get("popup") === "1";
  const scope = Const.R2_OAUTH_SCOPES;
  let state = getCookie(request, Const.COOKIES_STATE);
  if (!state) {
    state = oidc.randomState();
  }
  const codeVerifier: string = oidc.randomPKCECodeVerifier();
  const codeChallenge: string =
    await oidc.calculatePKCECodeChallenge(codeVerifier);

  const parameters: Record<string, string> = {
    redirect_uri: redirectUri,
    scope: scope,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state: state,
  };
  const redirectTo = oidc.buildAuthorizationUrl(OIDC_CONFIG, parameters);

  return new Response(null, {
    status: 302,
    headers: new Headers([
      ["Location", redirectTo.href],
      ["Set-Cookie", serializeCookie(Const.COOKIES_STATE, state, request)],
      [
        "Set-Cookie",
        serializeCookie(Const.COOKIES_VERIFIER, codeVerifier, request),
      ],
      [
        "Set-Cookie",
        isPopup
          ? serializeCookie(Const.COOKIES_POPUP, "1", request)
          : expireCookie(Const.COOKIES_POPUP, request),
      ],
    ]),
  });
}

export async function handleCloudflareOAuthCallback(request: Request) {
  const OIDC_CONFIG: oidc.Configuration = await oidc.discovery(
    new URL(Const.CLOUDFLARE_OIDC_URL),
    env.OAUTH_CLIENT_ID,
    env.OAUTH_SECRET,
  );

  const url = new URL(request.url);
  const state = getCookie(request, Const.COOKIES_STATE);
  const codeVerifier = getCookie(request, Const.COOKIES_VERIFIER);
  const isPopup = getCookie(request, Const.COOKIES_POPUP) === "1";
  try {
    const tokens: oidc.TokenEndpointResponse =
      await oidc.authorizationCodeGrant(OIDC_CONFIG, url, {
        pkceCodeVerifier: codeVerifier,
        expectedState: state,
      });

    const headers = new Headers([
      [
        "Set-Cookie",
        serializeCookie(
          Const.COOKIES_TOKEN,
          tokens.access_token,
          request,
          tokens.expires_in,
        ),
      ],
      ["Set-Cookie", expireCookie(Const.COOKIES_STATE, request)],
      ["Set-Cookie", expireCookie(Const.COOKIES_VERIFIER, request)],
      ["Set-Cookie", expireCookie(Const.COOKIES_POPUP, request)],
    ]);

    if (isPopup) {
      return oauthPopupResponse(url.origin, headers);
    }

    headers.set("Location", "/");
    return new Response(null, { status: 302, headers });
  } catch (err) {
    console.error(err);
    return Response.json(
      {
        status: "failed",
        message: "Invalid token returned",
      },
      { status: 500 },
    );
  }
}

export function oauthPopupResponse(origin: string, headers: Headers) {
  headers.set("Content-Type", "text/html; charset=utf-8");
  return new Response(
    `<!doctype html>
<html>
  <body>
    <script>
      if (window.opener) {
        window.opener.postMessage({ type: "doc2image:oauth-complete" }, ${JSON.stringify(origin)});
        window.close();
      } else {
        window.location.href = "/";
      }
    </script>
    Authentication complete. You can close this window.
  </body>
</html>`,
    { headers },
  );
}

export function getToken(request: Request): string {
  return getCookie(request, Const.COOKIES_TOKEN);
}
