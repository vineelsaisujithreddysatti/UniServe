const evidenceManager = (function () {
  let capturedEvidence = null;
  let activeMediaStream = null;

  function setPreview(imageDataUrl, filename, fileSize, sourceLabel) {
    $('#request-evidence-preview').attr('src', imageDataUrl);
    const sizeKb = fileSize ? `${Math.round(fileSize / 1024)} KB` : 'Compressed';
    $('#evidence-file-meta').text(`${sourceLabel}: ${filename} (${sizeKb})`);
    $('#evidence-preview-box').show();
    $('#btn-clear-evidence').show();
  }

  function handleFileSelection(file, sourceLabel, onSuccessCallback) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
      const fullDataUrl = e.target.result;
      const commaIdx = fullDataUrl.indexOf(',');
      const base64Content = commaIdx !== -1 ? fullDataUrl.slice(commaIdx + 1) : fullDataUrl;

      capturedEvidence = {
        data: base64Content,
        mimeType: file.type || 'image/jpeg',
        filename: file.name || 'evidence.jpg',
        fileSize: file.size
      };

      setPreview(fullDataUrl, capturedEvidence.filename, file.size, sourceLabel);
      if (onSuccessCallback) onSuccessCallback(capturedEvidence);
    };

    reader.readAsDataURL(file);
  }

  function stopLiveCamera() {
    if (activeMediaStream) {
      activeMediaStream.getTracks().forEach(function (track) {
        track.stop();
      });
      activeMediaStream = null;
    }
    const videoElement = document.getElementById('camera-video-stream');
    if (videoElement) {
      videoElement.srcObject = null;
    }
    $('#live-camera-modal').hide();
  }

  function captureSnapshot(onSuccessCallback) {
    const videoElement = document.getElementById('camera-video-stream');
    const canvasElement = document.getElementById('camera-snapshot-canvas');
    if (!videoElement || !canvasElement) return;

    const width = videoElement.videoWidth || 640;
    const height = videoElement.videoHeight || 480;

    canvasElement.width = width;
    canvasElement.height = height;

    const context = canvasElement.getContext('2d');
    context.drawImage(videoElement, 0, 0, width, height);

    const fullDataUrl = canvasElement.toDataURL('image/jpeg', 0.85);
    const commaIdx = fullDataUrl.indexOf(',');
    const base64Content = commaIdx !== -1 ? fullDataUrl.slice(commaIdx + 1) : fullDataUrl;

    capturedEvidence = {
      data: base64Content,
      mimeType: 'image/jpeg',
      filename: 'camera_snapshot.jpg',
      fileSize: Math.round((base64Content.length * 3) / 4)
    };

    setPreview(fullDataUrl, 'camera_snapshot.jpg', capturedEvidence.fileSize, 'Live Camera Snapshot');
    stopLiveCamera();

    if (onSuccessCallback) onSuccessCallback(capturedEvidence);
  }

  // camera capture handler
  function captureImage(onSuccessCallback, onErrorCallback) {
    // cordova camera plugin
    if (navigator.camera && window.Camera) {
      const cameraOptions = {
        quality: 80,
        destinationType: Camera.DestinationType.DATA_URL,
        sourceType: Camera.PictureSourceType.CAMERA,
        encodingType: Camera.EncodingType.JPEG,
        targetWidth: 1024,
        targetHeight: 1024,
        saveToPhotoAlbum: false,
        correctOrientation: true
      };

      navigator.camera.getPicture(
        function (imageData) {
          capturedEvidence = {
            data: imageData,
            mimeType: 'image/jpeg',
            filename: 'camera_capture.jpg'
          };
          const fullDataUrl = 'data:image/jpeg;base64,' + imageData;
          setPreview(fullDataUrl, 'camera_capture.jpg', null, 'Captured Photo');
          if (onSuccessCallback) onSuccessCallback(capturedEvidence);
        },
        function (errorMessage) {
          console.warn('Camera capture cancelled or failed:', errorMessage);
          if (onErrorCallback) onErrorCallback(errorMessage);
        },
        cameraOptions
      );
      return;
    }

    // fallback to getusermedia in browser
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      }).then(function (stream) {
        activeMediaStream = stream;
        const videoElement = document.getElementById('camera-video-stream');
        if (videoElement) {
          videoElement.srcObject = stream;
          videoElement.play();
        }
        $('#live-camera-modal').show();

        // modal snapshot and close handlers
        $('#btn-take-snapshot').off('click').on('click', function (e) {
          e.preventDefault();
          captureSnapshot(onSuccessCallback);
        });

        $('#btn-close-camera').off('click').on('click', function (e) {
          e.preventDefault();
          stopLiveCamera();
        });
      }).catch(function (error) {
        console.warn('getUserMedia failed or access was denied. Falling back to camera input:', error);
        fallbackToCameraInput(onSuccessCallback);
      });
      return;
    }

    // standard file input fallback if no camera api
    fallbackToCameraInput(onSuccessCallback);
  }

  function fallbackToCameraInput(onSuccessCallback) {
    const $cameraInput = $('#camera-capture-input');
    $cameraInput.off('change').on('change', function (event) {
      const file = event.target.files[0];
      handleFileSelection(file, 'Camera Capture', onSuccessCallback);
    });
    $cameraInput.click();
  }

  // upload photo from gallery or disk for tranfer
  function uploadImage(onSuccessCallback, onErrorCallback) {
    // cordova photo library
    if (navigator.camera && window.Camera) {
      const libraryOptions = {
        quality: 80,
        destinationType: Camera.DestinationType.DATA_URL,
        sourceType: Camera.PictureSourceType.PHOTOLIBRARY,
        encodingType: Camera.EncodingType.JPEG,
        targetWidth: 1024,
        targetHeight: 1024,
        correctOrientation: true
      };

      navigator.camera.getPicture(
        function (imageData) {
          capturedEvidence = {
            data: imageData,
            mimeType: 'image/jpeg',
            filename: 'uploaded_photo.jpg'
          };
          const fullDataUrl = 'data:image/jpeg;base64,' + imageData;
          setPreview(fullDataUrl, 'uploaded_photo.jpg', null, 'Uploaded Photo');
          if (onSuccessCallback) onSuccessCallback(capturedEvidence);
        },
        function (errorMessage) {
          console.warn('Gallery selection cancelled:', errorMessage);
          if (onErrorCallback) onErrorCallback(errorMessage);
        },
        libraryOptions
      );
      return;
    }

    // standard file picker in browser
    const $fileInput = $('#file-upload-input');
    $fileInput.off('change').on('change', function (event) {
      const file = event.target.files[0];
      handleFileSelection(file, 'Uploaded Image', onSuccessCallback);
    });

    $fileInput.click();
  }

  function getCapturedEvidence() {
    return capturedEvidence;
  }

  function clearEvidence() {
    stopLiveCamera();
    capturedEvidence = null;
    $('#request-evidence-preview').attr('src', '');
    $('#evidence-file-meta').empty();
    $('#evidence-preview-box').hide();
    $('#btn-clear-evidence').hide();

    // reset file inputs
    $('#camera-capture-input').val('');
    $('#file-upload-input').val('');
  }

  return {
    captureImage,
    uploadImage,
    stopLiveCamera,
    getCapturedEvidence,
    clearEvidence
  };
})();
