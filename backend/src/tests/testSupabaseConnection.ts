import { Pool } from 'pg';
import { config } from '../config';

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: { rejectUnauthorized: false }
});

async function testConnection() {
  try {
    console.log('Connecting to Supabase PostgreSQL at:', config.supabaseUrl);
    const client = await pool.connect();
    const res = await client.query('SELECT NOW() as current_time, version() as server_version;');
    console.log('Successfully connected to Supabase PostgreSQL!');
    console.log('Current time:', res.rows[0].current_time);
    console.log('Server version:', res.rows[0].server_version);
    client.release();
    await pool.end();
  } catch (err) {
    console.error('Failed to connect to Supabase PostgreSQL:', err);
    process.exit(1);
  }
}

testConnection();
