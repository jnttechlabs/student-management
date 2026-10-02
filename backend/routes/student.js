const router = require('express').Router();
const db = require('../config/db');

router.get('/profile', async (req, res) => {
  const [rows] = await db.query(
    'SELECT id,name,email,role,created_at FROM users WHERE id=?', [req.user.id]);
  res.json(rows[0]);
});

/* ---------- CLASSES: browse all, enroll / leave yourself ---------- */
router.get('/classes', async (req, res) => {
  const [rows] = await db.query(
    `SELECT c.id, c.name, c.description, u.name AS faculty,
            (e.student_id IS NOT NULL) AS enrolled
     FROM classes c
     JOIN users u ON u.id=c.faculty_id
     LEFT JOIN enrollments e ON e.class_id=c.id AND e.student_id=?
     ORDER BY c.name`, [req.user.id]);
  res.json(rows.map(r => ({ ...r, enrolled: !!r.enrolled })));
});

router.post('/classes/:id/enroll', async (req, res) => {
  const [c] = await db.query('SELECT id FROM classes WHERE id=?', [req.params.id]);
  if (!c.length) return res.status(404).json({ message: 'Class not found' });
  await db.query('INSERT IGNORE INTO enrollments (class_id,student_id) VALUES (?,?)',
    [req.params.id, req.user.id]);
  res.status(201).json({ message: 'Enrolled successfully' });
});

router.delete('/classes/:id/enroll', async (req, res) => {
  await db.query('DELETE FROM enrollments WHERE class_id=? AND student_id=?',
    [req.params.id, req.user.id]);
  res.json({ message: 'Left the class' });
});

/* ---------- ASSESSMENTS: view (from my classes) and submit answers ---------- */
router.get('/assessments', async (req, res) => {
  const [rows] = await db.query(
    `SELECT a.id, a.title, a.description, a.due_date, a.max_marks, c.name AS class_name,
            s.id AS submission_id, s.answer, s.submitted_at, s.score, s.feedback
     FROM assessments a
     JOIN classes c ON c.id=a.class_id
     JOIN enrollments e ON e.class_id=c.id AND e.student_id=?
     LEFT JOIN submissions s ON s.assessment_id=a.id AND s.student_id=?
     ORDER BY a.id DESC`, [req.user.id, req.user.id]);
  res.json(rows);
});

router.post('/assessments/:id/submit', async (req, res) => {
  const answer = String(req.body.answer || '').trim();
  if (!answer) return res.status(400).json({ message: 'Answer cannot be empty' });
  const [rows] = await db.query(
    `SELECT a.id, s.score FROM assessments a
     JOIN enrollments e ON e.class_id=a.class_id AND e.student_id=?
     LEFT JOIN submissions s ON s.assessment_id=a.id AND s.student_id=?
     WHERE a.id=?`, [req.user.id, req.user.id, req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'Assessment not found in your classes' });
  if (rows[0].score !== null) return res.status(409).json({ message: 'Already graded, answer cannot be changed' });
  await db.query(
    `INSERT INTO submissions (assessment_id,student_id,answer) VALUES (?,?,?)
     ON DUPLICATE KEY UPDATE answer=VALUES(answer), submitted_at=NOW()`,
    [req.params.id, req.user.id, answer]);
  res.status(201).json({ message: 'Answer submitted' });
});

/* ---------- ATTENDANCE (own records only) ---------- */
router.get('/attendance', async (req, res) => {
  const [records] = await db.query(
    `SELECT c.name AS class_name, att.att_date, att.status
     FROM attendance att JOIN classes c ON c.id=att.class_id
     WHERE att.student_id=? ORDER BY att.att_date DESC, c.name`, [req.user.id]);
  const [sum] = await db.query(
    `SELECT c.name AS class_name, COUNT(*) AS total, SUM(att.status='present') AS present
     FROM attendance att JOIN classes c ON c.id=att.class_id
     WHERE att.student_id=? GROUP BY c.id, c.name`, [req.user.id]);
  const summary = sum.map(s => ({
    class_name: s.class_name, total: s.total, present: Number(s.present),
    percentage: Math.round((Number(s.present) / s.total) * 100)
  }));
  res.json({ summary, records });
});

/* ---------- MARKS & GRADES (own records only) ---------- */
router.get('/marks', async (req, res) => {
  const [rows] = await db.query(
    `SELECT m.id, c.name AS class_name, m.exam_name, m.marks_obtained, m.max_marks, m.grade,
            ROUND(m.marks_obtained / m.max_marks * 100, 1) AS percentage
     FROM marks m JOIN classes c ON c.id=m.class_id
     WHERE m.student_id=? ORDER BY m.id DESC`, [req.user.id]);
  res.json(rows);
});

module.exports = router;
