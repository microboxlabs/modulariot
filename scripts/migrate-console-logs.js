#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Configuration
const SRC_DIR = 'src';
const EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/.next/**',
  '**/coverage/**',
  '**/*.test.js',
  '**/*.test.ts',
  '**/*.spec.js',
  '**/*.spec.ts',
  '**/public/**',
];

// Console methods to replace
const CONSOLE_METHODS = ['log', 'info', 'warn', 'error', 'debug', 'trace'];

// Context mapping based on file paths
const CONTEXT_MAPPING = {
  'auth': ['auth', 'login', 'signin', 'sign-in'],
  'api': ['api', 'route'],
  'map': ['map', 'geographic', 'position'],
  'task': ['task', 'form'],
  'user': ['user', 'profile'],
  'notification': ['notification', 'sse'],
  'database': ['db', 'database', 'alfresco'],
};

function getContextFromPath(filePath) {
  const relativePath = path.relative(SRC_DIR, filePath);
  const pathParts = relativePath.toLowerCase().split(path.sep);
  
  for (const [context, keywords] of Object.entries(CONTEXT_MAPPING)) {
    for (const keyword of keywords) {
      if (pathParts.some(part => part.includes(keyword))) {
        return context;
      }
    }
  }
  
  return 'general';
}

function findConsoleStatements(content, filePath) {
  const lines = content.split('\n');
  const consoleStatements = [];
  
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    
    // Match console.method(...) patterns
    const consoleRegex = /console\.(log|info|warn|error|debug|trace)\s*\(/g;
    let match;
    
    while ((match = consoleRegex.exec(line)) !== null) {
      const method = match[1];
      const column = match.index;
      
      consoleStatements.push({
        line: lineNumber,
        column: column + 1,
        method,
        originalLine: line.trim(),
        filePath,
      });
    }
  });
  
  return consoleStatements;
}

function generateReplacement(statement, context) {
  const { method, originalLine } = statement;
  
  // Extract the arguments from console.method(...)
  const argsMatch = originalLine.match(/console\.\w+\s*\((.*)\)/);
  if (!argsMatch) return null;
  
  const args = argsMatch[1];
  
  // Determine the appropriate logger
  const loggerName = context === 'general' ? 'logger' : `${context}Logger`;
  
  // Generate replacement based on method
  let replacement;
  
  if (method === 'error') {
    replacement = `${loggerName}.error({ err: ${args} }, "Error occurred")`;
  } else if (method === 'warn') {
    replacement = `${loggerName}.warn({ data: ${args} }, "Warning")`;
  } else if (method === 'info') {
    replacement = `${loggerName}.info({ data: ${args} }, "Info")`;
  } else if (method === 'debug') {
    replacement = `${loggerName}.debug({ data: ${args} }, "Debug")`;
  } else {
    // console.log becomes info
    replacement = `${loggerName}.info({ data: ${args} }, "Log")`;
  }
  
  return {
    original: originalLine,
    replacement: `// TODO: Replace with proper logging\n// ${originalLine}\n// ${replacement}`,
    suggestedReplacement: replacement,
  };
}

function scanFiles() {
  console.log('🔍 Scanning for console statements...\n');
  
  const pattern = path.join(SRC_DIR, '**/*.{js,jsx,ts,tsx}');
  const files = glob.sync(pattern, { ignore: EXCLUDE_PATTERNS });
  
  let totalStatements = 0;
  const results = [];
  
  files.forEach(filePath => {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const statements = findConsoleStatements(content, filePath);
      
      if (statements.length > 0) {
        const context = getContextFromPath(filePath);
        const fileResults = {
          filePath,
          context,
          statements: statements.map(stmt => ({
            ...stmt,
            replacement: generateReplacement(stmt, context),
          })),
        };
        
        results.push(fileResults);
        totalStatements += statements.length;
        
        console.log(`📁 ${filePath} (${context})`);
        console.log(`   Found ${statements.length} console statement(s)`);
        
        statements.forEach(stmt => {
          console.log(`   Line ${stmt.line}: ${stmt.original}`);
        });
        console.log('');
      }
    } catch (error) {
      console.error(`❌ Error reading ${filePath}:`, error.message);
    }
  });
  
  console.log(`\n📊 Summary:`);
  console.log(`   Files scanned: ${files.length}`);
  console.log(`   Files with console statements: ${results.length}`);
  console.log(`   Total console statements: ${totalStatements}`);
  
  return results;
}

function generateMigrationReport(results) {
  const report = {
    summary: {
      totalFiles: results.length,
      totalStatements: results.reduce((sum, file) => sum + file.statements.length, 0),
      contexts: [...new Set(results.map(file => file.context))],
    },
    files: results,
    recommendations: [
      '1. Review each console statement and replace with appropriate logger',
      '2. Use context-specific loggers (authLogger, apiLogger, etc.)',
      '3. Add structured data instead of simple strings',
      '4. Use appropriate log levels (debug, info, warn, error)',
      '5. Remove console statements after migration',
    ],
  };
  
  const reportPath = 'console-migration-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`\n📄 Migration report saved to: ${reportPath}`);
  return report;
}

function generateMigrationScript(results) {
  let script = `#!/usr/bin/env node

// Auto-generated migration script
// Run with: node migrate-console-logs.js

const fs = require('fs');

const migrations = [
`;

  results.forEach(fileResult => {
    fileResult.statements.forEach(stmt => {
      if (stmt.replacement) {
        script += `  {
    file: '${fileResult.filePath}',
    line: ${stmt.line},
    original: \`${stmt.original}\`,
    replacement: \`${stmt.replacement.suggestedReplacement}\`,
    context: '${fileResult.context}',
  },
`;
      }
    });
  });

  script += `];

console.log('Starting console.log migration...');

migrations.forEach((migration, index) => {
  try {
    const content = fs.readFileSync(migration.file, 'utf8');
    const lines = content.split('\\n');
    
    if (lines[migration.line - 1].includes('console.')) {
      lines[migration.line - 1] = lines[migration.line - 1].replace(
        migration.original,
        migration.replacement
      );
      
      fs.writeFileSync(migration.file, lines.join('\\n'));
      console.log(\`✅ Migrated \${index + 1}/\${migrations.length}: \${migration.file}:\${migration.line}\`);
    } else {
      console.log(\`⚠️  Line changed in \${migration.file}:\${migration.line}\`);
    }
  } catch (error) {
    console.error(\`❌ Error migrating \${migration.file}:\${migration.line}: \${error.message}\`);
  }
});

console.log('Migration completed!');
`;

  const scriptPath = 'scripts/apply-console-migration.js';
  fs.writeFileSync(scriptPath, script);
  fs.chmodSync(scriptPath, '755');
  
  console.log(`🔧 Migration script generated: ${scriptPath}`);
  console.log(`   Run: node ${scriptPath} to apply migrations`);
}

// Main execution
if (require.main === module) {
  try {
    const results = scanFiles();
    
    if (results.length > 0) {
      const report = generateMigrationReport(results);
      generateMigrationScript(results);
      
      console.log('\n🎯 Next Steps:');
      console.log('1. Review the migration report');
      console.log('2. Update the migration script if needed');
      console.log('3. Run the migration script');
      console.log('4. Test the application');
      console.log('5. Remove the migration script');
    } else {
      console.log('✅ No console statements found!');
    }
  } catch (error) {
    console.error('❌ Error during scan:', error.message);
    process.exit(1);
  }
}

module.exports = {
  scanFiles,
  generateMigrationReport,
  generateMigrationScript,
}; 