/**
 * Handlebars template utilities — moved to @microboxlabs/miot-dashboard-ui (P3).
 *
 * This shim keeps existing app import paths working during the extraction;
 * new code should import from the package directly.
 */

export type { TemplateField } from "@microboxlabs/miot-dashboard-ui";

export {
  compileTemplates,
  resolveTemplate,
  resolveHandlebarsField,
  buildDataProviderContext,
} from "@microboxlabs/miot-dashboard-ui";
