import Fastify from 'fastify';
import cors from '@fastify/cors';
import { projectsRoutes } from './routes/projects.js';

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '127.0.0.1';

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

  app.get('/api/health', async () => ({ ok: true as const }));

  await app.register(projectsRoutes, { prefix: '/api' });

  await app.listen({ port: PORT, host: HOST });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
