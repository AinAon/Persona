let _cropEditors = {
  portrait: { cropper: null, onConfirm: null },
  avatar: { cropper: null, onConfirm: null }
};

function destroyCropperInstance(kind) {
  const state = _cropEditors[kind];
  if (!state?.cropper) return;
  try { state.cropper.destroy(); } catch (e) {}
  state.cropper = null;
}

function buildCropper(kind, dataUrl, onConfirm) {
  if (typeof Cropper === 'undefined') {
    showToast('Cropper.js가 로드되지 않았습니다.');
    return;
  }

  const isAvatar = kind === 'avatar';
  const overlayId = isAvatar ? 'cropOverlayAvatar' : 'cropOverlay';
  const imgId = isAvatar ? 'cropImgAvatar' : 'cropImg';
  const state = _cropEditors[kind];
  const overlay = document.getElementById(overlayId);
  const img = document.getElementById(imgId);

  destroyCropperInstance(kind);
  state.onConfirm = onConfirm;

  img.src = dataUrl;
  overlay.classList.add('open');

  const aspectRatio = isAvatar ? 1 : (2 / 3);
  state.cropper = new Cropper(img, {
    aspectRatio,
    viewMode: 1,
    dragMode: 'move',
    autoCropArea: 1,
    responsive: true,
    background: false,
    guides: false,
    center: false,
    highlight: false,
    movable: true,
    zoomable: true,
    scalable: false,
    rotatable: false,
    cropBoxMovable: false,
    cropBoxResizable: false,
    toggleDragModeOnDblclick: false,
    ready() {
      const containerData = state.cropper.getContainerData();
      state.cropper.setCropBoxData({
        left: 0,
        top: 0,
        width: containerData.width,
        height: containerData.height
      });
    }
  });
}

function openCropEditor(dataUrl, onConfirm) {
  buildCropper('portrait', dataUrl, onConfirm);
}

function openAvatarCropEditor(dataUrl, onConfirm) {
  buildCropper('avatar', dataUrl, onConfirm);
}

function closeCropEditor() {
  destroyCropperInstance('portrait');
  document.getElementById('cropOverlay')?.classList.remove('open');
}

function closeAvatarCropEditor() {
  destroyCropperInstance('avatar');
  document.getElementById('cropOverlayAvatar')?.classList.remove('open');
}

function confirmCrop() {
  const state = _cropEditors.portrait;
  if (!state.cropper) return;
  const canvas = state.cropper.getCroppedCanvas({
    width: 800,
    height: 1200,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high'
  });
  const result = canvas.toDataURL('image/jpeg', 0.93);
  closeCropEditor();
  state.onConfirm?.(result);
}

function confirmAvatarCrop() {
  const state = _cropEditors.avatar;
  if (!state.cropper) return;
  const canvas = state.cropper.getCroppedCanvas({
    width: 600,
    height: 600,
    rounded: true,
    fillColor: 'transparent',
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high'
  });
  const result = canvas.toDataURL('image/png');
  closeAvatarCropEditor();
  state.onConfirm?.(result);
}
