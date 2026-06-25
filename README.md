# Doc2Image

Doc2Image is a sample Cloudflare application that converts uploaded `.docx` documents into page images and can upload the generated images to R2.
This project is intended as an example and is not production-ready as-is.

## How It Works

1. A React/Vite single-page app accepts `.docx` files by drag and drop.
2. The Worker routes conversion requests to a Cloudflare Container.
3. The container uses Pandoc to convert `.docx` to PDF.
4. The container uses ImageMagick to render the PDF pages as PNG images.
5. The generated PNG files are returned as a ZIP archive.
6. The app previews the images and can upload them to an R2 bucket.

## Project Structure

- `src/` - React single-page app.
- `worker/` - Cloudflare Worker entrypoint and container binding.
- `container/` - Dockerized document conversion service.
- `wrangler.jsonc` - Cloudflare Worker, Container, and Durable Object configuration.
- `vite.config.ts` - Vite configuration with the Cloudflare plugin.

## Requirements

- Node.js and npm.
- Wrangler access to a Cloudflare account that supports Workers, Containers, Durable Objects, and R2.
- A Cloudflare OAuth client with client ID `a66eab94960828e832af6403d9907b55` and callback URL `/callback`.

The container image installs its own runtime dependencies, including Pandoc and ImageMagick.

## Development

Install dependencies:

```sh
npm install
```

Start the local development server:

```sh
npm run dev
```

Build the project:

```sh
npm run build
```

Run linting:

```sh
npm run lint
```

Preview a production build locally:

```sh
npm run preview
```

## Deployment

Deploy the Worker, assets, and container configuration with:

```sh
npm run deploy
```

The R2 upload flow uses Cloudflare OAuth rather than an R2 binding. The authorized account must contain a bucket named `doc2images`.

## API Routes

- `POST /api/doc2image` - accepts a multipart form upload with a `file` field containing a `.docx` document and returns a ZIP of generated PNG files.
- `GET /api/login` - starts Cloudflare OAuth for R2 access.
- `GET /callback` - completes the OAuth code flow and stores the short-lived session cookie.
- `POST /api/upload` - accepts multipart form data and writes generated image files to the `doc2images` R2 bucket through the Cloudflare REST API.
