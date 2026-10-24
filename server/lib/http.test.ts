import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHttpClient, HttpError } from './http';

let server: Server;
let baseUrl = '';
let retryAttempts = 0;

beforeAll(async () => {
  server = createServer((request, response) => {
    switch (request.url) {
      case '/ok':
        response.writeHead(200, { 'content-type': 'application/json', etag: '"ok"' });
        response.end(JSON.stringify({ ok: true }));
        return;
      case '/etag':
        if (request.headers['if-none-match'] === '"etag"') {
          response.writeHead(304);
          response.end();
        } else {
          response.writeHead(200, { etag: '"etag"', 'content-type': 'application/json' });
          response.end(JSON.stringify({ value: 1 }));
        }
        return;
      case '/retry':
        retryAttempts++;
        if (retryAttempts === 1) {
          response.writeHead(500, { 'content-type': 'text/plain' });
          response.end('first attempt fails');
        } else {
          response.writeHead(200, { 'content-type': 'application/json' });
          response.end(JSON.stringify({ retried: true }));
        }
        return;
      case '/missing':
        response.writeHead(404, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ error: 'missing' }));
        return;
      case '/bad-json':
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end('{not json');
        return;
      default:
        response.writeHead(200, { 'content-type': 'text/plain' });
        response.end('ok');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test server address');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

const client = createHttpClient({ timeoutMs: 5_000, userAgent: 'WineProtonPulseTest/1.0' });

describe('HTTP client', () => {
  it('fetches JSON and exposes the ETag', async () => {
    const response = await client.getJson<{ ok: boolean }>(`${baseUrl}/ok`);
    expect(response.data).toEqual({ ok: true });
    expect(response.etag).toBe('"ok"');
    expect(response.notModified).toBe(false);
  });

  it('handles conditional requests with 304 Not Modified', async () => {
    const response = await client.getJson(`${baseUrl}/etag`, { etag: '"etag"' });
    expect(response.notModified).toBe(true);
    expect(response.data).toBeNull();
  });

  it('retries transient 500 responses', async () => {
    retryAttempts = 0;
    const response = await client.getJson<{ retried: boolean }>(`${baseUrl}/retry`);
    expect(response.data).toEqual({ retried: true });
    expect(retryAttempts).toBe(2);
  });

  it('throws a typed error for 404 responses', async () => {
    await expect(client.getJson(`${baseUrl}/missing`)).rejects.toMatchObject({
      name: 'HttpError',
      status: 404,
    } satisfies Partial<HttpError>);
  });

  it('throws on malformed JSON', async () => {
    await expect(client.getJson(`${baseUrl}/bad-json`)).rejects.toThrow('Invalid JSON');
  });

  it('fetches text bodies', async () => {
    const response = await client.getText(`${baseUrl}/text`);
    expect(response.body).toBe('ok');
    expect(response.ok).toBe(true);
  });
});
