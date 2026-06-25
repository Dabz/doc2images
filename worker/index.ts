import { env } from "cloudflare:workers";
import { Doc2ImageContainer } from "./doc2image"
import * as oidc from 'openid-client'


export { Doc2ImageContainer }

const CLOUDFLARE_API_URL = "https://api.cloudflare.com/client/v4";
const R2_BUCKET_NAME = "doc2images";
const R2_OAUTH_SCOPES = "workers-r2-bucket-item.write workers-r2.write";
const CLOUDFLARE_OIDC_URL = "https://dash.cloudflare.com";

export default {

  async fetch(request: Request) {
    const url = new URL(request.url);
    if (url.pathname === "/api/login" && request.method === "GET") {
      return redirectToCloudflareOAuth(request);
    }
    if (url.pathname === "/callback" && request.method === "GET") {
      return handleCloudflareOAuthCallback(request);
    }
    if (url.pathname.startsWith("/api/doc2image") && request.method === "POST") {
      const container = env.Doc2Image.getByName(url.pathname);
      return container.fetch(request, { signal: AbortSignal.timeout(200000) });
    }
    if (url.pathname.startsWith("/api/upload") && request.method === "POST") {
      try {
        return await uploadToR2(request);
      } catch(err) {
        console.error("Error while uploading to R2", err);
        return Response.json("Error while uploading to R2", { status: 500 })
      }
    }

    return new Response(null, { status: 404 });
  },
} satisfies ExportedHandler<Env>;


async function uploadToR2(request: Request<unknown, CfProperties<unknown>>) {
  const accessToken = getCookie(request, "cf_oauth_token");
  if (!accessToken) {
    return Response.json({ loginUrl: "/api/login" }, { status: 401 });
  }

  const formData = await request.formData();
  const filename = formData.get("filename");
  if (typeof filename !== "string" || filename.length === 0) {
    return Response.json("Missing filename", { status: 400 });
  }

  const accountId = await getR2AccountId(accessToken);
  for (const [key, value] of formData.entries()) {
    if (key === "filename") continue;
    if (typeof value === "string") continue;
    const file = value as File;
    const uploadResponse = await fetch(
      `${CLOUDFLARE_API_URL}/accounts/${accountId}/r2/buckets/${R2_BUCKET_NAME}/objects/${encodeR2ObjectKey(`${filename}/${key}`)}`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": file.type || "application/octet-stream",
        },
        body: await file.arrayBuffer(),
      },
    );

    if (!uploadResponse.ok) {
      if (uploadResponse.status === 401 || uploadResponse.status === 403) {
        return Response.json(
          { loginUrl: "/api/login", error: await uploadResponse.text() },
          { status: 401, headers: clearOAuthCookieHeaders() },
        );
      }
      throw new Error(`R2 upload failed with status ${uploadResponse.status}: ${await uploadResponse.text()}`);
    }
  }
  return Response.json({
    "status": "success"
  });
}

async function redirectToCloudflareOAuth(request: Request) {
  const OIDC_CONFIG: oidc.Configuration = await oidc.discovery(
    new URL(CLOUDFLARE_OIDC_URL),
    env.OAUTH_CLIENT_ID,
    env.OAUTH_SECRET,
  );

  const requestUrl = new URL(request.url);
  const redirectUri = `${requestUrl.protocol}//${requestUrl.hostname}${requestUrl.port ? ':' + requestUrl.port : ''}/callback`;
  const isPopup = requestUrl.searchParams.get("popup") === "1";
  const scope = R2_OAUTH_SCOPES;
  let state = getCookie(request, "cf_oauth_state");
  if (!state) {
    state = oidc.randomState();
  }
  const codeVerifier: string = oidc.randomPKCECodeVerifier()
  const codeChallenge: string = await oidc.calculatePKCECodeChallenge(codeVerifier)

  const parameters: Record<string, string> = {
    redirect_uri: redirectUri,
    scope: scope,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state: state
  }
  const redirectTo = oidc.buildAuthorizationUrl(OIDC_CONFIG, parameters)

  return new Response(null, {
    status: 302,
    headers: new Headers([
      ["Location", redirectTo.href],
      ["Set-Cookie", serializeCookie("cf_oauth_state", state, request)],
      ["Set-Cookie", serializeCookie("cf_oauth_verifier", codeVerifier, request)],
      ["Set-Cookie", isPopup ? serializeCookie("cf_oauth_popup", "1", request) : expireCookie("cf_oauth_popup", request)],
    ]),
  });
}

async function handleCloudflareOAuthCallback(request: Request) {
  const OIDC_CONFIG: oidc.Configuration = await oidc.discovery(
    new URL(CLOUDFLARE_OIDC_URL),
    env.OAUTH_CLIENT_ID,
    env.OAUTH_SECRET,
  );

  const url = new URL(request.url);
  const state = getCookie(request, "cf_oauth_state")
  const codeVerifier = getCookie(request, "cf_oauth_verifier")
  const isPopup = getCookie(request, "cf_oauth_popup") === "1";
  try {
    const tokens: oidc.TokenEndpointResponse = await oidc.authorizationCodeGrant(
      OIDC_CONFIG,
      url,
      {
        pkceCodeVerifier: codeVerifier,
        expectedState: state,
      },
    )

    const headers = new Headers([
      ["Set-Cookie", serializeCookie("cf_oauth_token", tokens.access_token, request, tokens.expires_in)],
      ["Set-Cookie", expireCookie("cf_oauth_state", request)],
      ["Set-Cookie", expireCookie("cf_oauth_verifier", request)],
      ["Set-Cookie", expireCookie("cf_oauth_popup", request)],
    ]);

    if (isPopup) {
      return oauthPopupResponse(url.origin, headers);
    }

    headers.set("Location", "/");
    return new Response(null, { status: 302, headers });
  } catch (err) {
    console.error(err);
    return Response.json({
      "status": "failed",
      "message": "Invalid token returned"
    }, { status: 500 })
  }
}

function oauthPopupResponse(origin: string, headers: Headers) {
  headers.set("Content-Type", "text/html; charset=utf-8");
  return new Response(`<!doctype html>
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
</html>`, { headers });
}

async function getR2AccountId(accessToken: string) {
  const accountsResponse = await fetch(`${CLOUDFLARE_API_URL}/accounts`, {
    headers: { "Authorization": `Bearer ${accessToken}` },
  });

  if (!accountsResponse.ok) {
    throw new Error(`Unable to list Cloudflare accounts: ${await accountsResponse.text()}`);
  }

  const accounts = await accountsResponse.json<{ result?: Array<{ id: string }> }>();
  for (const account of accounts.result ?? []) {
    const bucketsResponse = await fetch(`${CLOUDFLARE_API_URL}/accounts/${account.id}/r2/buckets?name_contains=${R2_BUCKET_NAME}`, {
      headers: { "Authorization": `Bearer ${accessToken}` },
    });

    if (!bucketsResponse.ok) continue;

    const buckets = await bucketsResponse.json<{ result?: { buckets?: Array<{ name?: string }> } }>();
    if (buckets.result?.buckets?.some((bucket) => bucket.name === R2_BUCKET_NAME)) {
      return account.id;
    }
  }

  throw new Error(`Could not find R2 bucket ${R2_BUCKET_NAME} in authorized Cloudflare accounts`);
}

function getCookie(request: Request, name: string) {
  const cookie = request.headers.get("Cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

function serializeCookie(name: string, value: string, request: Request, maxAge?: number) {
  const url = new URL(request.url);
  const secure = url.protocol === "https:" ? "; Secure" : "";
  const age = maxAge ? `; Max-Age=${maxAge}` : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax${secure}${age}`;
}

function expireCookie(name: string, request: Request) {
  const url = new URL(request.url);
  const secure = url.protocol === "https:" ? "; Secure" : "";
  return `${name}=; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=0`;
}

function clearOAuthCookieHeaders() {
  return new Headers([
    ["Set-Cookie", "cf_oauth_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"],
  ]);
}

function encodeR2ObjectKey(key: string) {
  return key.split("/").map(encodeURIComponent).join("/");
}
