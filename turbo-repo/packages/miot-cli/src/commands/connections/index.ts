import type { Command } from "commander";
import type {
  AuthType,
  ProviderType,
} from "@microboxlabs/miot-connection-client";
import { getActionContext } from "../../action-context.js";
import { printDetail, printJson, printTable } from "../../output.js";
import { handleError } from "../../utils/error.js";
import { parseJsonObject } from "../../utils/json.js";

const PROVIDER_TYPES: ProviderType[] = [
  "POSTGREST",
  "ALERCE_TMS",
  "N8N",
  "AUTH0",
  "ECM",
  "CUSTOM_HTTP",
];

const AUTH_TYPES: AuthType[] = [
  "NONE",
  "BEARER_TOKEN",
  "API_KEY_HEADER",
  "API_KEY_QUERY",
  "BASIC",
  "OAUTH2_CLIENT_CREDENTIALS",
  "CUSTOM_HEADERS",
];

function parseProviderType(value: string): ProviderType {
  if (!PROVIDER_TYPES.includes(value as ProviderType)) {
    throw new Error(
      `Invalid provider type "${value}". Must be one of: ${PROVIDER_TYPES.join(", ")}`,
    );
  }
  return value as ProviderType;
}

function parseAuthType(value: string): AuthType {
  if (!AUTH_TYPES.includes(value as AuthType)) {
    throw new Error(
      `Invalid auth type "${value}". Must be one of: ${AUTH_TYPES.join(", ")}`,
    );
  }
  return value as AuthType;
}

export function registerConnectionsCommand(program: Command): void {
  const connections = program
    .command("connections")
    .description("Manage integration connections");

  registerCredentialProfilesCommand(connections);
  registerConnectionCommands(connections);
  registerOperationsCommand(connections);
}

function registerCredentialProfilesCommand(parent: Command): void {
  const profiles = parent
    .command("profiles")
    .description("Manage integration credential profiles");

  profiles
    .command("list")
    .description("List credential profiles")
    .action(async (_opts, cmd) => {
      const { client, outputMode } = getActionContext(cmd);
      try {
        const result = await client.credentialProfiles.list();

        if (outputMode === "json") {
          printJson(result);
        } else {
          printTable(result, [
            { header: "ID", key: "id" },
            { header: "DISPLAY NAME", key: "displayName" },
            { header: "AUTH", key: "authType" },
            { header: "SECRET", key: "secretPreview" },
            { header: "VERSION", key: "secretVersion" },
            { header: "UPDATED", key: "updatedAt" },
          ]);
        }
      } catch (err) {
        handleError(err, outputMode);
      }
    });

  profiles
    .command("create")
    .description("Create a credential profile")
    .requiredOption("--display-name <name>", "Display name")
    .requiredOption("--auth-type <type>", `Auth type (${AUTH_TYPES.join(", ")})`)
    .option("--public-config-json <json>", "Public auth config JSON object")
    .option("--secret-config-json <json>", "Secret auth config JSON object")
    .action(async (_opts, cmd) => {
      const { client, outputMode } = getActionContext(cmd);
      try {
        const opts = cmd.opts() as {
          displayName: string;
          authType: string;
          publicConfigJson?: string;
          secretConfigJson?: string;
        };

        const result = await client.credentialProfiles.create({
          displayName: opts.displayName,
          authType: parseAuthType(opts.authType),
          publicConfig: parseJsonObject(
            opts.publicConfigJson,
            "--public-config-json",
          ),
          secretConfig: parseJsonObject(
            opts.secretConfigJson,
            "--secret-config-json",
          ),
        });

        if (outputMode === "json") {
          printJson(result);
        } else {
          printDetail(result);
        }
      } catch (err) {
        handleError(err, outputMode);
      }
    });
}

function registerConnectionCommands(parent: Command): void {
  parent
    .command("list")
    .description("List integration connections")
    .action(async (_opts, cmd) => {
      const { client, outputMode } = getActionContext(cmd);
      try {
        const result = await client.connections.list();

        if (outputMode === "json") {
          printJson(result);
        } else {
          printTable(result, [
            { header: "ID", key: "id" },
            { header: "NAME", key: "name" },
            { header: "PROVIDER", key: "providerType" },
            { header: "STATUS", key: "status" },
            { header: "BASE URL", key: "baseUrl" },
            { header: "LAST TEST", key: "lastTestedAt" },
            { header: "RESULT", key: "lastTestResult" },
          ]);
        }
      } catch (err) {
        handleError(err, outputMode);
      }
    });

  parent
    .command("get <id>")
    .description("Get an integration connection")
    .action(async (id: string, _opts, cmd) => {
      const { client, outputMode } = getActionContext(cmd);
      try {
        const result = await client.connections.get(id);

        if (outputMode === "json") {
          printJson(result);
        } else {
          printDetail(result);
        }
      } catch (err) {
        handleError(err, outputMode);
      }
    });

  parent
    .command("create")
    .description("Create an integration connection")
    .requiredOption("--name <name>", "Connection name")
    .requiredOption("--provider <type>", `Provider type (${PROVIDER_TYPES.join(", ")})`)
    .requiredOption("--provider-base-url <url>", "Provider base URL")
    .requiredOption("--credential-profile <id>", "Credential profile ID")
    .option("--metadata-json <json>", "Connection metadata JSON object")
    .action(async (_opts, cmd) => {
      const { client, outputMode } = getActionContext(cmd);
      try {
        const opts = cmd.opts() as {
          name: string;
          provider: string;
          providerBaseUrl: string;
          credentialProfile: string;
          metadataJson?: string;
        };

        const result = await client.connections.create({
          name: opts.name,
          providerType: parseProviderType(opts.provider),
          baseUrl: opts.providerBaseUrl,
          credentialProfileId: opts.credentialProfile,
          metadata: parseJsonObject(opts.metadataJson, "--metadata-json"),
        });

        if (outputMode === "json") {
          printJson(result);
        } else {
          printDetail(result);
        }
      } catch (err) {
        handleError(err, outputMode);
      }
    });

  parent
    .command("test <id>")
    .description("Test an integration connection")
    .option("--method <method>", "HTTP method for contract test")
    .option("--path <path>", "Provider path for contract test")
    .action(async (id: string, _opts, cmd) => {
      const { client, outputMode } = getActionContext(cmd);
      try {
        const opts = cmd.opts() as {
          method?: string;
          path?: string;
        };

        const result = await client.connections.test(id, {
          method: opts.method,
          path: opts.path,
        });

        if (outputMode === "json") {
          printJson(result);
        } else {
          printDetail(result);
        }
      } catch (err) {
        handleError(err, outputMode);
      }
    });
}

function registerOperationsCommand(parent: Command): void {
  const operations = parent
    .command("operations")
    .description("Manage integration connection operations");

  operations
    .command("list <connectionId>")
    .description("List operations for a connection")
    .action(async (connectionId: string, _opts, cmd) => {
      const { client, outputMode } = getActionContext(cmd);
      try {
        const result = await client.connections.listOperations(connectionId);

        if (outputMode === "json") {
          printJson(result);
        } else {
          printTable(result, [
            { header: "ID", key: "id" },
            { header: "NAME", key: "name" },
            { header: "METHOD", key: "method" },
            { header: "PATH", key: "path" },
            { header: "TEST", key: "testOperation" },
          ]);
        }
      } catch (err) {
        handleError(err, outputMode);
      }
    });

  operations
    .command("create <connectionId>")
    .description("Create an operation for a connection")
    .requiredOption("--name <name>", "Operation name")
    .requiredOption("--method <method>", "HTTP method")
    .requiredOption("--path <path>", "Provider path")
    .option("--request-schema-json <json>", "Request schema JSON object")
    .option("--response-schema-json <json>", "Response schema JSON object")
    .option("--test-operation", "Mark this operation as the connection test operation")
    .action(async (connectionId: string, _opts, cmd) => {
      const { client, outputMode } = getActionContext(cmd);
      try {
        const opts = cmd.opts() as {
          name: string;
          method: string;
          path: string;
          requestSchemaJson?: string;
          responseSchemaJson?: string;
          testOperation?: boolean;
        };

        const result = await client.connections.createOperation(connectionId, {
          name: opts.name,
          method: opts.method,
          path: opts.path,
          requestSchema: parseJsonObject(
            opts.requestSchemaJson,
            "--request-schema-json",
          ),
          responseSchema: parseJsonObject(
            opts.responseSchemaJson,
            "--response-schema-json",
          ),
          testOperation: opts.testOperation,
        });

        if (outputMode === "json") {
          printJson(result);
        } else {
          printDetail(result);
        }
      } catch (err) {
        handleError(err, outputMode);
      }
    });
}
