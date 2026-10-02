-- Run AFTER schema.sql (fresh install) or on your existing database (upgrade).
-- WARNING: this drops the old student-owned "assessments" table and its data.
USE student_mgmt;

DROP TABLE IF EXISTS submissions;
DROP TABLE IF EXISTS assessments;

-- Assessments are now created by faculty for a class
CREATE TABLE assessments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  class_id INT NOT NULL,
  title VARCHAR(150) NOT NULL,
  description TEXT,
  due_date DATE,
  max_marks INT NOT NULL DEFAULT 100,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

-- Student answers + faculty grading
CREATE TABLE submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  assessment_id INT NOT NULL,
  student_id INT NOT NULL,
  answer TEXT NOT NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  score DECIMAL(6,2) NULL,
  feedback VARCHAR(255) NULL,
  graded_at TIMESTAMP NULL,
  UNIQUE KEY uq_submission (assessment_id, student_id),
  FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Attendance: one row per student per class per day
CREATE TABLE IF NOT EXISTS attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  class_id INT NOT NULL,
  student_id INT NOT NULL,
  att_date DATE NOT NULL,
  status ENUM('present','absent') NOT NULL,
  UNIQUE KEY uq_attendance (class_id, student_id, att_date),
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Marks / results: one row per student per exam per class
CREATE TABLE IF NOT EXISTS marks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  class_id INT NOT NULL,
  student_id INT NOT NULL,
  exam_name VARCHAR(100) NOT NULL,
  marks_obtained DECIMAL(6,2) NOT NULL,
  max_marks DECIMAL(6,2) NOT NULL DEFAULT 100,
  grade VARCHAR(2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_marks (class_id, student_id, exam_name),
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);
