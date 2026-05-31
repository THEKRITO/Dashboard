const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'smarthome',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function initDB() {
  try {
    // Initial connection without database to ensure it exists
    const setupConn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || ''
    });
    await setupConn.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'smarthome'}\``);
    await setupConn.end();

    const conn = await pool.getConnection();
    console.log('Database connected successfully.');

    // Create users table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        provider ENUM('local', 'github') DEFAULT 'local'
      )
    `);

    // Create sensor_logs table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS sensor_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        outside_temp FLOAT,
        cpu_temp FLOAT
      )
    `);

    // Seed default admin if empty
    const [rows] = await conn.query('SELECT COUNT(*) as count FROM users WHERE provider = "local"');
    if (rows[0].count === 0) {
      console.log('Seeding default admin user...');
      const adminUser = process.env.LOCAL_USERNAME || 'admin';
      const adminPass = process.env.LOCAL_PASSWORD_HASH;
      await conn.query('INSERT INTO users (username, password_hash, provider) VALUES (?, ?, "local")', [adminUser, adminPass]);
    }

    conn.release();
    console.log('Database initialization complete.');
  } catch (err) {
    console.error('Error initializing database:', err);
    // If DB doesn't exist, we might need to create it first, 
    // but usually user creates the DB and we create tables.
  }
}

module.exports = { pool, initDB };
