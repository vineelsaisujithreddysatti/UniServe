const uiHelper = (function () {
  // user facing status labels
  const statusLabels = {
    'AWAITING_BOOKING': 'Submitted – Awaiting Booking',
    'BOOKED_QUEUED': 'Booked / Queued',
    'UNDER_REVIEW': 'Under Review',
    'PROCESSING': 'Processing',
    'COMPLETED': 'Completed'
  };

  const statusClasses = {
    'AWAITING_BOOKING': 'status-awaiting',
    'BOOKED_QUEUED': 'status-booked',
    'UNDER_REVIEW': 'status-review',
    'PROCESSING': 'status-processing',
    'COMPLETED': 'status-completed'
  };

  // escape html to prevent xss
  function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.innerText = String(text);
    return div.innerHTML;
  }

  function getStatusLabel(status) {
    return statusLabels[status] || status || 'Unknown';
  }

  function getStatusBadgeHtml(status) {
    const label = getStatusLabel(status);
    const badgeClass = statusClasses[status] || 'status-awaiting';
    return `<span class="status-badge ${badgeClass}">${escapeHtml(label)}</span>`;
  }

  function showAlert(containerSelector, message, type = 'error') {
    const $container = $(containerSelector);
    if (!$container.length) return;

    const alertClass = type === 'success' ? 'alert-success' : 'alert-error';
    const html = `<div class="alert-box ${alertClass}">${escapeHtml(message)}</div>`;
    $container.html(html).show();
  }

  function clearAlert(containerSelector) {
    const $container = $(containerSelector);
    if ($container.length) {
      $container.empty().hide();
    }
  }

  function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return dateString;
    }
  }

  function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    try {
      const d = new Date(dateString);
      return d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateString;
    }
  }

  return {
    escapeHtml,
    getStatusLabel,
    getStatusBadgeHtml,
    showAlert,
    clearAlert,
    formatDate,
    formatDateTime
  };
})();
