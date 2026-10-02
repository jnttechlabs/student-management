var app = angular.module('studentApp', ['ngRoute']);

app.config(function ($routeProvider, $httpProvider) {
  $routeProvider
    .when('/login',    { templateUrl: 'views/login.html',    controller: 'LoginCtrl',    controllerAs: 'vm' })
    .when('/register', { templateUrl: 'views/register.html', controller: 'RegisterCtrl', controllerAs: 'vm' })
    .when('/admin',    { templateUrl: 'views/admin.html',    controller: 'AdminCtrl',    controllerAs: 'vm', role: 'admin' })
    .when('/faculty',  { templateUrl: 'views/faculty.html',  controller: 'FacultyCtrl',  controllerAs: 'vm', role: 'faculty' })
    .when('/student',  { templateUrl: 'views/student.html',  controller: 'StudentCtrl',  controllerAs: 'vm', role: 'student' })
    .otherwise({ redirectTo: '/login' });

  $httpProvider.interceptors.push('AuthInterceptor');
});

/* Auth service: keeps token + user in localStorage */
app.factory('AuthService', function ($http, $window) {
  var svc = {};
  svc.login = function (creds) {
    return $http.post('/api/auth/login', creds).then(function (res) {
      $window.localStorage.setItem('token', res.data.token);
      $window.localStorage.setItem('user', JSON.stringify(res.data.user));
      return res.data.user;
    });
  };
  svc.logout     = function () { $window.localStorage.clear(); };
  svc.token      = function () { return $window.localStorage.getItem('token'); };
  svc.user       = function () { return JSON.parse($window.localStorage.getItem('user') || 'null'); };
  svc.isLoggedIn = function () { return !!svc.token(); };
  return svc;
});

/* Interceptor: add JWT to every request; logout on 401 */
app.factory('AuthInterceptor', function ($window, $q, $location) {
  return {
    request: function (config) {
      var t = $window.localStorage.getItem('token');
      if (t) config.headers.Authorization = 'Bearer ' + t;
      return config;
    },
    responseError: function (rejection) {
      if (rejection.status === 401) {
        $window.localStorage.clear();
        $location.path('/login');
      }
      return $q.reject(rejection);
    }
  };
});

/* Route guard */
app.run(function ($rootScope, $location, AuthService) {
  $rootScope.$on('$routeChangeStart', function (e, next) {
    var needed = next.$$route && next.$$route.role;
    if (needed) {
      var u = AuthService.user();
      if (!u || u.role !== needed) $location.path('/login');
    }
  });
});