const queueManager = (function () {
  let activeQueueEntry = null;

  async function joinQueueForRequest(requestId) {
    try {
      const response = await apiClient.post('/queue', { requestId });
      activeQueueEntry = response.queueEntry;

      showQueueTicket(response.queueEntry);
      $.mobile.changePage('#page-queue', { transition: 'slide' });
    } catch (error) {
      alert(`Could not join queue: ${error.message}`);
    }
  }

  function showQueueTicket(queueEntry) {
    if (!queueEntry) return;

    $('#queue-ticket-token').text(queueEntry.token);
    $('#queue-ticket-status').text(queueEntry.status);
    $('#queue-ticket-request').text(queueEntry.requestId);
    $('#queue-ticket-service').text(queueEntry.serviceId);
    $('#btn-cancel-queue-participation').data('queue-id', queueEntry.queueId);
  }

  async function loadActiveQueueStatus() {
    try {
      const entries = await apiClient.get('/queue');
      if (entries && entries.length > 0) {
        const waitingEntry = entries.find(e => e.status === 'WAITING') || entries[0];
        activeQueueEntry = waitingEntry;
        showQueueTicket(waitingEntry);
      } else {
        $('#queue-ticket-token').text('---');
        $('#queue-ticket-status').text('Not In Queue');
      }
    } catch (e) {
      console.error('Failed to load queue status:', e);
    }
  }

  async function cancelQueue(queueId) {
    if (!confirm('Are you sure you want to cancel your queue participation? Your request will return to Awaiting Booking.')) {
      return;
    }

    try {
      await apiClient.delete(`/queue/${queueId}`);
      $.mobile.changePage('#page-my-requests', { transition: 'none' });
      requestsManager.renderUserRequestsList('#my-requests-container');
    } catch (error) {
      alert(`Failed to cancel queue: ${error.message}`);
    }
  }

  return {
    joinQueueForRequest,
    showQueueTicket,
    loadActiveQueueStatus,
    cancelQueue
  };
})();
