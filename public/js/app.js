(() => {
  'use strict';

  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const browseBtn = document.getElementById('browse-btn');
  const fileList = document.getElementById('file-list');
  const emptyState = document.getElementById('empty-state');
  const refreshBtn = document.getElementById('refresh-btn');

  const uploadStatus = document.getElementById('upload-status');
  const progressWrap = document.getElementById('upload-progress-wrap');
  const progressBar = document.getElementById('upload-progress-bar');
  const statusText = document.getElementById('upload-status-text');

  const fileModalEl = document.getElementById('file-modal');
  const fileModal = new bootstrap.Modal(fileModalEl);
  const modalTitle = document.getElementById('file-modal-title');
  const previewWrap = document.getElementById('preview-wrap');
  const previewImg = document.getElementById('preview-img');
  const previewDownloadBtn = document.getElementById('preview-download-btn');
  const previewPlaceholder = document.getElementById('preview-placeholder');
  const placeholderIcon = document.getElementById('placeholder-icon');
  const detailSize = document.getElementById('detail-size');
  const detailType = document.getElementById('detail-type');
  const detailUploaded = document.getElementById('detail-uploaded');
  const downloadBtn = document.getElementById('download-btn');
  const deleteBtn = document.getElementById('delete-btn');
  const prevFileBtn = document.getElementById('prev-file-btn');
  const nextFileBtn = document.getElementById('next-file-btn');

  const filesById = new Map();
  let currentId = null;

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, i);
    const formatted = value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1);
    return `${String(formatted).replace(/\.0$/, '')} ${units[i]}`;
  }

  function timeAgo(isoString) {
    const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
    return new Date(isoString).toLocaleDateString();
  }

  function typeIcon(entry) {
    if (entry.isImage) return 'bi-file-earmark-image';
    if (entry.mime.startsWith('video/')) return 'bi-file-earmark-play';
    if (entry.mime.startsWith('audio/')) return 'bi-file-earmark-music';
    if (entry.mime === 'application/pdf') return 'bi-file-earmark-pdf';
    if (/zip|compressed|tar|rar|7z/.test(entry.mime)) return 'bi-file-earmark-zip';
    if (/json|javascript|xml|html|css/.test(entry.mime)) return 'bi-file-earmark-code';
    if (entry.mime.startsWith('text/')) return 'bi-file-earmark-text';
    return 'bi-file-earmark';
  }

  function fileUrl(entry) {
    return `/api/files/${entry.id}`;
  }

  const mimeExtensions = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'text/plain': '.txt',
    'text/html': '.html',
    'application/pdf': '.pdf',
  };

  function pasteFiles(e) {
    const items = e.clipboardData && e.clipboardData.files;
    if (!items || items.length === 0) return false;

    e.preventDefault();
    const files = Array.from(items).map((file, i) => {
      if (file.name) return file;
      const stamp = `${Date.now()}-${i + 1}`;
      const kind = file.type.startsWith('image/') ? 'pasted-image' : 'pasted-file';
      return new File([file], `${kind}-${stamp}${mimeExtensions[file.type] || ''}`, {
        type: file.type,
      });
    });
    uploadFiles(files);
    return true;
  }

  async function loadList() {
    try {
      const res = await fetch('/api/files');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const files = await res.json();
      filesById.clear();
      files.forEach((f) => filesById.set(f.id, f));
      renderList(files);
    } catch (err) {
      statusText.textContent = 'Could not load the file list.';
      uploadStatus.classList.remove('d-none');
      progressWrap.classList.add('d-none');
    }
  }

  function renderList(files) {
    fileList.replaceChildren();
    emptyState.classList.toggle('d-none', files.length > 0);

    for (const entry of files) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'file-item-btn';
      button.addEventListener('click', () => openFile(entry.id));

      if (entry.isImage) {
        const img = document.createElement('img');
        img.src = fileUrl(entry);
        img.alt = '';
        img.loading = 'lazy';
        img.className = 'file-thumb';
        button.appendChild(img);
      } else {
        const icon = document.createElement('span');
        icon.className = 'type-icon';
        const i = document.createElement('i');
        i.className = `bi ${typeIcon(entry)}`;
        i.setAttribute('aria-hidden', 'true');
        icon.appendChild(i);
        button.appendChild(icon);
      }

      const textWrap = document.createElement('div');
      textWrap.className = 'flex-grow-1 min-w-0';

      const name = document.createElement('div');
      name.className = 'file-name text-truncate';
      name.textContent = entry.name;

      const meta = document.createElement('div');
      meta.className = 'small text-muted';
      meta.textContent = `${formatBytes(entry.size)} · ${timeAgo(entry.uploadedAt)}`;

      textWrap.appendChild(name);
      textWrap.appendChild(meta);
      button.appendChild(textWrap);

      const chevron = document.createElement('i');
      chevron.className = 'bi bi-chevron-right text-muted small';
      chevron.setAttribute('aria-hidden', 'true');
      button.appendChild(chevron);

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'file-delete-btn';
      deleteButton.setAttribute('aria-label', `Delete ${entry.name}`);
      deleteButton.title = 'Delete file';
      const deleteIcon = document.createElement('i');
      deleteIcon.className = 'bi bi-x-lg';
      deleteIcon.setAttribute('aria-hidden', 'true');
      deleteButton.appendChild(deleteIcon);
      deleteButton.addEventListener('click', () => deleteFile(entry.id));

      const row = document.createElement('div');
      row.className = 'file-item-row';
      row.appendChild(button);
      row.appendChild(deleteButton);

      const li = document.createElement('li');
      li.className = 'list-group-item p-0';
      li.appendChild(row);
      fileList.appendChild(li);
    }
  }

  function renderFile(entry) {
    modalTitle.textContent = entry.name;
    modalTitle.title = entry.name;

    const url = fileUrl(entry);
    const downloadUrl = `${url}?download=1`;
    downloadBtn.href = downloadUrl;
    previewDownloadBtn.href = downloadUrl;

    if (entry.isImage) {
      previewImg.src = url;
      previewImg.alt = `Preview of ${entry.name}`;
      previewWrap.classList.remove('d-none');
      previewPlaceholder.classList.add('d-none');
    } else {
      previewImg.removeAttribute('src');
      previewImg.alt = '';
      previewWrap.classList.add('d-none');
      placeholderIcon.className = `bi ${typeIcon(entry)}`;
      previewPlaceholder.classList.remove('d-none');
    }

    detailSize.textContent = formatBytes(entry.size);
    detailType.textContent = entry.mime;
    detailUploaded.textContent = new Date(entry.uploadedAt).toLocaleString();

    updateNav();
  }

  function openFile(id) {
    const entry = filesById.get(id);
    if (!entry) return;
    currentId = id;
    renderFile(entry);
    fileModal.show();
  }

  function orderedIds() {
    return Array.from(filesById.keys());
  }

  function updateNav() {
    const ids = orderedIds();
    const idx = ids.indexOf(currentId);
    prevFileBtn.disabled = idx <= 0;
    nextFileBtn.disabled = idx === -1 || idx >= ids.length - 1;
  }

  function step(direction) {
    const ids = orderedIds();
    const idx = ids.indexOf(currentId);
    const nextIdx = idx + direction;
    if (nextIdx < 0 || nextIdx >= ids.length) return;
    const entry = filesById.get(ids[nextIdx]);
    if (!entry) return;
    currentId = ids[nextIdx];
    renderFile(entry);
  }

  async function deleteFile(id) {
    const entry = filesById.get(id);
    const name = entry ? entry.name : 'this file';
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;

    let res;
    try {
      res = await fetch(`/api/files/${id}`, { method: 'DELETE' });
    } catch {
      window.alert('Could not delete the file. Please try again.');
      return;
    }
    if (!res.ok) {
      window.alert('Could not delete the file. Please try again.');
      return;
    }

    filesById.delete(id);
    if (id === currentId) {
      currentId = null;
      fileModal.hide();
    }
    renderList(Array.from(filesById.values()));
  }

  function setProgress(fraction) {
    const pct = Math.round(fraction * 100);
    progressWrap.classList.remove('d-none');
    progressBar.style.width = `${pct}%`;
    progressWrap.setAttribute('aria-valuenow', String(pct));
    progressBar.textContent = pct >= 10 ? `${pct}%` : '';
  }

  function showStatus(message, isError) {
    uploadStatus.classList.remove('d-none');
    progressWrap.classList.add('d-none');
    statusText.textContent = message;
    statusText.classList.toggle('text-danger', Boolean(isError));
    statusText.classList.toggle('text-muted', !isError);
  }

  function uploadFiles(fileListInput) {
    const files = Array.from(fileListInput);
    if (files.length === 0) return;

    const formData = new FormData();
    for (const file of files) formData.append('files', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/files');

    uploadStatus.classList.remove('d-none');
    statusText.classList.remove('text-danger');
    statusText.classList.add('text-muted');
    statusText.textContent = `Uploading ${files.length === 1 ? files[0].name : `${files.length} files`}…`;
    setProgress(0);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) setProgress(e.loaded / e.total);
    });

    xhr.addEventListener('load', () => {
      fileInput.value = '';
      if (xhr.status >= 200 && xhr.status < 300) {
        const count = files.length;
        showStatus(`Uploaded ${count === 1 ? '1 file' : `${count} files`} successfully.`);
        loadList();
      } else {
        let message = `Upload failed (HTTP ${xhr.status}).`;
        try {
          const body = JSON.parse(xhr.responseText);
          if (body.error) message = `Upload failed: ${body.error}`;
        } catch { /* keep default message */ }
        showStatus(message, true);
      }
    });

    xhr.addEventListener('error', () => {
      fileInput.value = '';
      showStatus('Upload failed: network error.', true);
    });

    xhr.send(formData);
  }

  function openPicker() {
    fileInput.click();
  }

  dropZone.addEventListener('click', (e) => {
    if (e.target.closest('#browse-btn')) return;
    openPicker();
  });

  dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openPicker();
    }
  });

  browseBtn.addEventListener('click', openPicker);
  fileInput.addEventListener('change', () => uploadFiles(fileInput.files));

  ['dragover', 'drop'].forEach((eventName) => {
    document.addEventListener(eventName, (e) => e.preventDefault());
  });

  ['dragenter', 'dragover'].forEach((eventName) => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
  });

  dropZone.addEventListener('dragleave', (e) => {
    if (!dropZone.contains(e.relatedTarget)) {
      dropZone.classList.remove('drag-over');
    }
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  });

  document.addEventListener('paste', (e) => {
    pasteFiles(e);
  });

  refreshBtn.addEventListener('click', loadList);

  prevFileBtn.addEventListener('click', () => step(-1));
  nextFileBtn.addEventListener('click', () => step(1));
  deleteBtn.addEventListener('click', () => {
    if (currentId) deleteFile(currentId);
  });

  document.addEventListener('keydown', (e) => {
    if (!fileModalEl.classList.contains('show')) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      step(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      step(1);
    }
  });

  if ('EventSource' in window) {
    const events = new EventSource('/api/events');
    events.addEventListener('files-changed', () => loadList());
  }

  setInterval(() => {
    if (document.visibilityState === 'visible') {
      const currentNames = Array.from(fileList.querySelectorAll('.file-name'))
        .map((el) => el.textContent)
        .join('\n');
      fetch('/api/files')
        .then((res) => (res.ok ? res.json() : null))
        .then((files) => {
          if (!files) return;
          const incoming = files.map((f) => f.name).join('\n');
          if (incoming !== currentNames || files.length !== fileList.children.length) {
            filesById.clear();
            files.forEach((f) => filesById.set(f.id, f));
            renderList(files);
          }
        })
        .catch(() => {});
    }
  }, 15000);

  loadList();
})();
