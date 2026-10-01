// Browser stub for Apache Cordova
// Enables web browser preview without MIME type errors when Cordova native wrappers are not loaded.
(function () {
  if (typeof window !== 'undefined' && !window.cordova) {
    window.cordova = {
      platformId: 'browser',
      version: '12.0.0'
    };
  }
})();
