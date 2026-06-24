import {env} from "cloudflare:workers";
import { Doc2ImageContainer } from "./doc2image"

export { Doc2ImageContainer }

export default {

  fetch(request) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/doc2image")) {
      const container = env.Doc2Image.getByName(url.pathname);
      return container.fetch(request);
    }
		return new Response(null, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
