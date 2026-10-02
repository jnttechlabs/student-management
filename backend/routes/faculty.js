const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const num = v => (v === null || v === undefined || v === '') ? NaN : Number(v);
const gradeOf = (m, max) => {
  const p = (m / max) * 100;
  return p >= 90 ? 'A+' : p >= 80 ? 'A' : p >= 70 ? 'B' : p >= 60 ? 'C' : p >= 50 ? 'D' : 'F';
};

// Make sure the class in the URL belongs to the logged-in faculty
const ownClass = async (req, res, next) => {
  const [rows] = await db.query('SELECT id FROM classes WHERE id=? AND faculty_id=?',
    [req.params.classId, req.user.id]);
  if (!rows.length) return res.status(404).json({ message: 'Class not found' });
  next();
};

/* ---------- STUDENTS ---------- */
router.get('/students', async (req, res) => {
  const [rows] = await db.query(
    "SELECT id,name,email,created_at FROM users WHERE role='student' ORDER BY id DESC");
  res.json(rows);
});

router.post('/students', async (req, res) => {
  const { name, email, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  await db.query("INSERT INTO users (name,email,password,role) VALUES (?,?,?,'student')",
    [name, email, hash]);
  res.status(201).json({ message: 'Student registered' });
});

router.put('/students/:id', async (req, res) => {
  const { name, email } = req.body;
  await db.query("UPDATE users SET name=?,email=? WHERE id=? AND role='student'",
    [name, email, req.params.id]);
  res.json({ message: 'Student updated' });
});

router.delete('/students/:id', async (req, res) => {
  await db.query("DELETE FROM users WHERE id=? AND role='student'", [req.params.id]);
  res.json({ message: 'Student deleted' });
});

/* ---------- CLASSES (only the faculty's own) ---------- */
router.get('/classes', async (req, res) => {
  const [rows] = await db.query(
    `SELECT c.*, (SELECT COUNT(*) FROM enrollments e WHERE e.class_id=c.id) AS student_count
     FROM classes c WHERE faculty_id=? ORDER BY c.id DESC`, [req.user.id]);
  res.json(rows);
});

router.post('/classes', async (req, res) => {
  const { name, description } = req.body;
  await db.query('INSERT INTO classes (name,description,faculty_id) VALUES (?,?,?)',
    [name, description, req.user.id]);
  res.status(201).json({ message: 'Class created' });
});

router.put('/classes/:id', async (req, res) => {
  const { name, description } = req.body;
  await db.query('UPDATE classes SET name=?,description=? WHERE id=? AND faculty_id=?',
    [name, description, req.params.id, req.user.id]);
  res.json({ message: 'Class updated' });
});

router.delete('/classes/:id', async (req, res) => {
  await db.query('DELETE FROM classes WHERE id=? AND faculty_id=?',
    [req.params.id, req.user.id]);
  res.json({ message: 'Class deleted' });
});

/* ---------- ROSTER (students enroll themselves; faculty can view/remove) ---------- */
router.get('/classes/:classId/students', ownClass, async (req, res) => {
  const [rows] = await db.query(
    `SELECT u.id,u.name,u.email FROM enrollments e
     JOIN users u ON u.id=e.student_id WHERE e.class_id=? ORDER BY u.name`, [req.params.classId]);
  res.json(rows);
});

router.delete('/classes/:classId/students/:studentId', ownClass, async (req, res) => {
  await db.query('DELETE FROM enrollments WHERE class_id=? AND student_id=?',
    [req.params.classId, req.params.studentId]);
  res.json({ message: 'Student removed from class' });
});

/* ---------- ASSESSMENTS (faculty creates, students answer) ---------- */
router.get('/classes/:classId/assessments', ownClass, async (req, res) => {
  const [rows] = await db.query(
    `SELECT a.*,
       (SELECT COUNT(*) FROM submissions s WHERE s.assessment_id=a.id) AS submitted,
       (SELECT COUNT(*) FROM submissions s WHERE s.assessment_id=a.id AND s.score IS NOT NULL) AS graded
     FROM assessments a WHERE a.class_id=? ORDER BY a.id DESC`, [req.params.classId]);
  res.json(rows);
});

router.post('/classes/:classId/assessments', ownClass, async (req, res) => {
  const { title, description, due_date, max_marks } = req.body;
  if (!title) return res.status(400).json({ message: 'Title is required' });
  if (due_date && !DATE_RE.test(due_date)) return res.status(400).json({ message: 'Invalid date' });
  const max = num(max_marks) > 0 ? num(max_marks) : 100;
  await db.query(
    'INSERT INTO assessments (class_id,title,description,due_date,max_marks) VALUES (?,?,?,?,?)',
    [req.params.classId, title, description || null, due_date || null, max]);
  res.status(201).json({ message: 'Assessment created' });
});

router.put('/assessments/:id', async (req, res) => {
  const { title, description, due_date, max_marks } = req.body;
  if (due_date && !DATE_RE.test(due_date)) return res.status(400).json({ message: 'Invalid date' });
  const max = num(max_marks) > 0 ? num(max_marks) : 100;
  await db.query(
    `UPDATE assessments a JOIN classes c ON c.id=a.class_id
     SET a.title=?, a.description=?, a.due_date=?, a.max_marks=?
     WHERE a.id=? AND c.faculty_id=?`,
    [title, description || null, due_date || null, max, req.params.id, req.user.id]);
  res.json({ message: 'Assessment updated' });
});

router.delete('/assessments/:id', async (req, res) => {
  await db.query(
    `DELETE a FROM assessments a JOIN classes c ON c.id=a.class_id
     WHERE a.id=? AND c.faculty_id=?`, [req.params.id, req.user.id]);
  res.json({ message: 'Assessment deleted' });
});

// All enrolled students with their answer (if any)
router.get('/assessments/:id/submissions', async (req, res) => {
  const [rows] = await db.query(
    `SELECT u.id AS student_id, u.name, s.id AS submission_id, s.answer,
            s.submitted_at, s.score, s.feedback
     FROM assessments a
     JOIN classes c ON c.id=a.class_id AND c.faculty_id=?
     JOIN enrollments e ON e.class_id=c.id
     JOIN users u ON u.id=e.student_id
     LEFT JOIN submissions s ON s.assessment_id=a.id AND s.student_id=u.id
     WHERE a.id=? ORDER BY u.name`, [req.user.id, req.params.id]);
  res.json(rows);
});

// Grade one submission
router.put('/submissions/:id/grade', async (req, res) => {
  const [rows] = await db.query(
    `SELECT s.id, a.max_marks FROM submissions s
     JOIN assessments a ON a.id=s.assessment_id
     JOIN classes c ON c.id=a.class_id
     WHERE s.id=? AND c.faculty_id=?`, [req.params.id, req.user.id]);
  if (!rows.length) return res.status(404).json({ message: 'Submission not found' });
  const score = num(req.body.score), max = rows[0].max_marks;
  if (Number.isNaN(score) || score < 0 || score > max) {
    return res.status(400).json({ message: `Score must be between 0 and ${max}` });
  }
  await db.query('UPDATE submissions SET score=?, feedback=?, graded_at=NOW() WHERE id=?',
    [score, req.body.feedback || null, req.params.id]);
  res.json({ message: 'Graded' });
});

/* ---------- ATTENDANCE ---------- */
router.get('/classes/:classId/attendance', ownClass, async (req, res) => {
  if (!DATE_RE.test(req.query.date || '')) return res.status(400).json({ message: 'Date required' });
  const [rows] = await db.query(
    `SELECT u.id AS student_id, u.name, att.status
     FROM enrollments e JOIN users u ON u.id=e.student_id
     LEFT JOIN attendance att ON att.class_id=e.class_id AND att.student_id=u.id AND att.att_date=?
     WHERE e.class_id=? ORDER BY u.name`, [req.query.date, req.params.classId]);
  res.json(rows);
});

router.post('/classes/:classId/attendance', ownClass, async (req, res) => {
  const { date, records } = req.body;
  if (!DATE_RE.test(date || '') || !Array.isArray(records)) {
    return res.status(400).json({ message: 'Date and records are required' });
  }
  const [enr] = await db.query('SELECT student_id FROM enrollments WHERE class_id=?', [req.params.classId]);
  const enrolled = new Set(enr.map(r => r.student_id));
  let saved = 0;
  for (const r of records) {
    if (!enrolled.has(Number(r.student_id)) || !['present', 'absent'].includes(r.status)) continue;
    await db.query(
      `INSERT INTO attendance (class_id,student_id,att_date,status) VALUES (?,?,?,?)
       ON DUPLICATE KEY UPDATE status=VALUES(status)`,
      [req.params.classId, r.student_id, date, r.status]);
    saved++;
  }
  res.json({ message: `Attendance saved for ${saved} student(s)` });
});

/* ---------- MARKS / RESULTS ---------- */
router.get('/classes/:classId/marks', ownClass, async (req, res) => {
  const [rows] = await db.query(
    `SELECT m.id, m.exam_name, m.marks_obtained, m.max_marks, m.grade, u.name AS student_name
     FROM marks m JOIN users u ON u.id=m.student_id
     WHERE m.class_id=? ORDER BY m.exam_name, u.name`, [req.params.classId]);
  res.json(rows);
});

// Upload marks for many students at once (saving the same exam again updates it)
router.post('/classes/:classId/marks', ownClass, async (req, res) => {
  const { exam_name, records } = req.body;
  const max = num(req.body.max_marks);
  if (!exam_name || !(max > 0) || !Array.isArray(records)) {
    return res.status(400).json({ message: 'Exam name, max marks and records are required' });
  }
  const [enr] = await db.query('SELECT student_id FROM enrollments WHERE class_id=?', [req.params.classId]);
  const enrolled = new Set(enr.map(r => r.student_id));
  const valid = [];
  for (const r of records) {
    const m = num(r.marks_obtained);
    if (!enrolled.has(Number(r.student_id)) || Number.isNaN(m)) continue;
    if (m < 0 || m > max) return res.status(400).json({ message: `Marks must be between 0 and ${max}` });
    valid.push({ id: r.student_id, m });
  }
  for (const v of valid) {
    await db.query(
      `INSERT INTO marks (class_id,student_id,exam_name,marks_obtained,max_marks,grade)
       VALUES (?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE marks_obtained=VALUES(marks_obtained),
                               max_marks=VALUES(max_marks), grade=VALUES(grade)`,
      [req.params.classId, v.id, exam_name.trim(), v.m, max, gradeOf(v.m, max)]);
  }
  res.status(201).json({ message: `Marks saved for ${valid.length} student(s)` });
});

router.delete('/marks/:id', async (req, res) => {
  await db.query(
    `DELETE m FROM marks m JOIN classes c ON c.id=m.class_id
     WHERE m.id=? AND c.faculty_id=?`, [req.params.id, req.user.id]);
  res.json({ message: 'Result deleted' });
});

module.exports = router;
