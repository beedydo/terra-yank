const { createApp } = require("./server/app");
const { initDb } = require("./server/db");

const port = Number(process.env.PORT || 4000);

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});
process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});

(async () => {
  await initDb();
  const app = await createApp();
  const server = app.listen(port, () => {
    console.log(`terra-yank server listening on port ${port}`);
  });
  server.on("error", (err) => {
    console.error("Server error:", err);
  });
})().catch((err) => {
  console.error("Startup failed:", err);
  process.exit(1);
});
