// Side-effect import: load .env into process.env before any other module
// (notably app.module's TypeORM config) reads from it. Imported first in main.ts.
// In CommonJS output, imports execute top-to-bottom, so importing this module
// ahead of AppModule guarantees the env is populated in time.
try {
  process.loadEnvFile();
} catch {
  // No .env file present — rely on the ambient environment (Docker/CI).
}
