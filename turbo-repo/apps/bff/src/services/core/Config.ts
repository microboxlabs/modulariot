import EnvSchema from "env-schema";

const schema = {
  type: "object",
  required: [
    // "PORT",
    // "HOST",
    // "REDIS_URL",
    // "JWT_SECRET",
    // "SENTRY_DSN",
    // "BETTERSTACK_SOURCE_TOKEN",
  ],
  // anyOf: [
    // {
    //   required: ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME"],
    // },
    // {
    //   required: ["DATABASE_URL"],
    // },
  // ],
  properties: {
    PORT: {
      type: "number",
      default: 3030,
    },
    HOST: {
      type: "string",
      default: "0.0.0.0",
    },
    LOG_LEVEL: {
      type: "string",
      default: "error",
    },
    LOG_PRETTY: {
      type: "boolean",
      default: "false",
    },
    JWT_SECRET: {
      type: "string",
    },
    DB_HOST: {
      type: "string",
      default: "localhost",
    },
    DB_PORT: {
      type: "number",
      default: 5432,
    },
    DB_USER: {
      type: "string",
      default: "db_user",
    },
    DB_PASSWORD: {
      type: "string",
      default: "db_pass",
    },
    DB_NAME: {
      type: "string",
      default: "db_name",
    },
    DATABASE_URL: {
      type: "string",
    },
    DB_SSL: {
      type: "boolean",
      default: false,
    },
    REDIS_URL: {
      type: "string",
    },
    SWAGGER_USERNAME: {
      type: "string",
      default: "admin",
    },
    SWAGGER_PASSWORD: {
      type: "string",
      default: "admin",
    },
    SENTRY_DSN: {
      type: "string",
    },
    BETTERSTACK_SOURCE_TOKEN: {
      type: "string",
    },
  },
};

class Config {
  private config: any;

  constructor() {
    this.config = null;
  }

  async load({ envSchemaOptions = {}, overrideConfigData = null } = {}) {
    if (this.config) {
      return this.config;
    }

    const defaultConfigOptions = {
      // schema to validate
      schema: schema,
      // will read .env in root folder as the source
      dotenv: true,
      // an additional source for the data
      // is either provided by the caller to initialize config
      // or falls back to use environment variables from process.env
      // but will still only populate based on schema definition
      data: overrideConfigData ? overrideConfigData : process.env,
      // will remove the additional properties
      // from the data object which creates an
      // explicit schema
      removeAdditional: true,
    };

    // override default options above with
    const configOptions = { ...defaultConfigOptions, ...envSchemaOptions };
    this.config = EnvSchema(configOptions);

    return this.config;
  }
}

export { Config };