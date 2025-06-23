import 'fastify';

/**
 * Represents the application configuration.
 */
export interface AppConfig {
  PORT?: number;
  HOST?: string;
  [key: string]: unknown;
}

declare module 'fastify' {
  export interface FastifyInstance {
    /**
     * The application configuration object, decorated onto the Fastify instance.
     */
    config?: AppConfig;
  }
} 