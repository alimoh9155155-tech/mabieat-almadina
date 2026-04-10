/**
 * ================================================================
 *  Excel Analyzer — analyzer.js
 *  Reads Excel files with SheetJS, classifies materials by keyword.
 * ================================================================
 */

/* ================================================================
   SECTION 1 ── CATEGORY RULES (Edit Here to Add More)
   ================================================================
   Each entry:
     name     : display name (Arabic)
     icon     : emoji shown in cards
     keywords : Arabic strings to search for inside material names
     color    : accent hex colour
     bg       : translucent card background
     glow     : border glow colour
   ================================================================ */
const CATEGORIES = [
  { name:'الحنفيات',               icon:'🚿', keywords:['حنفية','حنفيات','صنبور','صنابير'],                                                       color:'#22c55e', bg:'rgba(34,197,94,0.09)',    glow:'rgba(34,197,94,0.30)' },
  { name:'الخلاطات',               icon:'🔧', keywords:['خلاط','خلاطات','مخلوط','خلط','ميكسر'],                                                   color:'#38bdf8', bg:'rgba(56,189,248,0.09)',   glow:'rgba(56,189,248,0.30)' },
  { name:'الأنابيب والمواسير',     icon:'🔩', keywords:['أنبوب','انبوب','ماسورة','مواسير','أنابيب','بايب','خرطوم','خراطيم'],                       color:'#fb923c', bg:'rgba(251,146,60,0.09)',   glow:'rgba(251,146,60,0.30)' },
  { name:'المغاسل والأحواض',       icon:'🪣', keywords:['مغسلة','مغاسل','حوض','أحواض','بانيو','سينك'],                                            color:'#a78bfa', bg:'rgba(167,139,250,0.09)',  glow:'rgba(167,139,250,0.30)' },
  { name:'المراحيض',               icon:'🚽', keywords:['مرحاض','كلوزيت','توالت','طواليت','مراحيض'],                                              color:'#f472b6', bg:'rgba(244,114,182,0.09)',  glow:'rgba(244,114,182,0.30)' },
  { name:'الصمامات والمحابس',      icon:'🔒', keywords:['صمام','صمامات','محبس','محابس','فالف','بلف','فلتر'],                                       color:'#facc15', bg:'rgba(250,204,21,0.09)',   glow:'rgba(250,204,21,0.30)' },
  { name:'السخانات',               icon:'🔥', keywords:['سخان','سخانات','هيتر','بويلر','خزان مياه ساخنة'],                                        color:'#f87171', bg:'rgba(248,113,113,0.09)',  glow:'rgba(248,113,113,0.30)' },
  { name:'المضخات',                icon:'⚙️', keywords:['مضخة','مضخات','طلمبة','طلمبات','ضخ'],                                                    color:'#4ade80', bg:'rgba(74,222,128,0.09)',   glow:'rgba(74,222,128,0.30)' },
  { name:'عدادات المياه',          icon:'📊', keywords:['عداد','عدادات','ميزان مياه','قياس مياه','واتر ميتر'],                                    color:'#34d399', bg:'rgba(52,211,153,0.09)',   glow:'rgba(52,211,153,0.30)' },
  { name:'الملحقات والإكسسوارات', icon:'🛠️', keywords:['ملحق','ملحقات','إكسسوار','اكسسوار','قطعة','كوع','وصلة','تيه','ربط','طوق','براغي','مسمار','حشوة','جلدة','مطاطة'], color:'#94a3b8', bg:'rgba(148,163,184,0.09)', glow:'rgba(148,163,184,0.30)' },
];

/* ================================================================
   SECTION 2 ── ALLOWED FILE TYPES
   ================================================================ */
const ALLOWED_EXT  = ['.xlsx', '.xls'];
const ALLOWED_MIME = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel'
];

/* ================================================================
   SECTION 3 ── DOM REFERENCES
   ================================================================ */
const dropZone    = document.getElementById('dropZone');
const fileInput   = document.getElementById('fileInput');
const browseBtn   = document.getElementById('browseBtn');
const clearBtn    = document.getElementById('clearBtn');
const statusBox   = document.getElementById('statusBox');
const statusIcon  = document.getElementById('statusIcon');
const statusText  = document.getElementById('statusText');
const fileInfoBar = document.getElementById('fileInfoBar');
const fileNameEl  = document.getElementById('fileName');
const fileMetaEl  = document.getElementById('fileMeta');
const tableSection  = document.getElementById('tableSection');
const tableBadge    = document.getElementById('tableBadge');
const tableHead     = document.getElementById('tableHead');
const tableBody     = document.getElementById('tableBody');
const analysisToolbar   = document.getElementById('analysisToolbar');
const columnSelect      = document.getElementById('columnSelect');
const analyzeBtn        = document.getElementById('analyzeBtn');
const analysisSection   = document.getElementById('analysisSection');
const analysisStats     = document.getElementById('analysisStats');
const summaryGrid       = document.getElementById('summaryGrid');
const searchInput       = document.getElementById('searchInput');
const searchClearBtn    = document.getElementById('searchClearBtn');
const filterChips       = document.getElementById('filterChips');
const categoriesContainer = document.getElementById('categoriesContainer');

/* ================================================================
   SECTION 4 ── APP STATE
   ================================================================ */
let appState = {
  rows:         [],
  headers:      [],
  nameColIndex: -1,
  analysisResult: null,
  activeFilter: 'all',
  searchTerm:   ''
};

/* ================================================================
   SECTION 5 ── HELPERS
   ================================================================ */
function getExtension(name) { const i = name.lastIndexOf('.'); return i !== -1 ? name.slice(i).toLowerCase() : ''; }
function isExcelFile(file)  { return ALLOWED_MIME.includes(file.type) || ALLOWED_EXT.includes(getExtension(file.name)); }
function formatFileSize(b)  { if (b < 1024) return b + ' B'; if (b < 1_048_576) return (b/1024).toFixed(1)+' KB'; return (b/1_048_576).toFixed(2)+' MB'; }

/* ================================================================
   SECTION 6 ── UI STATE
   ================================================================ */
function showStatus(type, icon, msg) {
  statusBox.className    = 'status-box ' + type;
  statusIcon.textContent = icon;
  statusText.textContent = msg;
  statusBox.hidden       = false;
}
function hideStatus() { statusBox.hidden = true; statusBox.className = 'status-box'; }

function showFileInfo(name, size, rows) {
  fileNameEl.textContent = name;
  fileMetaEl.textContent = `${formatFileSize(size)} · ${rows} صف`;
  fileInfoBar.hidden     = false;
}
function hideFileInfo() { fileInfoBar.hidden = true; }

function showTableSection()  { tableSection.hidden = false; }
function hideTableSection()  { tableSection.hidden = true; tableHead.innerHTML = ''; tableBody.innerHTML = ''; tableBadge.textContent = '0 صف'; }

function showAnalysisToolbar() { analysisToolbar.hidden = false; }
function hideAnalysisToolbar() { analysisToolbar.hidden = true; }

function showAnalysisSection() { analysisSection.hidden = false; }
function hideAnalysisSection() {
  analysisSection.hidden = true;
  summaryGrid.innerHTML = analysisStats.innerHTML = categoriesContainer.innerHTML = filterChips.innerHTML = '';
}

function resetAll() {
  fileInput.value = '';
  appState = { rows:[], headers:[], nameColIndex:-1, analysisResult:null, activeFilter:'all', searchTerm:'' };
  hideStatus(); hideFileInfo(); hideTableSection(); hideAnalysisToolbar(); hideAnalysisSection();
  columnSelect.innerHTML = '<option value="">-- اختر العمود --</option>';
  analyzeBtn.disabled    = true;
  searchInput.value      = '';
}

/* ================================================================
   SECTION 7 ── EXCEL READING
   ================================================================ */
function processExcelFile(file) {
  const reader = new FileReader();

  reader.onload = function (e) {
    try {
      const data      = new Uint8Array(e.target.result);
      const workbook  = XLSX.read(data, { type:'array' });
      const sheetName = workbook.SheetNames[0];
      const ws        = workbook.Sheets[sheetName];
      const rows      = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
      const nonEmpty  = rows.filter(r => r.some(c => String(c).trim() !== ''));

      if (nonEmpty.length === 0) { showStatus('warning','⚠️','الملف يبدو فارغاً — لم يُعثر على بيانات.'); hideFileInfo(); return; }

      appState.rows    = nonEmpty;
      appState.headers = nonEmpty[0].map(h => String(h));
      const dataCount  = nonEmpty.length - 1;

      showFileInfo(file.name, file.size, dataCount);
      renderTable(nonEmpty);
      populateColumnSelect(appState.headers);
      showAnalysisToolbar();
      showStatus('success','✅',`تم تحميل "${file.name}" — ${dataCount} صف من البيانات.`);

    } catch (err) {
      console.error('SheetJS error:', err);
      showStatus('error','❌','فشل قراءة الملف. تأكد أنه ملف Excel صحيح.');
      resetAll();
    }
  };

  reader.onerror = () => { showStatus('error','❌','حدث خطأ أثناء قراءة الملف.'); resetAll(); };
  reader.readAsArrayBuffer(file);
}

/* ================================================================
   SECTION 8 ── TABLE RENDERING
   ================================================================ */
function renderTable(rows) {
  tableHead.innerHTML = tableBody.innerHTML = '';
  const [headerRow, ...dataRows] = rows;

  const headTr = document.createElement('tr');
  headerRow.forEach((cell, ci) => {
    const th = document.createElement('th');
    th.textContent = cell; th.title = String(cell); th.dataset.col = ci;
    if (ci === appState.nameColIndex) th.classList.add('col-highlight');
    headTr.appendChild(th);
  });
  tableHead.appendChild(headTr);

  dataRows.forEach(row => {
    const tr = document.createElement('tr');
    headerRow.forEach((_, ci) => {
      const td = document.createElement('td');
      const v  = row[ci] !== undefined ? row[ci] : '';
      td.textContent = v; td.title = String(v); td.dataset.col = ci;
      if (ci === appState.nameColIndex) td.classList.add('col-highlight');
      tr.appendChild(td);
    });
    tableBody.appendChild(tr);
  });

  tableBadge.textContent = `${dataRows.length} صف`;
  showTableSection();
}

function refreshColHighlight(colIndex) {
  document.querySelectorAll('.data-table th, .data-table td').forEach(cell => {
    cell.classList.toggle('col-highlight', parseInt(cell.dataset.col) === colIndex);
  });
}

/* ================================================================
   SECTION 9 ── COLUMN AUTO-DETECT
   ================================================================ */
function populateColumnSelect(headers) {
  columnSelect.innerHTML = '<option value="">-- اختر العمود --</option>';
  const hints = ['اسم','مادة','صنف','بند','وصف','المادة','الصنف','البند','الوصف','name','item','desc','material'];
  let best = -1;

  headers.forEach((h, i) => {
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = `(${i+1}) ${h}`;
    columnSelect.appendChild(opt);
    if (best === -1 && hints.some(hint => String(h).toLowerCase().includes(hint))) best = i;
  });

  const autoIdx = best !== -1 ? best : 0;
  columnSelect.value      = autoIdx;
  appState.nameColIndex   = autoIdx;
  analyzeBtn.disabled     = false;
  refreshColHighlight(autoIdx);
}

/* ================================================================
   SECTION 10 ── ANALYSIS ENGINE
   ================================================================ */
function classifyMaterial(name) {
  const s = String(name).trim();
  if (!s) return null;
  for (const cat of CATEGORIES) {
    for (const kw of cat.keywords) {
      if (s.includes(kw)) return { category: cat, matchedKeyword: kw };
    }
  }
  return null;
}

function analyzeItems() {
  const colIdx = appState.nameColIndex;
  const [, ...dataRows] = appState.rows;

  const catMap = {};
  CATEGORIES.forEach(cat => { catMap[cat.name] = { ...cat, items:[] }; });
  const unclassified = [];

  dataRows.forEach((row, ri) => {
    const name = String(row[colIdx] ?? '').trim();
    if (!name) return;
    const match = classifyMaterial(name);
    const entry = { name, rowNumber: ri + 2, rawRow: row };
    if (match) { entry.matchedKeyword = match.matchedKeyword; catMap[match.category.name].items.push(entry); }
    else         unclassified.push(entry);
  });

  return { catMap, unclassified };
}

/* ================================================================
   SECTION 11 ── RENDER ANALYSIS RESULTS
   ================================================================ */
function renderAnalysis(result) {
  const { catMap, unclassified } = result;
  summaryGrid.innerHTML = analysisStats.innerHTML = categoriesContainer.innerHTML = filterChips.innerHTML = '';

  let totalClassified = 0;
  const activeCats = [];
  CATEGORIES.forEach(cat => {
    const items = catMap[cat.name].items;
    if (items.length > 0) { totalClassified += items.length; activeCats.push({ ...cat, items }); }
  });
  const totalAll = totalClassified + unclassified.length;

  analysisStats.innerHTML = `
    <div class="stat-pill total"><span class="pill-num">${totalAll}</span> إجمالي</div>
    <div class="stat-pill catpill"><span class="pill-num">${activeCats.length}</span> فئة</div>
    <div class="stat-pill other"><span class="pill-num">${unclassified.length}</span> غير مصنف</div>
  `;

  buildChip('all','📋','الكل', totalAll,'#8b949e','rgba(139,148,158,0.15)');

  activeCats.forEach(cat => {
    buildSummaryCard(cat, totalAll);
    buildChip(cat.name, cat.icon, cat.name, cat.items.length, cat.color, cat.bg);
    buildCategoryBlock(cat, cat.items);
  });

  if (unclassified.length > 0) {
    const u = { name:'غير مصنف', icon:'❓', color:'#6b7280', bg:'rgba(107,114,128,0.09)', glow:'rgba(107,114,128,0.25)', items:unclassified };
    buildSummaryCard(u, totalAll);
    buildChip('غير مصنف','❓','غير مصنف', unclassified.length,'#6b7280','rgba(107,114,128,0.15)');
    buildCategoryBlock(u, unclassified);
  }

  showAnalysisSection();
  applyFiltersAndSearch();
}

function buildSummaryCard(cat, total) {
  const pct  = total > 0 ? Math.round(cat.items.length / total * 100) : 0;
  const card = document.createElement('div');
  card.className = 'summary-card';
  card.dataset.cat = cat.name;
  card.style.setProperty('--card-accent', cat.color);
  card.style.setProperty('--card-bg',     cat.bg);
  card.style.setProperty('--card-glow',   cat.glow);
  card.innerHTML = `
    <div class="summary-card-icon">${cat.icon}</div>
    <div class="summary-card-name">${cat.name}</div>
    <div class="summary-card-count" style="color:${cat.color}">${cat.items.length}</div>
    <div class="summary-card-label">عنصر</div>
    <span class="summary-card-pct" style="color:${cat.color}">${pct}%</span>
  `;
  card.addEventListener('click', () => setFilter(cat.name));
  summaryGrid.appendChild(card);
}

function buildChip(fv, icon, label, count, color, bg) {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'chip' + (fv === appState.activeFilter ? ' active' : '');
  chip.dataset.filter = fv;
  chip.style.setProperty('--chip-color', color);
  chip.style.setProperty('--chip-bg',    bg);
  chip.innerHTML = `${icon} ${label} <b>${count}</b>`;
  chip.addEventListener('click', () => setFilter(fv));
  filterChips.appendChild(chip);
}

function buildCategoryBlock(cat, items) {
  const block = document.createElement('div');
  block.className   = 'category-block';
  block.dataset.cat = cat.name;

  const header = document.createElement('div');
  header.className = 'category-header open';
  header.innerHTML = `
    <div class="cat-header-left">
      <span class="cat-icon">${cat.icon}</span>
      <span class="cat-name" style="color:${cat.color}">${cat.name}</span>
      <span class="cat-count-badge" style="background:${cat.bg};color:${cat.color};border-color:${cat.color}40">${items.length} عنصر</span>
    </div>
    <svg class="cat-toggle-icon" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
    </svg>
  `;

  const body = document.createElement('div');
  body.className   = 'category-body open';
  body.dataset.cat = cat.name;
  buildItemList(body, items, cat);

  header.addEventListener('click', () => {
    const open = body.classList.toggle('open');
    header.classList.toggle('open', open);
  });

  block.appendChild(header);
  block.appendChild(body);
  categoriesContainer.appendChild(block);
}

function buildItemList(container, items, cat) {
  if (items.length === 0) { container.innerHTML = '<p class="no-items-msg">لا توجد عناصر.</p>'; return; }
  const ul = document.createElement('ul');
  ul.className = 'item-list';
  items.forEach((item, i) => {
    const li = document.createElement('li');
    li.className = 'item-row';
    li.dataset.name = item.name.toLowerCase();
    const kwHtml = item.matchedKeyword
      ? `<span class="item-keyword" style="background:${cat.bg};color:${cat.color}">${item.matchedKeyword}</span>`
      : '';
    li.innerHTML = `
      <span class="item-num">${i + 1}</span>
      ${kwHtml}
      <span class="item-name" title="${item.name}">${item.name}</span>
      <span class="item-row-num">صف ${item.rowNumber}</span>
    `;
    ul.appendChild(li);
  });
  container.appendChild(ul);
}

/* ================================================================
   SECTION 12 ── SEARCH & FILTER
   ================================================================ */
function setFilter(fv) {
  appState.activeFilter = fv;
  document.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.filter === fv));
  document.querySelectorAll('.summary-card').forEach(c => c.classList.toggle('active', c.dataset.cat === fv));
  applyFiltersAndSearch();
}

function applyFiltersAndSearch() {
  const term   = appState.searchTerm.toLowerCase();
  const filter = appState.activeFilter;

  document.querySelectorAll('.category-block').forEach(block => {
    const catName = block.dataset.cat;
    if (filter !== 'all' && catName !== filter) { block.classList.add('hidden-block'); return; }
    block.classList.remove('hidden-block');

    let visible = 0;
    block.querySelectorAll('.item-row').forEach(row => {
      const show = !term || (row.dataset.name||'').includes(term);
      row.style.display = show ? '' : 'none';
      if (show) {
        visible++;
        const nameEl = row.querySelector('.item-name');
        if (term) highlightText(nameEl, term); else clearHighlight(nameEl);
      }
    });

    const body    = block.querySelector('.category-body');
    const oldMsg  = block.querySelector('.search-no-result');
    const hasRows = block.querySelectorAll('.item-row').length > 0;
    if (hasRows && visible === 0) {
      if (!oldMsg) { const p = document.createElement('p'); p.className='no-items-msg search-no-result'; p.textContent=`لا نتائج لـ "${searchInput.value}"`; body.appendChild(p); }
    } else if (oldMsg) oldMsg.remove();
  });
}

function highlightText(el, term) {
  if (!el) return;
  const orig  = el.title || el.textContent;
  el.innerHTML = orig.replace(new RegExp(`(${escRe(term)})`, 'gi'), '<mark>$1</mark>');
}
function clearHighlight(el) { if (el) el.textContent = el.title; }
function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/* ================================================================
   SECTION 13 ── FILE HANDLING
   ================================================================ */
function handleFile(file) {
  if (!file) return;
  if (!isExcelFile(file)) {
    showStatus('error','❌',`"${file.name}" ليس ملف Excel. يرجى اختيار ملف .xlsx أو .xls`);
    fileInput.value = ''; hideFileInfo(); hideTableSection(); hideAnalysisToolbar(); hideAnalysisSection(); return;
  }
  hideStatus();
  processExcelFile(file);
}

/* ================================================================
   SECTION 14 ── EVENT LISTENERS
   ================================================================ */
browseBtn.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('keydown', e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); fileInput.click(); } });
dropZone.addEventListener('click',   e => { if (e.target!==browseBtn && !browseBtn.contains(e.target)) fileInput.click(); });
fileInput.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });

dropZone.addEventListener('dragover',  e => { e.preventDefault(); e.stopPropagation(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', e => { e.preventDefault(); e.stopPropagation(); dropZone.classList.remove('drag-over'); });
dropZone.addEventListener('drop',      e => { e.preventDefault(); e.stopPropagation(); dropZone.classList.remove('drag-over'); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });

clearBtn.addEventListener('click', () => { resetAll(); showStatus('success','🗑️','تم المسح. يمكنك رفع ملف جديد.'); setTimeout(hideStatus, 3000); });

columnSelect.addEventListener('change', () => {
  const idx = parseInt(columnSelect.value, 10);
  if (isNaN(idx)) { analyzeBtn.disabled = true; return; }
  appState.nameColIndex = idx;
  analyzeBtn.disabled   = false;
  refreshColHighlight(idx);
  hideAnalysisSection();
});

analyzeBtn.addEventListener('click', () => {
  if (appState.nameColIndex === -1) return;
  analyzeBtn.textContent = '...جارٍ التحليل';
  analyzeBtn.disabled    = true;
  setTimeout(() => {
    const result = analyzeItems();
    appState.analysisResult = result;
    renderAnalysis(result);
    analyzeBtn.innerHTML = `<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.396 0 2.7.37 3.8 1.016A7.967 7.967 0 0113 14c1.18 0 2.3.25 3.3.696V7.354A7.967 7.967 0 0013 7c-1.18 0-2.3.25-3.3.696A7.968 7.968 0 009 6.804V4.804z"/></svg> تحليل وتصنيف`;
    analyzeBtn.disabled = false;
    analysisSection.scrollIntoView({ behavior:'smooth', block:'start' });
  }, 0);
});

searchInput.addEventListener('input', () => {
  appState.searchTerm   = searchInput.value.trim().toLowerCase();
  searchClearBtn.hidden = appState.searchTerm === '';
  applyFiltersAndSearch();
});

searchClearBtn.addEventListener('click', () => {
  searchInput.value = ''; appState.searchTerm = ''; searchClearBtn.hidden = true;
  document.querySelectorAll('.item-name').forEach(clearHighlight);
  applyFiltersAndSearch();
});
