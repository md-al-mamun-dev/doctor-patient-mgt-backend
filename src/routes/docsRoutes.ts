import { Router, type Request, type Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const docsRoutes = Router();

// Resolve paths to openapi.yaml
// In development: src/routes/../../openapi/openapi.yaml
// In production: dist/routes/../../openapi/openapi.yaml or dist/openapi.yaml
const resolveOpenApiPath = (): string => {
  const candidatePaths = [
    path.resolve(process.cwd(), 'openapi/openapi.yaml'),
    path.resolve(__dirname, '../../openapi/openapi.yaml'),
    path.resolve(__dirname, '../openapi/openapi.yaml'),
    path.resolve(process.cwd(), 'dist/openapi.yaml'),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return candidatePaths[0];
};

/**
 * Serves the canonical OpenAPI 3.1 YAML specification
 */
docsRoutes.get('/openapi.yaml', (_req: Request, res: Response): void => {
  const specPath = resolveOpenApiPath();
  if (!fs.existsSync(specPath)) {
    res.status(404).type('text/plain').send('OpenAPI specification file not found');
    return;
  }
  res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
  res.sendFile(specPath);
});

/**
 * Serves the Redoc Community Edition documentation UI
 */
docsRoutes.get('/api-docs', (_req: Request, res: Response): void => {
  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Doctor & Patient Management API — Redoc</title>
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%230284c7'><path d='M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z'/></svg>" />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
      }
    </style>
  </head>
  <body>
    <div id="redoc-container"></div>
    <script src="https://cdn.redoc.ly/redoc/v2.4.0/bundles/redoc.standalone.js"></script>
    <script>
      Redoc.init(
        '/openapi.yaml',
        {
          scrollYOffset: 0,
          hideDownloadButton: false,
          theme: {
            colors: {
              primary: {
                main: '#0284c7'
              }
            },
            typography: {
              fontSize: '15px',
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
              headings: {
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                fontWeight: '600'
              }
            },
            sidebar: {
              backgroundColor: '#0f172a',
              textColor: '#e2e8f0',
              activeTextColor: '#38bdf8'
            }
          }
        },
        document.getElementById('redoc-container')
      );
    </script>
  </body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

