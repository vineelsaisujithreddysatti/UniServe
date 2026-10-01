const staffManager = (function () {
  let currentStaffRequest = null;

  async function renderStaffRequestsList(containerSelector) {
    const $container = $(containerSelector);
    $container.html('<div class="loading-indicator">Loading university service requests...</div>');

    try {
      const requests = await apiClient.get('/requests');
      if (!requests || requests.length === 0) {
        $container.html('<div class="empty-state"><p>No requests currently submitted.</p></div>');
        return;
      }

      let html = '';
      requests.forEach(req => {
        let bookingInfo = 'No booking';
        if (req.appointment) {
          bookingInfo = `Appt: ${uiHelper.formatDateTime(req.appointment.slotStart)}`;
        } else if (req.queue) {
          bookingInfo = `Queue: Token ${uiHelper.escapeHtml(req.queue.token)} (${uiHelper.escapeHtml(req.queue.status)})`;
        }

        html += `
          <div class="card staff-request-item" data-request-id="${uiHelper.escapeHtml(req.requestId)}" style="cursor: pointer;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
              <div>
                <span class="card-subtitle">Request: ${uiHelper.escapeHtml(req.requestId)}</span>
                <h4 style="margin: 2px 0 0 0; font-size: 1rem; color: #1b365d;">
                  ${uiHelper.escapeHtml(req.studentName || 'Student')} (${uiHelper.escapeHtml(req.serviceId)})
                </h4>
              </div>
              <div>
                ${uiHelper.getStatusBadgeHtml(req.status)}
              </div>
            </div>

            <p style="font-size: 0.85rem; color: #475569; margin: 6px 0;">
              ${uiHelper.escapeHtml(req.description)}
            </p>

            <div style="font-size: 0.8rem; color: #64748b; display: flex; justify-content: space-between; margin-top: 8px;">
              <span>${bookingInfo}</span>
              <span>${req.hasEvidence ? 'Evidence attached' : 'No evidence'}</span>
            </div>

            <button class="btn-secondary btn-open-staff-detail" data-request-id="${uiHelper.escapeHtml(req.requestId)}" style="margin-top: 10px;">
              Manage and Review
            </button>
          </div>
        `;
      });

      $container.html(html);
    } catch (error) {
      $container.html(
        `<div class="alert-box alert-error">Failed to load staff requests: ${uiHelper.escapeHtml(error.message)}</div>`
      );
    }
  }

  async function openStaffRequestDetail(requestId) {
    uiHelper.clearAlert('#staff-detail-alert-container');
    $('#staff-evidence-container').empty().hide();

    try {
      const request = await apiClient.get(`/requests/${requestId}`);
      currentStaffRequest = request;

      $('#staff-detail-req-id').text(request.requestId);
      $('#staff-detail-student').text(`${request.studentName} (${request.studentEmail || request.userId})`);
      $('#staff-detail-service').text(`${request.serviceName} (${request.serviceId})`);
      $('#staff-detail-desc').text(request.description);
      $('#staff-detail-status-badge').html(uiHelper.getStatusBadgeHtml(request.status));
      $('#staff-response-input').val(request.staffResponse || '');

      // update status dropdown based on current state
      const $statusSelect = $('#staff-status-select');
      $statusSelect.empty();

      if (request.status === 'BOOKED_QUEUED') {
        $statusSelect.append(`<option value="BOOKED_QUEUED" selected>Keep Current (${uiHelper.getStatusLabel('BOOKED_QUEUED')})</option>`);
        $statusSelect.append(`<option value="UNDER_REVIEW">Move to Under Review</option>`);
      } else if (request.status === 'UNDER_REVIEW') {
        $statusSelect.append(`<option value="UNDER_REVIEW" selected>Keep Current (Under Review)</option>`);
        $statusSelect.append(`<option value="PROCESSING">Move to Processing</option>`);
      } else if (request.status === 'PROCESSING') {
        $statusSelect.append(`<option value="PROCESSING" selected>Keep Current (Processing)</option>`);
        $statusSelect.append(`<option value="COMPLETED">Move to Completed</option>`);
      } else {
        $statusSelect.append(`<option value="${request.status}" selected>${uiHelper.getStatusLabel(request.status)}</option>`);
      }

      // show call button if queue entry is waiting
      const $serveQueueBtn = $('#btn-staff-serve-queue');
      if (request.queue && request.queue.status === 'WAITING') {
        $serveQueueBtn.show().data('queue-id', request.queue.queueId);
      } else {
        $serveQueueBtn.hide();
      }

      // show evidence button if file is attached
      const $viewEvidenceBtn = $('#btn-staff-view-evidence');
      if (request.hasEvidence) {
        $viewEvidenceBtn.show().data('request-id', request.requestId);
      } else {
        $viewEvidenceBtn.hide();
      }

      $.mobile.changePage('#page-staff-request-detail', { transition: 'slide' });
    } catch (error) {
      alert(`Unable to open request: ${error.message}`);
    }
  }

  async function updateRequestFromStaff() {
    if (!currentStaffRequest) return;

    const newStatus = $('#staff-status-select').val();
    const staffResponse = $('#staff-response-input').val();

    try {
      const payload = {};
      if (newStatus && newStatus !== currentStaffRequest.status) {
        payload.status = newStatus;
      }
      if (staffResponse !== undefined) {
        payload.staffResponse = staffResponse;
      }

      const result = await apiClient.put(`/requests/${currentStaffRequest.requestId}`, payload);
      uiHelper.showAlert('#staff-detail-alert-container', 'Request updated successfully!', 'success');

      // update cached state
      currentStaffRequest.status = result.request.status;
      currentStaffRequest.staffResponse = result.request.staffResponse;
      $('#staff-detail-status-badge').html(uiHelper.getStatusBadgeHtml(result.request.status));
    } catch (error) {
      uiHelper.showAlert('#staff-detail-alert-container', `Update failed: ${error.message}`);
    }
  }

  async function serveQueueToken(queueId) {
    try {
      await apiClient.put(`/queue/${queueId}`, {});
      uiHelper.showAlert('#staff-detail-alert-container', 'Queue token marked as served. Request moved to Under Review.', 'success');
      setTimeout(() => {
        openStaffRequestDetail(currentStaffRequest.requestId);
      }, 800);
    } catch (error) {
      uiHelper.showAlert('#staff-detail-alert-container', `Failed to serve queue: ${error.message}`);
    }
  }

  async function loadAndDisplayEvidence(requestId) {
    const $container = $('#staff-evidence-container');
    $container.html('<div class="loading-indicator">Retrieving encrypted evidence payload...</div>').show();

    try {
      const evidence = await apiClient.get(`/requests/${requestId}/evidence`);
      const src = `data:${evidence.mimeType};base64,${evidence.data}`;

      $container.html(`
        <div style="margin-top: 10px; text-align: center;">
          <img src="${src}" class="evidence-preview-img" alt="Supporting Evidence">
          <div style="font-size: 0.8rem; color: #64748b; margin-top: 6px;">
            ${uiHelper.escapeHtml(evidence.filename)} (${Math.round((evidence.fileSize || 0) / 1024)} KB)
          </div>
        </div>
      `);
    } catch (error) {
      $container.html(
        `<div class="alert-box alert-error">Unable to load evidence: ${uiHelper.escapeHtml(error.message)}</div>`
      );
    }
  }

  return {
    renderStaffRequestsList,
    openStaffRequestDetail,
    updateRequestFromStaff,
    serveQueueToken,
    loadAndDisplayEvidence
  };
})();
