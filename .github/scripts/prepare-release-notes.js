const fs = require("node:fs");

// Filter before prompting: a platform writer never receives client-release data.
function preparePrompts(template, issues, metadata, outputDirectory = ".") {
  const audiences = {
    coordinator: {
      version: metadata.release_notes_version,
      scope: "Coordinador: alcance del milestone privado y sus integraciones OSS.",
      private_milestone: metadata.private_milestone,
      source_guidance: "Marca los cambios OSS como integración del milestone indicado.",
      issues: issues.filter((issue) =>
        (issue.source === "release" && issue.milestone === metadata.private_milestone) ||
        (issue.source === "oss" && issue.milestone === metadata.oss_milestone)),
    },
    platform: {
      version: metadata.release_version,
      scope: "Plataforma ModularIoT: exclusivamente el milestone OSS indicado. No incluir cambios de clientes.",
      private_milestone: "No aplica",
      source_guidance: "Los issues OSS son las features de esta versión de la plataforma, no integraciones de una versión de cliente.",
      issues: issues.filter((issue) =>
        issue.source === "oss" && issue.milestone === metadata.oss_milestone),
    },
  };
  for (const [audience, note] of Object.entries(audiences)) {
    const values = {
      ...metadata,
      ...note,
      release_version: note.version,
      release_scope: note.scope,
      release_issues: JSON.stringify(note.issues, null, 2).split("\n").join("\n      "),
    };
    // Single-pass substitution keeps issue text containing {{...}} literal.
    const prompt = template.replace(/\{\{([a-z_]+)\}\}/g, (token, key) => values[key] ?? token);
    fs.writeFileSync(`${outputDirectory}/release-notes-${audience}.prompt.yml`, prompt);
  }
}

if (require.main === module) {
  preparePrompts(
    fs.readFileSync(".github/prompts/app-release-notes.prompt.yml", "utf8"),
    JSON.parse(fs.readFileSync("release-issues.json", "utf8")),
    JSON.parse(process.env.RELEASE_NOTES_METADATA)
  );
}

module.exports = { preparePrompts };
