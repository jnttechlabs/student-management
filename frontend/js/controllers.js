app.controller('NavCtrl', function (AuthService, $location) {
  var nav = this;
  nav.auth = AuthService;
  nav.logout = function () { AuthService.logout(); $location.path('/login'); };
});

app.controller('LoginCtrl', function (AuthService, $location) {
  var vm = this;
  vm.creds = {};
  vm.login = function () {
    AuthService.login(vm.creds).then(function (user) {
      $location.path('/' + user.role);          // /admin, /faculty or /student
    }, function (err) { vm.error = err.data.message; });
  };
});

app.controller('RegisterCtrl', function ($http, $location) {
  var vm = this;
  vm.form = { role: 'student' };
  vm.register = function () {
    $http.post('/api/auth/register', vm.form).then(function () {
      $location.path('/login');
    }, function (err) { vm.error = err.data.message; });
  };
});

/* ---------------- ADMIN ---------------- */
app.controller('AdminCtrl', function ($http) {
  var vm = this;
  vm.role = 'faculty'; vm.form = {}; vm.users = [];

  vm.load = function () {
    $http.get('/api/admin/users', { params: { role: vm.role } })
      .then(function (r) { vm.users = r.data; });
  };
  vm.setRole = function (r) { vm.role = r; vm.form = {}; vm.load(); };
  vm.edit = function (u) { vm.form = angular.copy(u); };
  vm.reset = function () { vm.form = {}; };
  vm.save = function () {
    var req = vm.form.id
      ? $http.put('/api/admin/users/' + vm.form.id, vm.form)
      : $http.post('/api/admin/users', angular.extend({ role: vm.role }, vm.form));
    req.then(function () { vm.reset(); vm.load(); },
             function (e) { alert(e.data.message); });
  };
  vm.remove = function (u) {
    if (confirm('Delete ' + u.name + '?'))
      $http.delete('/api/admin/users/' + u.id).then(vm.load);
  };
  vm.load();
});

/* ---------------- FACULTY ---------------- */
app.controller('FacultyCtrl', function ($http, $filter) {
  var vm = this, api = '/api/faculty';
  var toStr  = function (d) { return d ? $filter('date')(d, 'yyyy-MM-dd') : null; };
  var toDate = function (s) { return s ? new Date(s + 'T00:00:00') : null; };
  var fail   = function (e) { alert((e.data && e.data.message) || 'Something went wrong'); };

  vm.tab = 'students'; vm.ctab = 'roster';
  vm.students = []; vm.classes = [];
  vm.sForm = {}; vm.cForm = {};
  vm.selectedClass = null; vm.enrolled = [];
  vm.assessments = []; vm.aForm = { max_marks: 100 };
  vm.selectedAssessment = null; vm.subs = [];
  vm.attDate = new Date(); vm.att = [];
  vm.mForm = { exam_name: '', max_marks: 100 }; vm.grid = []; vm.marks = [];

  /* ----- students ----- */
  vm.loadStudents = function () {
    $http.get(api + '/students').then(function (r) { vm.students = r.data; });
  };
  vm.saveStudent = function () {
    var req = vm.sForm.id
      ? $http.put(api + '/students/' + vm.sForm.id, vm.sForm)
      : $http.post(api + '/students', vm.sForm);
    req.then(function () { vm.sForm = {}; vm.loadStudents(); }, fail);
  };
  vm.editStudent = function (s) { vm.sForm = angular.copy(s); };
  vm.removeStudent = function (s) {
    if (confirm('Delete ' + s.name + '?'))
      $http.delete(api + '/students/' + s.id).then(vm.loadStudents);
  };

  /* ----- classes ----- */
  vm.loadClasses = function () {
    $http.get(api + '/classes').then(function (r) { vm.classes = r.data; });
  };
  vm.saveClass = function () {
    var req = vm.cForm.id
      ? $http.put(api + '/classes/' + vm.cForm.id, vm.cForm)
      : $http.post(api + '/classes', vm.cForm);
    req.then(function () { vm.cForm = {}; vm.loadClasses(); }, fail);
  };
  vm.editClass = function (c) { vm.cForm = angular.copy(c); };
  vm.removeClass = function (c) {
    if (confirm('Delete class ' + c.name + '?'))
      $http.delete(api + '/classes/' + c.id).then(function () {
        if (vm.selectedClass && vm.selectedClass.id === c.id) vm.selectedClass = null;
        vm.loadClasses();
      });
  };

  /* ----- open a class: roster / assessments / attendance / marks ----- */
  vm.openClass = function (c) {
    vm.selectedClass = c;
    vm.aForm = { max_marks: 100 }; vm.selectedAssessment = null;
    vm.mForm = { exam_name: '', max_marks: 100 };
    vm.setCTab('roster');
  };
  vm.setCTab = function (t) {
    vm.ctab = t;
    if (t === 'roster') vm.loadRoster();
    if (t === 'assessments') { vm.selectedAssessment = null; vm.loadAssessments(); }
    if (t === 'attendance') vm.loadAttendance();
    if (t === 'marks') vm.loadRoster().then(vm.loadMarks);
  };

  /* roster (students enroll themselves) */
  vm.loadRoster = function () {
    return $http.get(api + '/classes/' + vm.selectedClass.id + '/students').then(function (r) {
      vm.enrolled = r.data;
      vm.grid = r.data.map(function (s) { return { student_id: s.id, name: s.name, marks: null }; });
    });
  };
  vm.removeFromClass = function (s) {
    if (confirm('Remove ' + s.name + ' from this class?'))
      $http.delete(api + '/classes/' + vm.selectedClass.id + '/students/' + s.id)
        .then(function () { vm.loadRoster(); vm.loadClasses(); });
  };

  /* assessments */
  vm.loadAssessments = function () {
    $http.get(api + '/classes/' + vm.selectedClass.id + '/assessments')
      .then(function (r) { vm.assessments = r.data; });
  };
  vm.saveAssessment = function () {
    var body = angular.extend({}, vm.aForm, { due_date: toStr(vm.aForm.due_date) });
    var req = vm.aForm.id
      ? $http.put(api + '/assessments/' + vm.aForm.id, body)
      : $http.post(api + '/classes/' + vm.selectedClass.id + '/assessments', body);
    req.then(function () { vm.aForm = { max_marks: 100 }; vm.loadAssessments(); }, fail);
  };
  vm.editAssessment = function (a) {
    vm.aForm = angular.copy(a);
    vm.aForm.due_date = toDate(a.due_date);
  };
  vm.removeAssessment = function (a) {
    if (confirm('Delete assessment "' + a.title + '" and all its answers?'))
      $http.delete(api + '/assessments/' + a.id).then(function () {
        vm.selectedAssessment = null; vm.loadAssessments();
      });
  };
  vm.openSubmissions = function (a) {
    vm.selectedAssessment = a;
    $http.get(api + '/assessments/' + a.id + '/submissions').then(function (r) { vm.subs = r.data; });
  };
  vm.gradeSub = function (s) {
    $http.put(api + '/submissions/' + s.submission_id + '/grade',
      { score: s.score, feedback: s.feedback })
      .then(function () { s.saved = true; vm.loadAssessments(); }, fail);
  };

  /* attendance */
  vm.loadAttendance = function () {
    if (!vm.attDate) return;
    $http.get(api + '/classes/' + vm.selectedClass.id + '/attendance',
      { params: { date: toStr(vm.attDate) } }).then(function (r) {
        vm.att = r.data.map(function (x) { x.status = x.status || 'present'; return x; });
      });
  };
  vm.markAll = function (status) { vm.att.forEach(function (x) { x.status = status; }); };
  vm.saveAttendance = function () {
    $http.post(api + '/classes/' + vm.selectedClass.id + '/attendance', {
      date: toStr(vm.attDate),
      records: vm.att.map(function (x) { return { student_id: x.student_id, status: x.status }; })
    }).then(function (r) { alert(r.data.message); vm.loadAttendance(); }, fail);
  };

  /* marks / results */
  vm.loadMarks = function () {
    $http.get(api + '/classes/' + vm.selectedClass.id + '/marks')
      .then(function (r) { vm.marks = r.data; });
  };
  vm.saveMarks = function () {
    var records = vm.grid.filter(function (g) {
      return g.marks !== null && g.marks !== undefined && g.marks !== '';
    }).map(function (g) { return { student_id: g.student_id, marks_obtained: g.marks }; });
    if (!vm.mForm.exam_name || !records.length) {
      alert('Enter an exam name and marks for at least one student'); return;
    }
    $http.post(api + '/classes/' + vm.selectedClass.id + '/marks', {
      exam_name: vm.mForm.exam_name, max_marks: vm.mForm.max_marks, records: records
    }).then(function (r) {
      alert(r.data.message);
      vm.grid.forEach(function (g) { g.marks = null; });
      vm.loadMarks();
    }, fail);
  };
  vm.removeMark = function (m) {
    if (confirm('Delete this result?'))
      $http.delete(api + '/marks/' + m.id).then(vm.loadMarks);
  };

  vm.loadStudents(); vm.loadClasses();
});

/* ---------------- STUDENT ---------------- */
app.controller('StudentCtrl', function ($http) {
  var vm = this, api = '/api/student';
  var fail = function (e) { alert((e.data && e.data.message) || 'Something went wrong'); };

  vm.tab = 'classes';
  vm.profile = {}; vm.classes = []; vm.items = [];
  vm.attendance = { summary: [], records: [] }; vm.marks = [];

  vm.load = function () {
    $http.get(api + '/profile').then(function (r) { vm.profile = r.data; });
    $http.get(api + '/classes').then(function (r) { vm.classes = r.data; });
    $http.get(api + '/assessments').then(function (r) {
      vm.items = r.data.map(function (a) {
        a.state = a.score !== null ? 'graded' : (a.submission_id ? 'submitted' : 'pending');
        a.draft = a.answer || '';
        return a;
      });
    });
    $http.get(api + '/attendance').then(function (r) { vm.attendance = r.data; });
    $http.get(api + '/marks').then(function (r) { vm.marks = r.data; });
  };

  vm.enroll = function (c) {
    $http.post(api + '/classes/' + c.id + '/enroll').then(function () { vm.load(); }, fail);
  };
  vm.leave = function (c) {
    if (confirm('Leave ' + c.name + '?'))
      $http.delete(api + '/classes/' + c.id + '/enroll').then(function () { vm.load(); });
  };
  vm.submit = function (a) {
    $http.post(api + '/assessments/' + a.id + '/submit', { answer: a.draft })
      .then(function () { vm.load(); }, fail);
  };

  vm.load();
});
