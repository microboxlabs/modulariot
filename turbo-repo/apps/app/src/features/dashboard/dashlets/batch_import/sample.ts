/**
 * Generic sample data — used by the "Load sample" button inside the widget.
 * Not tied to any domain or backend endpoint. Purely for letting a user see
 * the full flow (parse → preview → import) without having a real file on hand.
 */
export const SAMPLE_TSV = [
  ["name", "email", "role", "active"].join("\t"),
  ["Alice Johnson", "alice@example.com", "admin", "true"].join("\t"),
  ["Bob Smith", "bob@example.com", "editor", "true"].join("\t"),
  ["Carol Davis", "carol@example.com", "viewer", "true"].join("\t"),
  ["Dan Brown", "dan@example.com", "editor", "false"].join("\t"),
  ["Eve Wilson", "eve@example.com", "viewer", "true"].join("\t"),
].join("\n");
