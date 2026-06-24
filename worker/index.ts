import {env} from "cloudflare:workers";
import { Doc2ImageContainer } from "./doc2image"

export { Doc2ImageContainer }

export default {

  async fetch(request: Request) {
    const url = new URL(request.url);

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
  const formData = await request.formData();
  const filename = formData.get("filename");
  for (const [key, value] of formData.entries()) {
    if (key === "filename") continue;
    if (value instanceof String) continue;
    const file = value as File;
    await env.doc2images.put(`${filename}/${key}`, await file.arrayBuffer());
  }
  return Response.json({
    "status": "success"
  });
}

