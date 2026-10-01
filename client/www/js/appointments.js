const appointmentsManager = (function () {
  let activeBookingRequestId = null;
  let activeBookingServiceId = null;
  let selectedSlotStart = null;

  function initBookingFlow(requestId, serviceId) {
    activeBookingRequestId = requestId;
    activeBookingServiceId = serviceId;
    selectedSlotStart = null;

    $('#booking-request-id-display').text(requestId);
    $('#booking-service-id-display').text(serviceId);
    $('#btn-confirm-appointment-booking').prop('disabled', true);
    uiHelper.clearAlert('#booking-alert-container');

    // default picker to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    $('#appointment-date-picker').val(dateStr);

    $.mobile.changePage('#page-appointment', { transition: 'slide' });
    fetchSlotsForDate(dateStr);
  }

  async function fetchSlotsForDate(dateString) {
    const $grid = $('#appointment-slots-grid');
    $grid.html('<div class="loading-indicator">Searching available appointment slots...</div>');
    uiHelper.clearAlert('#booking-alert-container');
    selectedSlotStart = null;
    $('#btn-confirm-appointment-booking').prop('disabled', true);

    try {
      const response = await apiClient.get(`/services/${activeBookingServiceId}/slots?date=${dateString}`);
      const slots = response.slots;

      if (!slots || slots.length === 0) {
        $grid.html('<div class="empty-state"><p>No available slots for this date. Please choose another weekday.</p></div>');
        return;
      }

      let html = '';
      slots.forEach(slot => {
        html += `
          <div class="slot-item" data-slot-start="${uiHelper.escapeHtml(slot.slotStart)}">
            ${uiHelper.escapeHtml(slot.localTime)}
          </div>
        `;
      });

      $grid.html(html);

      // slot selection click
      $grid.find('.slot-item').on('click', function () {
        $grid.find('.slot-item').removeClass('selected');
        $(this).addClass('selected');
        selectedSlotStart = $(this).data('slot-start');
        $('#btn-confirm-appointment-booking').prop('disabled', false);
      });
    } catch (error) {
      $grid.html(
        `<div class="alert-box alert-error">Unable to load appointment slots: ${uiHelper.escapeHtml(error.message)}</div>`
      );
    }
  }

  async function confirmBooking() {
    if (!activeBookingRequestId || !selectedSlotStart) {
      uiHelper.showAlert('#booking-alert-container', 'Please select an appointment time slot.');
      return;
    }

    try {
      const response = await apiClient.post('/appointments', {
        requestId: activeBookingRequestId,
        slotStart: selectedSlotStart
      });

      uiHelper.showAlert('#booking-alert-container', 'Appointment successfully confirmed!', 'success');
      setTimeout(() => {
        $.mobile.changePage('#page-my-requests', { transition: 'none' });
        requestsManager.renderUserRequestsList('#my-requests-container');
      }, 1000);
    } catch (error) {
      uiHelper.showAlert('#booking-alert-container', `Booking conflict or error: ${error.message}`);
    }
  }

  async function cancelAppointment(appointmentId) {
    if (!confirm('Are you sure you want to cancel this appointment? Your request will return to Awaiting Booking.')) {
      return;
    }

    try {
      await apiClient.delete(`/appointments/${appointmentId}`);
      requestsManager.renderUserRequestsList('#my-requests-container');
    } catch (error) {
      alert(`Failed to cancel appointment: ${error.message}`);
    }
  }

  return {
    initBookingFlow,
    fetchSlotsForDate,
    confirmBooking,
    cancelAppointment
  };
})();
