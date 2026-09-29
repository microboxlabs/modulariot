import { createTemplateEngine } from "@microboxlabs/miot-dashboard-ui/templates";
export {
  buildDataProviderContext,
  type TemplateField,
} from "@microboxlabs/miot-dashboard-ui/templates";
// Compatibility engine for existing app widgets; no global helper registration.
const engine = createTemplateEngine();
export const compileTemplates = engine.compileTemplates;
export const resolveTemplate = engine.resolveTemplate;
export const resolveHandlebarsField = engine.resolveField;
