$(document).on('mobileinit', function () {
  $.mobile.defaultPageTransition = 'none';
  $.mobile.defaultDialogTransition = 'none';
  $.mobile.hashListeningEnabled = true;
});

$(document).ready(function () {
  // start app once dom is ready
  initializeApp();
});

document.addEventListener('deviceready', function () {
  console.log('Cordova device ready fired.');
}, false);

function initializeApp() {
  // setup event listeners and page hooks
  bindAuthEvents();
  bindNavigationEvents();
  bindStudentRequestEvents();
  bindAppointmentEvents();
  bindQueueEvents();
  bindStaffEvents();
  setupPageShowHooks();
  checkInitialRoute();
}

function checkInitialRoute() {
  if (authManager.isAuthenticated()) {
    authManager.navigateToHome();
  } else {
    $.mobile.changePage('#page-login', { transition: 'none' });
  }
}

function setupPageShowHooks() {
  $(document).on('pagebeforeshow', '#page-home', function () {
    if (!authManager.isAuthenticated()) {
      $.mobile.changePage('#page-login', { transition: 'none' });
      return;
    }
    const user = authManager.getCurrentUser();
    if (user) {
      $('#student-greeting-name').text(user.name);
    }
  });

  $(document).on('pagebeforeshow', '#page-services', function () {
    if (!authManager.isAuthenticated()) {
      $.mobile.changePage('#page-login', { transition: 'none' });
      return;
    }
    servicesManager.renderServicesList('#services-list-container');
  });

  $(document).on('pagebeforeshow', '#page-my-requests', function () {
    if (!authManager.isAuthenticated()) {
      $.mobile.changePage('#page-login', { transition: 'none' });
      return;
    }
    requestsManager.renderUserRequestsList('#my-requests-container');
  });

  $(document).on('pagebeforeshow', '#page-queue', function () {
    if (!authManager.isAuthenticated()) {
      $.mobile.changePage('#page-login', { transition: 'none' });
      return;
    }
    queueManager.loadActiveQueueStatus();
  });

  $(document).on('pagebeforeshow', '#page-staff-requests', function () {
    if (!authManager.isAuthenticated() || authManager.getUserRole() !== 'staff') {
      $.mobile.changePage('#page-login', { transition: 'none' });
      return;
    }
    staffManager.renderStaffRequestsList('#staff-requests-container');
  });

  $(document).on('pagebeforehide', '#page-request', function () {
    evidenceManager.stopLiveCamera();
  });
}

function bindAuthEvents() {
  $('#form-login').on('submit', async function (e) {
    e.preventDefault();
    uiHelper.clearAlert('#login-alert-container');

    const email = $('#login-email').val();
    const password = $('#login-password').val();

    try {
      await authManager.login(email, password);
      authManager.navigateToHome();
    } catch (error) {
      uiHelper.showAlert('#login-alert-container', error.message);
    }
  });

  $('#form-signup').on('submit', async function (e) {
    e.preventDefault();
    uiHelper.clearAlert('#signup-alert-container');

    const name = $('#signup-name').val();
    const email = $('#signup-email').val();
    const password = $('#signup-password').val();
    const confirmPassword = $('#signup-confirm-password').val();

    if (password !== confirmPassword) {
      uiHelper.showAlert('#signup-alert-container', 'Passwords do not match.');
      return;
    }

    try {
      await authManager.signup(name, email, password);
      uiHelper.showAlert('#signup-alert-container', 'Account created! Please log in.', 'success');
      setTimeout(() => {
        $.mobile.changePage('#page-login', { transition: 'none' });
      }, 1200);
    } catch (error) {
      uiHelper.showAlert('#signup-alert-container', error.message);
    }
  });

  $(document).on('click', '.btn-logout', function (e) {
    e.preventDefault();
    authManager.logout();
  });
}

function bindNavigationEvents() {
  $(document).on('click', '.btn-view-service', function (e) {
    e.preventDefault();
    const serviceId = $(this).data('service-id');
    servicesManager.renderServiceDetail(serviceId);
  });

  $('#btn-start-request-for-service').on('click', function (e) {
    e.preventDefault();
    const serviceId = $(this).data('service-id');
    const serviceName = $(this).data('service-name');

    $('#request-service-id').val(serviceId);
    $('#request-service-name-display').text(serviceName);
    $('#request-description').val('');
    evidenceManager.clearEvidence();
    uiHelper.clearAlert('#request-alert-container');

    $.mobile.changePage('#page-request', { transition: 'slide' });
  });

  $(document).on('click', '.btn-book-appt-for-req', function (e) {
    e.preventDefault();
    const reqId = $(this).data('request-id');
    const servId = $(this).data('service-id');
    appointmentsManager.initBookingFlow(reqId, servId);
  });

  $(document).on('click', '.btn-join-queue-for-req', function (e) {
    e.preventDefault();
    const reqId = $(this).data('request-id');
    queueManager.joinQueueForRequest(reqId);
  });
}

function bindStudentRequestEvents() {
  $('#btn-capture-evidence').on('click', function (e) {
    e.preventDefault();
    evidenceManager.captureImage();
  });

  $('#btn-upload-evidence').on('click', function (e) {
    e.preventDefault();
    evidenceManager.uploadImage();
  });

  $('#btn-clear-evidence').on('click', function (e) {
    e.preventDefault();
    evidenceManager.clearEvidence();
  });

  $('#form-submit-request').on('submit', async function (e) {
    e.preventDefault();
    uiHelper.clearAlert('#request-alert-container');

    const serviceId = $('#request-service-id').val();
    const description = $('#request-description').val();
    const evidence = evidenceManager.getCapturedEvidence();

    try {
      const response = await requestsManager.createRequest(serviceId, description, evidence);
      evidenceManager.clearEvidence();
      uiHelper.showAlert('#request-alert-container', 'Service request submitted successfully!', 'success');
      setTimeout(() => {
        $.mobile.changePage('#page-my-requests', { transition: 'none' });
      }, 1000);
    } catch (error) {
      uiHelper.showAlert('#request-alert-container', error.message);
    }
  });
}

function bindAppointmentEvents() {
  $('#appointment-date-picker').on('change', function () {
    const selectedDate = $(this).val();
    if (selectedDate) {
      appointmentsManager.fetchSlotsForDate(selectedDate);
    }
  });

  $('#btn-confirm-appointment-booking').on('click', function (e) {
    e.preventDefault();
    appointmentsManager.confirmBooking();
  });

  $(document).on('click', '.btn-cancel-appt', function (e) {
    e.preventDefault();
    const apptId = $(this).data('appointment-id');
    appointmentsManager.cancelAppointment(apptId);
  });
}

function bindQueueEvents() {
  $('#btn-cancel-queue-participation').on('click', function (e) {
    e.preventDefault();
    const queueId = $(this).data('queue-id');
    queueManager.cancelQueue(queueId);
  });

  $(document).on('click', '.btn-cancel-queue', function (e) {
    e.preventDefault();
    const queueId = $(this).data('queue-id');
    queueManager.cancelQueue(queueId);
  });
}

function bindStaffEvents() {
  $(document).on('click', '.btn-open-staff-detail', function (e) {
    e.preventDefault();
    const reqId = $(this).data('request-id');
    staffManager.openStaffRequestDetail(reqId);
  });

  $('#btn-staff-save-update').on('click', function (e) {
    e.preventDefault();
    staffManager.updateRequestFromStaff();
  });

  $('#btn-staff-serve-queue').on('click', function (e) {
    e.preventDefault();
    const queueId = $(this).data('queue-id');
    staffManager.serveQueueToken(queueId);
  });

  $('#btn-staff-view-evidence').on('click', function (e) {
    e.preventDefault();
    const reqId = $(this).data('request-id');
    staffManager.loadAndDisplayEvidence(reqId);
  });
}
