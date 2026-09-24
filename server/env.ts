// Load .env (if present) before any module reads process.env.
// Variables already set in the real environment take precedence.
try {
  process.loadEnvFile();
} catch {
  // No .env file — rely on the process environment.
}
