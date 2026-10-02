const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');

// View users by role: GET /api/admin/users?role=faculty
router.get('/users', async (req, res) => {
  let sql = "SELECT id,name,email,role,created_at FROM users WHERE role<>'admin'";
  const params = [];
  if (req.query.role) { sql += ' AND role=?'; params.push(req.query.role); }
  const [rows] = await db.query(sql + ' ORDER BY id DESC', params);
  res.json(rows);
});

// Create faculty/student
router.post('/users', async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!['faculty', 'student'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }
  const hash = await bcrypt.hash(password, 10);
  await db.query('INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)',
    [name, email, hash, role]);
  res.status(201).json({ message: 'User created' });
});

// Update (password optional)
router.put('/users/:id', async (req, res) => {
  const { name, email, password } = req.body;
  if (password) {
    const hash = await bcrypt.hash(password, 10);
    await db.query("UPDATE users SET name=?,email=?,password=? WHERE id=? AND role<>'admin'",
      [name, email, hash, req.params.id]);
  } else {
    await db.query("UPDATE users SET name=?,email=? WHERE id=? AND role<>'admin'",
      [name, email, req.params.id]);
  }
  res.json({ message: 'User updated' });
});

// Delete
router.delete('/users/:id', async (req, res) => {
  await db.query("DELETE FROM users WHERE id=? AND role<>'admin'", [req.params.id]);
  res.json({ message: 'User deleted' });
});

module.exports = router;