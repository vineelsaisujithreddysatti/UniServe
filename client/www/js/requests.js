const requestsManager = (function () {
  let userRequests = [];
  let currentRequest = null;

  async function createRequest(serviceId, description, evidence = null) {
    const payload = {
      serviceId,
      description,
      evidence
    };
    return await apiClient.post('/requests', payload);
  }

  async function fetchUserRequests() {
    userRequests = await apiClient.get('/requests');
    return userRequests;
  }

  async function renderUserRequestsList(containerSelector) {
    const $container = $(containerSelector);
    $container.html('<div class="loading-indicator">Loading your requests...</div>');

    try {
      const requests = await fetchUserRequests();
      if (!requests || requests.length === 0) {
        $container.html(
          '<div class="empty-state"><p>You have not submitted any service requests yet.</p></div>'
        );
        return;
      }

      let html = '';
      requests.forEach(req => {
        let actionButtons = '';

        if (req.status === 'AWAITING_BOOKING') {
          actionButtons = `
            <div style="display: flex; gap: 8px; margin-top: 14px;">
              <button class="btn-primary btn-book-appt-for-req" data-request-id="${uiHelper.escapeHtml(req.requestId)}" data-service-id="${uiHelper.escapeHtml(req.serviceId)}">
                Book Appointment
              </button>
              <button class="btn-secondary btn-join-queue-for-req" data-request-id="${uiHelper.escapeHtml(req.requestId)}">
                Join Queue
              </button>
            </div>
          `;
        } else if (req.status === 'BOOKED_QUEUED') {
          if (req.appointment) {
            actionButtons = `
              <div style="margin-top: 12px;">
                <div class="alert-box alert-info" style="margin-bottom: 8px;">
                  Booked Slot: ${uiHelper.formatDateTime(req.appointment.slotStart)}
                </div>
                <button class="btn-danger btn-cancel-appt" data-appointment-id="${uiHelper.escapeHtml(req.appointment.appointmentId)}">
                  Cancel Appointment
                </button>
              </div>
            `;
          } else if (req.queue) {
            actionButtons = `
              <div style="margin-top: 12px;">
                <div class="alert-box alert-info" style="margin-bottom: 8px;">
                  Queue Token: <strong>${uiHelper.escapeHtml(req.queue.token)}</strong> (${uiHelper.escapeHtml(req.queue.status)})
                </div>
                <button class="btn-danger btn-cancel-queue" data-queue-id="${uiHelper.escapeHtml(req.queue.queueId)}">
                  Cancel Queue Participation
                </button>
              </div>
            `;
          }
        }

        let staffResponseBox = '';
        if (req.staffResponse) {
          staffResponseBox = `
            <div style="background-color: #f8fafc; border-left: 4px solid var(--accent-color); padding: 10px 14px; margin-top: 12px; border-radius: 4px;">
              <strong style="font-size: 0.85rem; color: #0284c7;">Staff Response:</strong>
              <p style="margin: 4px 0 0 0; font-size: 0.9rem; color: #334155;">
                ${uiHelper.escapeHtml(req.staffResponse)}
              </p>
            </div>
          `;
        }

        html += `
          <div class="card request-card" data-request-id="${uiHelper.escapeHtml(req.requestId)}">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
              <div>
                <span class="card-subtitle">ID: ${uiHelper.escapeHtml(req.requestId)}</span>
                <h4 style="margin: 2px 0 0 0; font-size: 1.05rem; color: #1b365d;">
                  ${uiHelper.escapeHtml(req.serviceId)}
                </h4>
              </div>
              <div>
                ${uiHelper.getStatusBadgeHtml(req.status)}
              </div>
            </div>

            <p style="font-size: 0.9rem; color: #334155; margin: 8px 0;">
              ${uiHelper.escapeHtml(req.description)}
            </p>

            <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 8px;">
              Submitted on ${uiHelper.formatDateTime(req.createdAt)}
              ${req.hasEvidence ? ' &bull; <em>Supporting evidence attached</em>' : ''}
            </div>

            ${staffResponseBox}
            ${actionButtons}
          </div>
        `;
      });

      $container.html(html);
    } catch (error) {
      $container.html(
        `<div class="alert-box alert-error">Failed to load requests: ${uiHelper.escapeHtml(error.message)}</div>`
      );
    }
  }

  function getCurrentRequest() {
    return currentRequest;
  }

  return {
    createRequest,
    fetchUserRequests,
    renderUserRequestsList,
    getCurrentRequest
  };
})();
