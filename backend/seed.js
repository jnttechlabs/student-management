require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./config/db');

(async () => {
  const hash = await bcrypt.hash('Admin@123', 10);
  await db.query(
    `INSERT IGNORE INTO users (name,email,password,role)
     VALUES ('Administrator','admin@school.com',?,'admin')`, [hash]);
  console.log('Admin ready → admin@school.com / Admin@123');
  process.exit();
})();