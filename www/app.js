/* global navigator, window, document */
import { db } from './db.js';

// PWA: Service Worker registration
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(console.error);
}

// Install prompt handling
let deferredPrompt = null;
const btnInstall = document.getElementById('btnInstall');
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  btnInstall.hidden = false;
});
btnInstall?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice.catch(()=>{});
  deferredPrompt = null;
  btnInstall.hidden = true;
});

// UI refs
const video = document.getElementById('video');
const canvas = document.getElementById('frame');
const overlay = document.getElementById('overlay');
const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');
const btnTorch = document.getElementById('btnTorch');
const supportInfo = document.getElementById('supportInfo');
const listEl = document.getElementById('list');
const emptyState = document.getElementById('emptyState');
const search = document.getElementById('search');
const toast = document.getElementById('toast');

const dlgBorrow = document.getElementById('dlgBorrow');
const borrowCode = document.getElementById('borrowCode');
const borrowerName = document.getElementById('borrowerName');
const borrowForm = document.getElementById('borrowForm');

const dlgReturn = document.getElementById('dlgReturn');
const returnCode = document.getElementById('returnCode');
const returnBorrower = document.getElementById('returnBorrower');
const returnForm = document.getElementById('returnForm');

let stream = null;
let detector = null;
let scanLoopActive = false;
let torchOn = false;
let currentScanned = null;

function showToast(msg){
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(()=>toast.classList.remove('show'), 1600);
  if (navigator.vibrate) navigator.vibrate(30);
}

function isBarcodeDetectorSupported(){
  return 'BarcodeDetector' in window;
}

async function initDetector(){
  if (!isBarcodeDetectorSupported()) return null;
  try {
    const formats = ['qr_code','code_128','code_39','ean_13','ean_8','upc_a','upc_e'];
    const supported = await window.BarcodeDetector.getSupportedFormats();
    const use = formats.filter(f => supported.includes(f));
    return new window.BarcodeDetector({ formats: use.length ? use : supported });
  } catch (e) {
    console.warn('Detector init failed', e);
    return null;
  }
}

function trackCapabilities(){
  const lines = [];
  lines.push(isBarcodeDetectorSupported()
    ? '✔️ Barcode Detector available (best performance).'
    : '⚠️ Barcode Detector not available; camera preview only.');
  lines.push(navigator.mediaDevices && navigator.mediaDevices.getUserMedia
    ? '✔️ Camera access supported.'
    : '❌ Camera API not available.');
  supportInfo.textContent = lines.join(' ');
}
trackCapabilities();

// Camera control
async function startCamera(){
  try {
    detector = await initDetector();
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 },
        focusMode: 'continuous'
      },
      audio: false
    });
    video.srcObject = stream;
    await video.play();

    // Try to enable torch track capability if present
    const [track] = stream.getVideoTracks();
    const caps = track.getCapabilities?.() || {};
    btnTorch.disabled = !caps.torch;

    btnStart.disabled = true;
    btnStop.disabled = false;
    overlay.textContent = 'Scanning…';
    scanLoopActive = true;
    window.requestAnimationFrame(scanLoop);
  } catch (e) {
    console.error(e);
    alert('Camera error: ' + e.message + '\nMake sure you granted camera permission.');
  }
}

function stopCamera(){
  scanLoopActive = false;
  if (stream){
    stream.getTracks().forEach(t=>t.stop());
    stream = null;
  }
  btnStart.disabled = false;
  btnStop.disabled = true;
  btnTorch.disabled = true;
  overlay.textContent = 'Point camera at a QR code';
}

btnStart.addEventListener('click', startCamera);
btnStop.addEventListener('click', stopCamera);

btnTorch.addEventListener('click', ()=>{
  try{
    const [track] = stream?.getVideoTracks?.() || [];
    const caps = track?.getCapabilities?.();
    if (!track || !caps?.torch) return;
    torchOn = !torchOn;
    track.applyConstraints({ advanced: [{ torch: torchOn }]});
    btnTorch.textContent = torchOn ? 'Torch On' : 'Toggle Torch';
  }catch(e){ console.warn(e); }
});

// Scan loop
let lastContent = '';
let lastTime = 0;

async function scanLoop(){
  if (!scanLoopActive || !video.videoWidth) {
    if (scanLoopActive) window.requestAnimationFrame(scanLoop);
    return;
  }

  const now = performance.now();
  if (now - lastTime < 120) { // ~8 fps
    window.requestAnimationFrame(scanLoop);
    return;
  }
  lastTime = now;

  if (detector){
    // Use BarcodeDetector
    try{
      const barcodes = await detector.detect(video);
      if (barcodes?.length){
        const content = (barcodes[0].rawValue || '').trim();
        if (content && content !== lastContent){
          lastContent = content;
          handleScan(content);
        }
      }
    }catch(e){ /* ignore transient */ }
  } else {
    // Graceful: no detector -> show message (camera preview only)
    overlay.textContent = 'Scanner not supported on this browser.';
  }

  window.requestAnimationFrame(scanLoop);
}

// Business logic
async function handleScan(code){
  // prevent double-firing quickly
  if (currentScanned === code) return;
  currentScanned = code;
  setTimeout(()=>{ if (currentScanned === code) currentScanned = null; }, 1000);

  const existing = await db.get(code);
  if (!existing){
    // New loan
    borrowCode.textContent = code;
    borrowerName.value = '';
    dlgBorrow.showModal();
  } else {
    // Return flow
    returnCode.textContent = code;
    returnBorrower.textContent = existing.borrower;
    dlgReturn.showModal();
  }
}

borrowForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const borrower = borrowerName.value.trim();
  if (!borrower) return;
  const code = borrowCode.textContent;
  await db.put({
    code,
    borrower,
    borrowedAt: Date.now()
  });
  dlgBorrow.close();
  showToast('Borrow recorded');
  renderList();
});

returnForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const code = returnCode.textContent;
  await db.delete(code);
  dlgReturn.close();
  showToast('Item returned');
  renderList();
});

// List rendering & filter
async function renderList(){
  const data = await db.all();
  const q = (search.value || '').toLowerCase();
  const filtered = data.filter(x =>
    x.code.toLowerCase().includes(q) ||
    x.borrower.toLowerCase().includes(q)
  );

  listEl.innerHTML = '';
  emptyState.style.display = filtered.length ? 'none' : 'block';

  for (const item of filtered){
    const li = document.createElement('li');
    li.className = 'item';
    const left = document.createElement('div');
    const right = document.createElement('div');
    right.innerHTML = `<span class="badge">Borrowed</span>`;
    const when = new Date(item.borrowedAt);
    left.innerHTML = `
      <div class="code">${item.code}</div>
      <div class="meta">by ${item.borrower} · ${when.toLocaleString()}</div>
    `;
    li.append(left, right);
    li.addEventListener('click', async ()=>{
      // Quick return on tap
      returnCode.textContent = item.code;
      returnBorrower.textContent = item.borrower;
      dlgReturn.showModal();
    });
    listEl.appendChild(li);
  }
}

search.addEventListener('input', renderList);

document.addEventListener('visibilitychange', ()=>{
  if (document.visibilityState === 'visible') renderList();
});

renderList();
