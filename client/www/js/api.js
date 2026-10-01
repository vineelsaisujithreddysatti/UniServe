const apiClient = (function () {
  // pick api url based on environment
  function getBaseUrl() {
    if (window.UNISERVE_API_URL) {
      return window.UNISERVE_API_URL;
    }
    // local testing with file://
    if (window.location.protocol === 'file:') {
      return 'http://localhost:5000/api';
    }
    return '/api';
  }

  function getToken() {
    return localStorage.getItem('uniserve_token');
  }

  function setToken(token) {
    if (token) {
      localStorage.setItem('uniserve_token', token);
    } else {
      localStorage.removeItem('uniserve_token');
    }
  }

  function getCurrentUser() {
    const raw = localStorage.getItem('uniserve_user');
    try {
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setCurrentUser(user) {
    if (user) {
      localStorage.setItem('uniserve_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('uniserve_user');
    }
  }

  function clearSession() {
    localStorage.removeItem('uniserve_token');
    localStorage.removeItem('uniserve_user');
  }

  // wrapper around fetch for auth and json handling
  async function request(method, endpoint, data = null) {
    const baseUrl = getBaseUrl();
    const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;

    const headers = {
      'Accept': 'application/json'
    };

    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options = {
      method: method.toUpperCase(),
      headers: headers
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      const isJson = (response.headers.get('content-type') || '').includes('application/json');
      const payload = isJson ? await response.json() : await response.text();

      if (!response.ok) {
        const error = new Error(
          (payload && payload.message) ? payload.message : `Request failed with status ${response.status}`
        );
        error.status = response.status;
        error.code = payload && payload.error ? payload.error : 'API_ERROR';
        error.payload = payload;

        // kick back to login if token expired or unauthorized
        if (response.status === 401 && !endpoint.includes('/auth/login')) {
          clearSession();
          if (window.$ && $.mobile) {
            $.mobile.changePage('#page-login', { transition: 'none' });
          }
        }

        throw error;
      }

      return payload;
    } catch (error) {
      console.error(`API ${method} ${endpoint} error:`, error.message);
      throw error;
    }
  }

  return {
    getBaseUrl,
    getToken,
    setToken,
    getCurrentUser,
    setCurrentUser,
    clearSession,
    get: (endpoint) => request('GET', endpoint),
    post: (endpoint, data) => request('POST', endpoint, data),
    put: (endpoint, data) => request('PUT', endpoint, data),
    delete: (endpoint) => request('DELETE', endpoint)
  };
})();
