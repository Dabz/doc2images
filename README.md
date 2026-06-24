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
- `wrangler.jsonc` - Cloudflare Worker, Container, Durable Object, and R2 configuration.
- `vite.config.ts` - Vite configuration with the Cloudflare plugin.

## Requirements

- Node.js and npm.
- Wrangler access to a Cloudflare account that supports Workers, Containers, Durable Objects, and R2.

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

If your R2 bucket name differs from `doc2images`, update `wrangler.jsonc` before deploying.

## API Routes

- `POST /api/doc2image` - accepts a multipart form upload with a `file` field containing a `.docx` document and returns a ZIP of generated PNG files.
- `POST /api/upload` - accepts multipart form data and writes generated image files to the configured R2 bucket.
