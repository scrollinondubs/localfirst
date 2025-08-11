export default {
  schema: "./src/db/schema.js",
  out: "./src/db/migrations",
  driver: "libsql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "file:./local.db",
    authToken: process.env.DATABASE_AUTH_TOKEN
  }
};