const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: ['DATE'],   // DATE columns come back as 'YYYY-MM-DD' text (no timezone shifts)
  decimalNumbers: true     // DECIMAL columns come back as numbers, not strings
});

module.exports = pool;