"use strict";
const API = 'https://eluxior-vendor-api.marco-eluxior.workers.dev';
const statusEl = document.getElementById('intake-status');
const form = document.getElementById('photo-form');
const input = document.getElementById('photos');
const results = document.getElementById('upload-results');
const button = document.getElementById('upload-button');
const progress = document.getElementById('upload-progress');
const token = new URL(location.href).searchParams.get('token') || '';
// Remove bearer capability from the address bar and referrer history immediately.
history.replaceState(null, '', location.pathname);
const limit = 2 * 1024 * 1024;
const urls = [];
input.addEventListener('change', () => {
  urls.splice(0).forEach(URL.revokeObjectURL);
  const previews = document.getElementById('previews'); previews.replaceChildren();
  for (const file of input.files) {
    const url = URL.createObjectURL(file); urls.push(url);
    const image = document.createElement('img'); image.src = url; image.alt = file.name;
    image.style.cssText = 'max-width:200px;max-height:180px;object-fit:contain'; previews.append(image);
  }
});
async function optimize(file) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw Error('Unsupported image format');
  if (file.size > 8 * 1024 * 1024) throw Error('Original exceeds 8 MB');
  // Decode every file so corrupt images are rejected before sending.
  const bitmap = await createImageBitmap(file);
  try {
    if (file.size < limit) return file;
    const canvas = document.createElement('canvas');
    // Retain resolution first; never silently shrink card lettering.
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,canvas.width,canvas.height); ctx.drawImage(bitmap,0,0);
    for (const quality of [0.92,0.86,0.80]) {
      const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/jpeg',quality));
      if (blob && blob.size < limit) return blob;
    }
    throw Error('Cannot optimize below 2 MB without stronger compression. Export a smaller clear image and retry.');
  } finally { bitmap.close(); }
}
function send(blob) {
  return new Promise((resolve,reject) => {
    const xhr = new XMLHttpRequest(); xhr.open('POST', API + '/v1/photo-intake/upload');
    xhr.timeout = 120000;
    xhr.setRequestHeader('content-type',blob.type);
    xhr.setRequestHeader('x-po-upload-token',token);
    xhr.upload.onprogress = e => { if(e.lengthComputable) progress.value = 100*e.loaded/e.total; };
    xhr.onload = () => {
      let data; try { data = JSON.parse(xhr.responseText); } catch { reject(Error('Invalid server response')); return; }
      if (xhr.status >= 200 && xhr.status < 300 && data.receipt_id) resolve(data);
      else reject(Error(data.error || 'Upload failed (' + xhr.status + ')'));
    };
    xhr.onerror = () => reject(Error('Connection interrupted; receipt unconfirmed. Retry this file.'));
    xhr.ontimeout = () => reject(Error('Timed out; receipt unconfirmed. Retry this file.'));
    xhr.send(blob);
  });
}
form.addEventListener('submit', async e => {
  e.preventDefault(); button.disabled = true; input.disabled = true; progress.hidden = false;
  let received = 0, failed = 0;
  const files = Array.from(input.files);
  for (const file of files) {
    const item = document.createElement('li'); results.append(item); progress.value = 0;
    item.textContent = file.name + ': preparing…';
    try {
      const blob = await optimize(file); item.textContent = file.name + ': uploading…';
      const data = await send(blob); received++;
      item.textContent = file.name + ': received pending review. Receipt: ' + data.receipt_id;
    } catch (error) { failed++; item.textContent = file.name + ': FAILED — ' + error.message; }
  }
  statusEl.textContent = received + ' received; ' + failed + ' failed. Select only failed files to retry.';
  input.value = ''; button.disabled = false; input.disabled = false; progress.hidden = true;
});
(async () => {
  if (!token) { statusEl.textContent = 'Open the secure PO-specific link supplied by ELUXIOR. If you do not have one, contact ELUXIOR.'; return; }
  try {
    const response = await fetch(API + '/v1/photo-intake/context?token=' + encodeURIComponent(token), {cache:'no-store',referrerPolicy:'no-referrer'});
    const data = await response.json(); if (!response.ok) throw Error(data.error || 'Link unavailable');
    document.getElementById('vendor-name').value = data.vendor;
    document.getElementById('po-number').value = data.po;
    statusEl.textContent = 'Link verified. Uploads will be received for this vendor and PO only.'; form.hidden = false;
    const cardButton = document.createElement('button'); cardButton.type = 'button'; cardButton.className = 'pending'; cardButton.textContent = 'Download / print this PO Photo Card';
    form.before(cardButton);
    cardButton.addEventListener('click', async () => {
      cardButton.disabled = true;
      try {
        const response = await fetch(API + '/v1/photo-intake/card', {headers:{'x-po-upload-token':token},cache:'no-store',referrerPolicy:'no-referrer'});
        if(!response.ok) throw Error('Card unavailable. Contact ELUXIOR.');
        const blob = await response.blob(), url = URL.createObjectURL(blob);
        const link = document.createElement('a'); link.href = url; link.download = blob.type.includes('application/pdf') ? 'ELUXIOR-PO-' + String(data.po).replace(/[^0-9A-Za-z-]/g,'') + '-Photo-Card.pdf' : 'ELUXIOR-PO-Photo-Card.html'; link.click();
        setTimeout(()=>URL.revokeObjectURL(url),60000);
      } catch(error) { statusEl.textContent = error.message; }
      cardButton.disabled = false;
    });
  } catch(error) { statusEl.textContent = error.message + '. Contact ELUXIOR for a new link.'; }
})();
