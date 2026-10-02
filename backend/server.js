require('dotenv').config();
require('express-async-errors');
const express = require('express');
const cors = require('cors');
const path = require('path');
const { verifyToken, allowRoles } = require('./middleware/auth');

const app = express();
app.use(cors());
app.use('/lib/angular',       express.static(path.join(__dirname, 'node_modules/angular')));
app.use('/lib/angular-route', express.static(path.join(__dirname, 'node_modules/angular-route')));
app.use('/lib/bootstrap',     express.static(path.join(__dirname, 'node_modules/bootstrap/dist')));
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin',   verifyToken, allowRoles('admin'),   require('./routes/admin'));
app.use('/api/faculty', verifyToken, allowRoles('faculty'), require('./routes/faculty'));
app.use('/api/student', verifyToken, allowRoles('student'), require('./routes/student'));

// Serve AngularJS frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ message: 'Email already exists' });
  }
  res.status(500).json({ message: 'Server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));