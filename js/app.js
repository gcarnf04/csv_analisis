/**
 * app.js — State machine & event orchestration
 *
 * STATES: INIT → READY → PARSED → ANALYZED → LOADING → COMPLETE
 */

/* ── DOM refs ────────────────────────────────────────────── */
const $ = id => document.getElementById(id);

const DOM = {
  // Header / API key
  apiKeyArea:      $('apiKeyArea'),
  apiKeyStatus:    $('apiKeyStatus'),
  statusDot:       $('statusDot'),
  statusLabel:     $('statusLabel'),
  btnToggleApiKey: $('btnToggleApiKey'),
  // Modal
  setupModal:      $('setupModal'),
  loginModal:      $('loginModal'),
  modalApiKeyInput:$('modalApiKeyInput'),
  btnToggleApiKeyVis:$('btnToggleApiKeyVis'),
  btnSaveKey:      $('btnSaveKey'),
  btnUnlock:       $('btnUnlock'),
  modalError:      $('modalError'),
  loginError:      $('loginError'),
  // Upload
  dropZone:        $('dropZone'),
  fileInput:       $('fileInput'),
  // Sections
  heroSection:     $('heroSection'),
  fileInfoBar:     $('fileInfoBar'),
  fileName:        $('fileName'),
  fileStat:        $('fileStat'),
  btnRemoveFile:   $('btnRemoveFile'),
  previewSection:  $('previewSection'),
  previewTable:    $('previewTable'),
  analysisPanel:   $('analysisPanel'),
  columnGrid:      $('columnGrid'),
  correlationSection:$('correlationSection'),
  correlationGrid: $('correlationGrid'),
  problemsCount:   $('problemsCount'),
  btnAnalyze:      $('btnAnalyze'),
  ctaHint:         $('ctaHint'),
  adBanner1:       $('adBanner1'),
  adMid:           $('adMid'),
  // Loading
  loadingSection:  $('loadingSection'),
  loadingStatus:   $('loadingStatus'),
  loadingBarFill:  $('loadingBarFill'),
  btnCancelAnalysis:$('btnCancelAnalysis'),
  // Results
  resultsSection:  $('resultsSection'),
  gaugeFill:       $('gaugeFill'),
  gaugeScore:      $('gaugeScore'),
  scoreVerdict:    $('scoreVerdict'),
  diagnosisBody:   $('diagnosisBody'),
  btnCopyReport:   $('btnCopyReport'),
  btnNewSession:   $('btnNewSession'),
  // Interstitial
  interstitialAd:  $('interstitialAd'),
  adCountdown:     $('adCountdown'),
  btnSkipAd:       $('btnSkipAd'),
};

/* ── Application state ───────────────────────────────────── */
const State = {
  apiKey:   '',
  parsedData:   null,
  parsedFields: null,
  analysis:     null,
  summary:      null,
  fullMarkdown: '',
};

/* ── State machine helpers ───────────────────────────────── */
function show(el) { if (el) el.hidden = false; }
function hide(el) { if (el) el.hidden = true; }

function updateApiKeyUI() {
  if (Vault.isUnlocked()) {
    State.apiKey = Vault.getUnlockedKey();
    DOM.statusDot.className = 'status-dot active';
    DOM.statusLabel.textContent = 'API Key loaded';
    DOM.btnToggleApiKey.textContent = 'Change key';
    const canAnalyze = !!State.analysis;
    DOM.btnAnalyze.disabled = !canAnalyze;
    DOM.ctaHint.textContent = 'Your key is unlocked for this session.';
  } else if (Vault.hasStoredKey()) {
    State.apiKey = '';
    DOM.statusDot.className = 'status-dot';
    DOM.statusLabel.textContent = 'Key saved — enter PIN to activate';
    DOM.btnToggleApiKey.textContent = 'Unlock';
    DOM.btnAnalyze.disabled = true;
    DOM.ctaHint.textContent = 'Unlock your key to enable AI diagnosis.';
  } else {
    State.apiKey = '';
    DOM.statusDot.className = 'status-dot error';
    DOM.statusLabel.textContent = 'No API key';
    DOM.btnToggleApiKey.textContent = 'Set key';
    DOM.btnAnalyze.disabled = true;
    DOM.ctaHint.textContent = 'Set your Gemini API key to enable AI diagnosis.';
  }
}

function updateTitle(state) {
  const titles = {
    INIT:     'Data Gut Check — Upload your CSV',
    PARSED:   'Data Gut Check — Analyzing…',
    LOADING:  'Data Gut Check — Generating diagnosis…',
    COMPLETE: 'Data Gut Check — Diagnosis ready',
  };
  document.title = titles[state] || 'Data Gut Check';
}

/* ── API Key modal ───────────────────────────────────────── */
const modalPinInputs = [...document.querySelectorAll('#setupModal .pin-input')];
const loginPinInputs = [...document.querySelectorAll('#loginModal .pin-input')];

window.closeSetupModal = () => hide(DOM.setupModal);
window.closeLoginModal = () => hide(DOM.loginModal);
function openSetupModal() { show(DOM.setupModal); DOM.modalApiKeyInput.value = ''; DOM.modalError.textContent = ''; modalPinInputs.forEach(p=>p.value=''); $('btnClearKey').style.display = Vault.hasStoredKey() ? 'block' : 'none'; setTimeout(()=>DOM.modalApiKeyInput.focus(), 50); }
function openLoginModal() { show(DOM.loginModal); DOM.loginError.textContent = ''; loginPinInputs.forEach(p=>p.value=''); setTimeout(()=>loginPinInputs[0]?.focus(), 50); }

DOM.btnToggleApiKey.addEventListener('click', () => {
  if (Vault.hasStoredKey() && !Vault.isUnlocked()) openLoginModal();
  else openSetupModal();
});

DOM.btnToggleApiKeyVis?.addEventListener('click', () => {
  DOM.modalApiKeyInput.type = DOM.modalApiKeyInput.type === 'password' ? 'text' : 'password';
});

DOM.btnSaveKey.addEventListener('click', () => {
  const key = DOM.modalApiKeyInput.value.trim();
  const pin = modalPinInputs.map(p=>p.value).join('');
  if (!key.startsWith('AIza') || key.length < 30) { DOM.modalError.textContent = 'Key must start with AIza (Gemini API Key)'; return; }
  if (pin.length !== 4) { DOM.modalError.textContent = 'Enter 4-digit PIN'; return; }
  Vault.saveKey(key, pin);
  State.apiKey = key;
  closeSetupModal();
  updateApiKeyUI();
});

$('btnClearKey')?.addEventListener('click', () => {
  if (!confirm('Are you sure you want to delete your saved API Key? You will need to enter it again.')) return;
  Vault.clearKey();
  State.apiKey = null;
  closeSetupModal();
  updateApiKeyUI();
});

DOM.btnUnlock?.addEventListener('click', () => {
  const pin = loginPinInputs.map(p=>p.value).join('');
  if (pin.length !== 4) { DOM.loginError.textContent = 'Incomplete PIN'; return; }
  const key = Vault.loadKey(pin);
  if (!key) { DOM.loginError.textContent = 'Incorrect PIN'; return; }
  State.apiKey = key;
  closeLoginModal();
  updateApiKeyUI();
});

function initPinInputs(inputs) {
  inputs.forEach((inp, i) => {
    inp.addEventListener('input', () => {
      inp.value = inp.value.replace(/\D/g, '').slice(-1);
      if (inp.value && i < inputs.length - 1) inputs[i + 1].focus();
    });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !inp.value && i > 0) inputs[i - 1].focus();
    });
  });
}
initPinInputs(modalPinInputs);
initPinInputs(loginPinInputs);

/* ── Drop zone ───────────────────────────────────────────── */
DOM.dropZone.addEventListener('click', () => DOM.fileInput.click());
DOM.dropZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') DOM.fileInput.click(); });
DOM.fileInput.addEventListener('change', e => { if (e.target.files[0]) processFile(e.target.files[0]); });

DOM.dropZone.addEventListener('dragover', e => { e.preventDefault(); DOM.dropZone.classList.add('drag-over'); });
DOM.dropZone.addEventListener('dragleave', () => DOM.dropZone.classList.remove('drag-over'));
DOM.dropZone.addEventListener('drop', e => {
  e.preventDefault();
  DOM.dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) processFile(file);
});

/* ── File processing ─────────────────────────────────────── */
function processFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['csv','tsv'].includes(ext)) {
    alert('Please upload a .csv or .tsv file.');
    return;
  }

  // Show file info
  const kb = (file.size / 1024).toFixed(1);
  const mb = file.size / 1024 / 1024;
  DOM.fileName.textContent = file.name;

  hide(DOM.heroSection);
  hide(DOM.adBanner1);

  // Parse CSV
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    complete(results) {
      if (!results.data.length || !results.meta.fields?.length) {
        alert('The file appears to be empty or malformed.');
        return;
      }

      State.parsedData   = results.data;
      State.parsedFields = results.meta.fields;

      const rows = results.data.length;
      const cols = results.meta.fields.length;
      DOM.fileStat.textContent = `${rows.toLocaleString()} rows × ${cols} cols · ${mb > 1 ? mb.toFixed(1) + ' MB' : kb + ' KB'}`;

      show(DOM.fileInfoBar);
      show(DOM.previewSection);

      Visualizer.renderPreview(DOM.previewTable, results.data, results.meta.fields);

      // Run analysis
      const analysis = Analyzer.analyze(results.data, results.meta.fields);
      State.analysis = analysis;
      State.summary  = Analyzer.buildSummary(analysis);

      // Render column grid
      show(DOM.analysisPanel);
      Visualizer.renderColumnGrid(DOM.columnGrid, analysis.columns);
      Visualizer.renderCorrelation(DOM.correlationGrid, DOM.correlationSection, analysis.corr);

      // Problems badge
      if (analysis.problemCols > 0) {
        DOM.problemsCount.textContent = `${analysis.problemCols} issue${analysis.problemCols > 1 ? 's' : ''} detected`;
        DOM.problemsCount.className   = 'problems-count has-problems';
      } else {
        DOM.problemsCount.textContent = 'No issues detected';
        DOM.problemsCount.className   = 'problems-count clean';
      }

      updateApiKeyUI();
      updateTitle('PARSED');
      DOM.analysisPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    error(err) {
      alert(`Parse error: ${err.message}`);
    }
  });
}

/* ── Remove file ─────────────────────────────────────────── */
DOM.btnRemoveFile.addEventListener('click', () => {
  State.parsedData = State.parsedFields = State.analysis = State.summary = null;
  State.fullMarkdown = '';
  DOM.fileInput.value = '';
  hide(DOM.fileInfoBar); hide(DOM.previewSection); hide(DOM.analysisPanel);
  hide(DOM.loadingSection); hide(DOM.resultsSection); hide(DOM.adMid);
  show(DOM.heroSection); show(DOM.adBanner1);
  updateTitle('INIT');
});

/* ── AI Diagnosis ────────────────────────────────────────── */
DOM.btnAnalyze.addEventListener('click', runDiagnosis);

async function runDiagnosis() {
  if (!State.summary || !State.apiKey) return;

  // Transition to LOADING
  hide(DOM.analysisPanel);
  show(DOM.loadingSection);
  show(DOM.adMid);
  updateTitle('LOADING');

  // Reset results
  State.fullMarkdown = '';
  DOM.diagnosisBody.innerHTML = '';
  DOM.gaugeFill.style.strokeDashoffset = '251.2';
  DOM.gaugeScore.textContent = '—';
  DOM.scoreVerdict.textContent = '';

  const phases = [
    ['Parsing metadata structure…', 10],
    ['Detecting anomalies and patterns…', 35],
    ['Evaluating ML readiness…', 60],
    ['Generating diagnostic report…', 80],
  ];
  let phaseIdx = 0;
  const phaseInterval = setInterval(() => {
    if (phaseIdx < phases.length) {
      const [msg, pct] = phases[phaseIdx++];
      DOM.loadingStatus.textContent = msg;
      DOM.loadingBarFill.style.width = pct + '%';
    }
  }, 1200);

  let cursorEl = null;

  GeminiAPI.callWithStreaming(State.summary, State.apiKey, {
    onToken(text) {
      // Remove old cursor
      if (cursorEl) cursorEl.remove();
      State.fullMarkdown += text;
      // Render as markdown
      DOM.diagnosisBody.innerHTML = marked.parse(State.fullMarkdown);
      // Re-add cursor
      cursorEl = document.createElement('span');
      cursorEl.className = 'cursor';
      DOM.diagnosisBody.appendChild(cursorEl);
      DOM.diagnosisBody.scrollIntoView({ behavior: 'smooth', block: 'end' });
    },
    onStatus(msg, pct) {
      DOM.loadingStatus.textContent = msg;
      DOM.loadingBarFill.style.width = pct + '%';
    },
    onDone(cancelled) {
      clearInterval(phaseInterval);
      if (cursorEl) cursorEl.remove();

      hide(DOM.loadingSection);

      if (!cancelled) {
        showResults();
      } else {
        // Cancelled — restore analysis panel
        show(DOM.analysisPanel);
        hide(DOM.adMid);
        updateTitle('PARSED');
      }
    },
    onError(msg) {
      clearInterval(phaseInterval);
      if (cursorEl) cursorEl.remove();
      hide(DOM.loadingSection);
      show(DOM.analysisPanel);
      hide(DOM.adMid);
      alert(`Diagnosis failed: ${msg}`);
      updateTitle('PARSED');
    }
  });
}

function showResults() {
  show(DOM.resultsSection);
  updateTitle('COMPLETE');
  DOM.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Extract score and animate gauge
  const score = GeminiAPI.extractScore(State.fullMarkdown) ?? 50;
  setTimeout(() => {
    Visualizer.animateGauge(DOM.gaugeFill, DOM.gaugeScore, DOM.scoreVerdict, score);
  }, 300);

  DOM.diagnosisBody.innerHTML = marked.parse(State.fullMarkdown);
}



/* ── Cancel ──────────────────────────────────────────────── */
DOM.btnCancelAnalysis.addEventListener('click', () => { GeminiAPI.cancel(); });

/* ── Copy markdown ───────────────────────────────────────── */
DOM.btnCopyReport.addEventListener('click', async () => {
  if (!State.fullMarkdown) return;
  await navigator.clipboard.writeText(State.fullMarkdown).catch(() => {});
  const orig = DOM.btnCopyReport.innerHTML;
  DOM.btnCopyReport.innerHTML = '✓ Copied!';
  setTimeout(() => { DOM.btnCopyReport.innerHTML = orig; }, 2000);
});

/* ── New Session ─────────────────────────────────────────── */
DOM.btnNewSession.addEventListener('click', () => {
  State.parsedData = State.parsedFields = State.analysis = State.summary = null;
  State.fullMarkdown = '';
  DOM.fileInput.value = '';
  hide(DOM.fileInfoBar); hide(DOM.previewSection); hide(DOM.analysisPanel);
  hide(DOM.loadingSection); hide(DOM.resultsSection); hide(DOM.adMid);
  show(DOM.heroSection); show(DOM.adBanner1);
  updateTitle('INIT');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* ── Init ────────────────────────────────────────────────── */
updateApiKeyUI();
updateTitle('INIT');
