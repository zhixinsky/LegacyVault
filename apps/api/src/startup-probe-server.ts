import { createServer, type Server } from 'node:http';

export function startStartupProbeServer(port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', phase: 'bootstrapping' }));
    });

    server.once('error', reject);
    server.listen(port, '0.0.0.0', () => {
      console.log(`[startup] 临时探针服务已监听 0.0.0.0:${port}`);
      resolve(server);
    });
  });
}

export async function stopStartupProbeServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}
