import pg from "pg";
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
pool.on("error", err => console.error("DB error", err));

export async function waitForDb(retries = 20, delayMs = 2000) {
  for (let i = 1; i <= retries; i++) {
    try { const c = await pool.connect(); c.release(); console.log("DB ready."); return; }
    catch (err) {
      console.log(`DB not ready (${i}/${retries}): ${err.message}`);
      if (i === retries) throw new Error("Cannot connect to DB.");
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}
export default pool;
