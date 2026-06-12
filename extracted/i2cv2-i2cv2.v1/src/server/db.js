const { createClient } = require("@libsql/client");

let client;

function initDb() {
  client = createClient({ url: "file:./i2cv2-auth.db" });
  return client.execute(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, key)
    )
  `);
}

async function getUserSetting(userId, key) {
  const result = await client.execute({
    sql: "SELECT value FROM user_settings WHERE user_id = ? AND key = ?",
    args: [userId, key],
  });
  if (!result.rows.length) return null;
  return JSON.parse(result.rows[0].value);
}

async function setUserSetting(userId, key, value) {
  await client.execute({
    sql: `INSERT INTO user_settings (user_id, key, value, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    args: [userId, key, JSON.stringify(value), new Date().toISOString()],
  });
}

async function deleteUserSetting(userId, key) {
  await client.execute({
    sql: "DELETE FROM user_settings WHERE user_id = ? AND key = ?",
    args: [userId, key],
  });
}

module.exports = { initDb, getUserSetting, setUserSetting, deleteUserSetting };
