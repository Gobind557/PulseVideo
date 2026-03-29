import http from 'node:http';
import { createApp } from './app/createApp.js';
import { createAppContainer } from './app/container.js';
import { loadEnvConfig } from './config/env.js';
import { attachSocketServer } from './infrastructure/socket/socket.server.js';

async function main() {
  const env = loadEnvConfig();
  const container = await createAppContainer(env);
  const app = createApp(env, container);
  const httpServer = http.createServer(app);
  attachSocketServer(httpServer, env, container.redis);

  httpServer.listen(env.PORT, () => {
    console.log(`API + WebSocket listening on http://localhost:${env.PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
