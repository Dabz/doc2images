import { env } from "cloudflare:workers";
import { Doc2ImageContainer } from "./doc2image";
import {
  handleCloudflareOAuthCallback,
  redirectToCloudflareOAuth,
} from "./oauth";
import { uploadToR2 } from "./r2";

export { Doc2ImageContainer };

export default {
  async fetch(request: Request) {
    const url = new URL(request.url);
    if (url.pathname === "/login" && request.method === "GET") {
      return redirectToCloudflareOAuth(request);
    }
    if (url.pathname === "/callback" && request.method === "GET") {
      return handleCloudflareOAuthCallback(request);
    }
    if (
      url.pathname.startsWith("/api/doc2image") &&
      request.method === "POST"
    ) {
      const container = env.Doc2Image.getByName(url.pathname);
      return container.fetch(request, { signal: AbortSignal.timeout(200000) });
    }
    if (url.pathname.startsWith("/api/upload") && request.method === "POST") {
      try {
        return await uploadToR2(request);
      } catch (err) {
        console.error("Error while uploading to R2", err);
        return Response.json("Error while uploading to R2", { status: 500 });
      }
    }

    return new Response(null, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
