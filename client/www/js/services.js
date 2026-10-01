const servicesManager = (function () {
  let cachedServices = [];
  let selectedService = null;

  async function fetchServices() {
    const services = await apiClient.get('/services');
    cachedServices = services;
    return services;
  }

  async function renderServicesList(containerSelector) {
    const $container = $(containerSelector);
    $container.html('<div class="loading-indicator">Loading university services...</div>');

    try {
      const services = await fetchServices();
      if (!services || services.length === 0) {
        $container.html('<div class="empty-state"><p>No services currently available.</p></div>');
        return;
      }

      let html = '';
      services.forEach(service => {
        html += `
          <div class="card service-card" data-service-id="${uiHelper.escapeHtml(service.serviceId)}">
            <div class="card-subtitle">${uiHelper.escapeHtml(service.department)}</div>
            <h3 class="card-title">${uiHelper.escapeHtml(service.name)}</h3>
            <p style="font-size: 0.9rem; color: #475569; margin: 8px 0 14px 0;">
              ${uiHelper.escapeHtml(service.description)}
            </p>
            <div class="service-meta-item">
              <span class="service-meta-label">Appointment</span>
              <span class="service-meta-value">${service.appointmentAvailable ? 'Available' : 'Not Offered'}</span>
            </div>
            <div class="service-meta-item">
              <span class="service-meta-label">Virtual Queue</span>
              <span class="service-meta-value">${service.queueAvailable ? 'Available' : 'Not Offered'}</span>
            </div>
            <div class="service-meta-item">
              <span class="service-meta-label">Evidence Required</span>
              <span class="service-meta-value">${service.evidenceRequired ? 'Yes' : 'Optional'}</span>
            </div>
            <button class="btn-primary btn-view-service" data-service-id="${uiHelper.escapeHtml(service.serviceId)}" style="margin-top: 14px;">
              View Details and Requirements
            </button>
          </div>
        `;
      });

      $container.html(html);
    } catch (error) {
      $container.html(
        `<div class="alert-box alert-error">Failed to load services: ${uiHelper.escapeHtml(error.message)}</div>`
      );
    }
  }

  async function renderServiceDetail(serviceId) {
    selectedService = cachedServices.find(s => s.serviceId === serviceId);
    if (!selectedService) {
      try {
        selectedService = await apiClient.get(`/services/${serviceId}`);
      } catch (e) {
        console.error('Service lookup failed:', e);
      }
    }

    if (!selectedService) return;

    $('#service-detail-name').text(selectedService.name);
    $('#service-detail-department').text(selectedService.department);
    $('#service-detail-description').text(selectedService.description);

    const $reqList = $('#service-detail-requirements');
    $reqList.empty();

    $reqList.append('<li>Student ID</li>');
    $reqList.append('<li>Description of the issue or inquiry</li>');

    if (selectedService.evidenceRequired) {
      $reqList.append('<li>Screenshot or photo of the error <strong>(Required)</strong></li>');
    } else {
      $reqList.append('<li>Screenshot or photo of the error <em>(Optional)</em></li>');
    }

    if (selectedService.requirements && selectedService.requirements.length > 0) {
      selectedService.requirements.forEach(req => {
        const lower = req.toLowerCase();
        if (!lower.includes('student id') && !lower.includes('description of') && !lower.includes('screenshot') && !lower.includes('error message')) {
          $reqList.append(`<li>${uiHelper.escapeHtml(req)}</li>`);
        }
      });
    }

    $('#service-detail-evidence').text(selectedService.evidenceRequired ? 'Mandatory supporting evidence required' : 'Optional supporting evidence');
    $('#service-detail-appointment').text(selectedService.appointmentAvailable ? 'Appointments enabled' : 'Appointments disabled');
    $('#service-detail-queue').text(selectedService.queueAvailable ? 'Virtual queue enabled' : 'Virtual queue disabled');

    const hours = selectedService.openingHours;
    const hoursText = hours ? `${hours.openTime} to ${hours.closeTime} (Weekdays)` : 'Standard Business Hours';
    $('#service-detail-hours').text(hoursText);

    $('#btn-start-request-for-service')
      .data('service-id', selectedService.serviceId)
      .data('service-name', selectedService.name);

    $.mobile.changePage('#page-service-detail', { transition: 'slide' });
  }

  function getSelectedService() {
    return selectedService;
  }

  return {
    fetchServices,
    renderServicesList,
    renderServiceDetail,
    getSelectedService
  };
})();
