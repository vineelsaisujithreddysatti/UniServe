const authManager = (function () {
  async function signup(name, email, password) {
    const payload = {
      name: name.trim(),
      email: email.trim(),
      password: password
    };
    return await apiClient.post('/auth/signup', payload);
  }

  async function login(email, password) {
    const payload = {
      email: email.trim(),
      password: password
    };

    const response = await apiClient.post('/auth/login', payload);
    if (response && response.token && response.user) {
      apiClient.setToken(response.token);
      apiClient.setCurrentUser(response.user);
    }
    return response;
  }

  function logout() {
    apiClient.clearSession();
    if (window.$ && $.mobile) {
      $.mobile.changePage('#page-login', { transition: 'none' });
    }
  }

  function isAuthenticated() {
    return Boolean(apiClient.getToken());
  }

  function getUserRole() {
    const user = apiClient.getCurrentUser();
    return user ? user.role : null;
  }

  function getCurrentUser() {
    return apiClient.getCurrentUser();
  }

  function navigateToHome() {
    const role = getUserRole();
    if (role === 'staff') {
      $.mobile.changePage('#page-staff-requests', { transition: 'none' });
    } else {
      $.mobile.changePage('#page-home', { transition: 'none' });
    }
  }

  return {
    signup,
    login,
    logout,
    isAuthenticated,
    getUserRole,
    getCurrentUser,
    navigateToHome
  };
})();
