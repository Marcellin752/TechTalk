import Fastify from 'fastify';

const fastify = Fastify({ logger: true });

// Health check route to ensure the API is running smoothly
fastify.get('/api/health', async (request, reply) => {
  return { status: 'OK', message: 'TechTalk API is running smoothly' };
});

const start = async () => {
  try {
    // Dynamically fetch the port from environment variables (like .env), or default to 5000
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;

    // Start the Fastify server
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Server readiness check passed on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
