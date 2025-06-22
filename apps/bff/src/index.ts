import Fastify from 'fastify'

const fastify = Fastify({
  logger: true
});

// Declare a route
fastify.get('/', function (request, reply) {
  reply.send({ hello: 'world' })
})

const getPort = (): number => {
  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1) {
    const portStr = process.argv[portArgIndex + 1];
    if (portStr) {
      const port = parseInt(portStr, 10);
      if (!isNaN(port)) {
        return port;
      }
    }
  }
  return 3000; // Default port
};

const port = getPort();

// Run the server!
fastify.listen({ port }, function (err, address) {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  }
  fastify.log.info(`server listening on ${address}`)
})