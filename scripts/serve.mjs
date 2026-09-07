import { createServer } from 'node:http';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPublicFile, requestedPublicFile } from './public-files.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.bin': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
};

export function createPublicServer(root = projectRoot) {
  return createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Method not allowed.');
      return;
    }
    const name = requestedPublicFile(request.url);
    if (name) {
      try {
        const body = await readPublicFile(root, name);
        response.writeHead(200, { 'Content-Type': types[extname(name)], 'Content-Length': body.length });
        response.end(request.method === 'HEAD' ? undefined : body);
        return;
      } catch {
        // Missing files and prohibited links have the same public response.
      }
    }
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(request.method === 'HEAD' ? undefined : 'Not found.');
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const configuredPort = process.env.PORT ?? '4173';
  if (!/^\d+$/.test(configuredPort) || Number(configuredPort) > 65535) {
    throw new Error('PORT must be a whole number between 0 and 65535.');
  }
  const server = createPublicServer();
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(Number(configuredPort), '127.0.0.1', () => {
    console.log(`Signature editor: http://127.0.0.1:${server.address().port}`);
    console.log('Only allowlisted public files are served. Press Ctrl+C to stop.');
  });
}
