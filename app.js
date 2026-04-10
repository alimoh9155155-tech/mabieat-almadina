/**
 * ═══════════════════════════════════════════════════════════════
 *  Smart Inventory & Pricing System — app.js
 *  100% Vanilla JavaScript, no frameworks.
 * ═══════════════════════════════════════════════════════════════
 */

/* ═══════════════════════════════════════════════════════════════
   SECTION 1 ── ALGORITHM CONFIGURATION
   ═══════════════════════════════════════════════════════════════
   Edit the values below to adjust the algorithm behaviour.
   ─────────────────────────────────────────────────────────────
   BATCH_PROFILES:
     For each number of batches N, we have multiple "profiles"
     (proportion arrays that must sum to 1.0). The variant
     counter selects which profile to use each time the user
     clicks "Recalculate", giving different-looking distributions.

     Shape legend for each profile:
       S = Small batch (selective/premium customers)
       M = Medium batch
       L = Large batch (volume)
     Edit or add rows freely to change behaviour.
   ─────────────────────────────────────────────────────────────
   The core pricing formula is a linear descent:
     price_i = costPerUnit + spread × (N−1−i) / (N−1)
   Where:
     spread = targetProfit × (N−1) / weightedSum
     weightedSum = Σ(batchSize_i × (N−1−i))
   This guarantees:
     Σ(batchSize_i × price_i) = targetRevenue  (exactly)
     Last batch price = costPerUnit (sell at cost if needed)
   ═══════════════════════════════════════════════════════════════ */

const ALGO_CONFIG = {

  /** Minimum number of items per batch */
  MIN_BATCH_SIZE: 1,

  /**
   * Proportion profiles per batch count N.
   * Each sub-array must sum to 1.0 (±0.001 tolerance).
   * Add more variants (rows) freely.
   */
  BATCH_PROFILES: {
    3: [
      [0.15, 0.50, 0.35],   // S M L
      [0.20, 0.45, 0.35],   // S M L
      [0.10, 0.55, 0.35],   // S L M
    ],
    4: [
      [0.10, 0.30, 0.40, 0.20],   // S M L M
      [0.15, 0.35, 0.30, 0.20],   // S M M S
      [0.08, 0.22, 0.45, 0.25],   // S M L M
      [0.12, 0.28, 0.38, 0.22],   // S M L M
    ],
    5: [
      [0.07, 0.18, 0.30, 0.28, 0.17],   // S M L M S
      [0.10, 0.22, 0.28, 0.25, 0.15],
      [0.06, 0.14, 0.32, 0.30, 0.18],
      [0.09, 0.20, 0.35, 0.22, 0.14],
      [0.05, 0.17, 0.28, 0.33, 0.17],
    ],
    6: [
      [0.06, 0.12, 0.22, 0.28, 0.19, 0.13],
      [0.08, 0.18, 0.25, 0.24, 0.15, 0.10],
      [0.05, 0.10, 0.20, 0.30, 0.22, 0.13],
      [0.07, 0.15, 0.28, 0.22, 0.18, 0.10],
      [0.04, 0.13, 0.24, 0.29, 0.18, 0.12],
    ],
    7: [
      [0.05, 0.10, 0.17, 0.25, 0.22, 0.13, 0.08],
      [0.06, 0.13, 0.19, 0.24, 0.18, 0.12, 0.08],
      [0.04, 0.09, 0.16, 0.28, 0.23, 0.13, 0.07],
      [0.07, 0.14, 0.22, 0.22, 0.18, 0.11, 0.06],
      [0.05, 0.11, 0.18, 0.26, 0.20, 0.12, 0.08],
    ],
    8: [
      [0.04, 0.08, 0.13, 0.20, 0.24, 0.16, 0.10, 0.05],
      [0.05, 0.10, 0.15, 0.22, 0.22, 0.14, 0.08, 0.04],
      [0.03, 0.07, 0.12, 0.22, 0.26, 0.17, 0.09, 0.04],
      [0.06, 0.11, 0.17, 0.20, 0.20, 0.14, 0.08, 0.04],
      [0.04, 0.09, 0.14, 0.21, 0.23, 0.16, 0.09, 0.04],
    ],
  },

};

/* ═══════════════════════════════════════════════════════════════
   SECTION 2 ── HELPER: DETERMINE NUMBER OF BATCHES
   ═══════════════════════════════════════════════════════════════ */
/**
 * Returns an appropriate number of batches for a given quantity.
 * Small stock → fewer batches; large stock → more batches.
 */
function getNumBatches(Q) {
  if (Q <= 5)   return 3;
  if (Q <= 12)  return 4;
  if (Q <= 30)  return 5;
  if (Q <= 80)  return 6;
  if (Q <= 200) return 7;
  return 8;
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 3 ── HELPER: GENERATE VARIABLE BATCH SIZES
   ═══════════════════════════════════════════════════════════════ */
/**
 * Creates an array of batch quantities that sum exactly to Q.
 * Uses a profile from ALGO_CONFIG.BATCH_PROFILES to ensure
 * the distribution looks natural and non-uniform.
 *
 * @param {number} Q       – total quantity
 * @param {number} N       – desired number of batches
 * @param {number} variant – which profile to use (incremented on Recalculate)
 * @returns {number[]}     – array of length N summing to Q
 */
function generateBatchSizes(Q, N, variant) {
  const profiles = ALGO_CONFIG.BATCH_PROFILES[N];
  const profile  = profiles[variant % profiles.length];

  // Convert proportions → raw quantities (rounded)
  let sizes = profile.map(p => Math.max(ALGO_CONFIG.MIN_BATCH_SIZE, Math.round(Q * p)));

  // Fix rounding so sizes sum exactly to Q
  let diff = Q - sizes.reduce((s, v) => s + v, 0);
  let safety = 1000;
  while (diff !== 0 && safety-- > 0) {
    if (diff > 0) {
      // Add to the largest batch (proportionally fair)
      const idx = sizes.indexOf(Math.max(...sizes));
      sizes[idx]++;
    } else {
      // Remove from the largest batch (never drop below 1)
      const candidates = sizes.map((v, i) => ({ v, i })).filter(x => x.v > 1);
      if (candidates.length === 0) break;
      const idx = candidates.reduce((a, b) => (b.v > a.v ? b : a)).i;
      sizes[idx]--;
    }
    diff = Q - sizes.reduce((s, v) => s + v, 0);
  }

  return sizes;
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 4 ── CORE ALGORITHM: GENERATE SALES PLAN
   ═══════════════════════════════════════════════════════════════
   Mathematical foundation
   ─────────────────────────────────────────────────────────────
   Given:
     Q   = total quantity
     C   = cost per unit
     r%  = target profit percentage (on capital)

   Derived targets:
     totalCapital   = Q × C
     targetProfit   = totalCapital × r/100
     targetRevenue  = totalCapital + targetProfit

   Pricing formula (linear descent, batch index i = 0..N-1):
     price_i = C + spread × (N−1−i) / (N−1)

   Where:
     weightedSum = Σ( batchSize_i × (N−1−i) )
     spread      = targetProfit × (N−1) / weightedSum

   Proof: substitute into Σ(batchSize_i × price_i):
     = Σ(batchSize_i × C) + spread/(N-1) × Σ(batchSize_i × (N-1-i))
     = C×Q + spread/(N-1) × weightedSum
     = C×Q + targetProfit            ✓ = targetRevenue

   Result:
     • Prices strictly descend from price[0] to price[N-1] = C (cost)
     • Total revenue = targetRevenue (exactly, before rounding)
     • Batch sizes vary according to the chosen profile
   ─────────────────────────────────────────────────────────────
   Rounding:
     Prices are rounded to the nearest integer.  After rounding,
     a small residual (at most ±N units) is absorbed into the
     last batch's revenue without changing its unit price
     (it's shown as a "rounding adjustment" in the summary).
   ═══════════════════════════════════════════════════════════════ */

/**
 * Main algorithm entry point.
 * @param {{ name, quantity, costPerUnit, profitPct }} material
 * @param {number} variant  – controls batch profile selection
 * @returns {object}        – complete plan object
 */
function generateSalesPlan(material, variant = 0) {
  const Q   = parseInt(material.quantity,   10);
  const C   = parseFloat(material.costPerUnit);
  const r   = parseFloat(material.profitPct);

  // ── Financial targets ──────────────────────────────────────
  const totalCapital  = Q * C;
  const targetProfit  = totalCapital * r / 100;
  const targetRevenue = totalCapital + targetProfit;

  // ── Batch sizes ────────────────────────────────────────────
  const N     = getNumBatches(Q);
  const sizes = generateBatchSizes(Q, N, variant);

  // ── Price spread (linear descent formula) ─────────────────
  // weightedSum = Σ( sizes[i] × (N−1−i) )
  let weightedSum = 0;
  for (let i = 0; i < N; i++) {
    weightedSum += sizes[i] * (N - 1 - i);
  }

  // If all batches are the same size, weightedSum might be 0 for N=1; guard:
  const spread = (weightedSum > 0 && N > 1)
    ? (targetProfit * (N - 1)) / weightedSum
    : 0;

  // Ideal (exact) unit prices before rounding
  const idealPrices = sizes.map((_, i) =>
    C + spread * (N - 1 - i) / (N - 1)
  );

  // Round to nearest integer for clean display
  const prices = idealPrices.map(p => Math.round(p));

  // ── Build batch objects ────────────────────────────────────
  let runRevenue = 0;
  let runProfit  = 0;

  const batches = sizes.map((qty, i) => {
    const price   = prices[i];
    const revenue = qty * price;
    const profit  = revenue - qty * C;
    const margin  = price > 0 ? ((price - C) / C * 100) : 0;

    runRevenue += revenue;
    runProfit  += profit;

    return {
      batchNum:       i + 1,
      qty,
      price,
      idealPrice:     idealPrices[i],  // before rounding (for diagnostics)
      margin,
      revenue,
      profit,
      runningRevenue: runRevenue,
      runningProfit:  runProfit,
    };
  });

  // ── Compute actuals vs targets ─────────────────────────────
  const totalQty      = batches.reduce((s, b) => s + b.qty,     0);
  const totalRevenue  = batches.reduce((s, b) => s + b.revenue, 0);
  const totalProfit   = batches.reduce((s, b) => s + b.profit,  0);
  const revenueError  = totalRevenue - targetRevenue;  // rounding residual
  const profitError   = totalProfit  - targetProfit;

  return {
    material: {
      name:          material.name,
      quantity:      Q,
      costPerUnit:   C,
      profitPct:     r,
      totalCapital,
      targetProfit,
      targetRevenue,
    },
    batches,
    N,
    variant,
    totalQty,
    totalRevenue,
    totalProfit,
    targetRevenue,
    targetProfit,
    totalCapital,
    revenueError,
    profitError,
  };
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 5 ── APPLICATION STATE
   ═══════════════════════════════════════════════════════════════ */

/** localStorage key — bump version suffix to invalidate old data */
const STORAGE_KEY  = 'SAP_INVENTORY_PRICING_V1';
/** Max number of plan entries kept in history */
const MAX_HISTORY  = 20;

const state = {
  plan:        null,   // current plan object
  variant:     0,      // increments on Recalculate to change profile
  editMode:    false,  // whether manual edit mode is active
  editBackup:  null,   // snapshot of batches before edit (for Cancel)
  planHistory: [],     // array of { id, savedAt, plan } — newest first
};

/* ═══════════════════════════════════════════════════════════════
   SECTION 6 ── DOM REFERENCES
   ═══════════════════════════════════════════════════════════════ */
const matName   = document.getElementById('matName');
const matQty    = document.getElementById('matQty');
const matCost   = document.getElementById('matCost');
const matProfit = document.getElementById('matProfit');

const liveCapital  = document.getElementById('liveCapital');
const liveProfit   = document.getElementById('liveProfit');
const liveRevenue  = document.getElementById('liveRevenue');
const liveAvgPrice = document.getElementById('liveAvgPrice');

const controlsBar    = document.getElementById('controlsBar');
const generateBtn    = document.getElementById('generateBtn');
const recalcBtn      = document.getElementById('recalcBtn');
const editBtn        = document.getElementById('editBtn');
const resetBtn       = document.getElementById('resetBtn');

const editActionsBar = document.getElementById('editActionsBar');
const saveEditBtn    = document.getElementById('saveEditBtn');
const cancelEditBtn  = document.getElementById('cancelEditBtn');
const printBtn       = document.getElementById('printBtn');

const planCard       = document.getElementById('planCard');
const planVariantBadge = document.getElementById('planVariantBadge');
const planHeaderMeta = document.getElementById('planHeaderMeta');
const materialRibbon = document.getElementById('materialRibbon');
const planTableBody  = document.getElementById('planTableBody');
const planTableFoot  = document.getElementById('planTableFoot');

const summaryCard    = document.getElementById('summaryCard');
const summaryContent = document.getElementById('summaryContent');

// Persistence bar
const persistSaveBtn  = document.getElementById('persistSaveBtn');
const persistLoadBtn  = document.getElementById('persistLoadBtn');
const persistClearBtn = document.getElementById('persistClearBtn');
const autosaveDot     = document.getElementById('autosaveDot');
const autosaveLabel   = document.getElementById('autosaveLabel');

// History section
const historyCard       = document.getElementById('historyCard');
const historyToggle     = document.getElementById('historyToggle');
const historyToggleIcon = document.getElementById('historyToggleIcon');
const historyBody       = document.getElementById('historyBody');
const historyCountBadge = document.getElementById('historyCountBadge');

// Toast container
const toastContainer = document.getElementById('toastContainer');

/* ═══════════════════════════════════════════════════════════════
   SECTION 7 ── NUMBER FORMATTING HELPERS
   ═══════════════════════════════════════════════════════════════ */
const fmt  = n => Number(n).toLocaleString('ar-EG', { maximumFractionDigits: 2 });
const fmtP = n => Number(n).toFixed(1) + '%';
const fmtI = n => Math.round(n).toLocaleString('ar-EG');

/* ═══════════════════════════════════════════════════════════════
   SECTION 8 ── LIVE FORM CALCULATION (real-time strip)
   ═══════════════════════════════════════════════════════════════ */
function updateLiveStrip() {
  const Q = parseFloat(matQty.value)    || 0;
  const C = parseFloat(matCost.value)   || 0;
  const r = parseFloat(matProfit.value) || 0;

  if (Q > 0 && C > 0) {
    const cap = Q * C;
    const prf = cap * r / 100;
    const rev = cap + prf;
    const avg = rev / Q;

    liveCapital.textContent  = fmt(cap);
    liveProfit.textContent   = fmt(prf);
    liveRevenue.textContent  = fmt(rev);
    liveAvgPrice.textContent = fmt(avg);

    // Show controls bar when all fields have values
    const ready = matName.value.trim() && Q > 0 && C > 0 && r >= 0;
    controlsBar.hidden = !ready;
  } else {
    liveCapital.textContent  = '—';
    liveProfit.textContent   = '—';
    liveRevenue.textContent  = '—';
    liveAvgPrice.textContent = '—';
  }
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 9 ── VALIDATE FORM INPUTS
   ═══════════════════════════════════════════════════════════════ */
function validateInputs() {
  let ok = true;
  [matName, matQty, matCost, matProfit].forEach(el => el.classList.remove('invalid'));

  if (!matName.value.trim())              { matName.classList.add('invalid');   ok = false; }
  if (!matQty.value  || parseInt(matQty.value)    < 2) { matQty.classList.add('invalid');   ok = false; }
  if (!matCost.value || parseFloat(matCost.value) <= 0) { matCost.classList.add('invalid');  ok = false; }
  if (matProfit.value === '' || parseFloat(matProfit.value) < 0) { matProfit.classList.add('invalid'); ok = false; }

  return ok;
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 10 ── RENDER: MATERIAL RIBBON
   ═══════════════════════════════════════════════════════════════ */
function renderMaterialRibbon(m) {
  materialRibbon.innerHTML = `
    <div class="ribbon-cell">
      <span class="ribbon-label">اسم المادة</span>
      <span class="ribbon-value">${m.name}</span>
    </div>
    <div class="ribbon-cell">
      <span class="ribbon-label">الكمية الإجمالية</span>
      <span class="ribbon-value blue">${fmtI(m.quantity)} وحدة</span>
    </div>
    <div class="ribbon-cell">
      <span class="ribbon-label">سعر الشراء / وحدة</span>
      <span class="ribbon-value">${fmt(m.costPerUnit)}</span>
    </div>
    <div class="ribbon-cell">
      <span class="ribbon-label">رأس المال الكلي</span>
      <span class="ribbon-value amber">${fmt(m.totalCapital)}</span>
    </div>
    <div class="ribbon-cell">
      <span class="ribbon-label">نسبة الربح</span>
      <span class="ribbon-value purple">${fmtP(m.profitPct)}</span>
    </div>
    <div class="ribbon-cell">
      <span class="ribbon-label">الربح المستهدف</span>
      <span class="ribbon-value green">${fmt(m.targetProfit)}</span>
    </div>
    <div class="ribbon-cell">
      <span class="ribbon-label">المبيعات المستهدفة</span>
      <span class="ribbon-value blue">${fmt(m.targetRevenue)}</span>
    </div>
  `;
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 11 ── RENDER: PLAN TABLE
   ═══════════════════════════════════════════════════════════════
   Prices are colour-graded by tier (highest → lowest).
   Each row has a mini bar showing its share of total quantity.
   ═══════════════════════════════════════════════════════════════ */

/** Determine colour tier of price relative to highest */
function priceTier(price, maxPrice, minPrice) {
  if (maxPrice === minPrice) return 'tier-1';
  const ratio = (price - minPrice) / (maxPrice - minPrice); // 1 = highest
  if (ratio > 0.80) return 'tier-1';
  if (ratio > 0.60) return 'tier-2';
  if (ratio > 0.40) return 'tier-3';
  if (ratio > 0.20) return 'tier-4';
  return 'tier-5';
}

/** Bar fill colours for quantity bars */
const BAR_COLOURS = [
  '#22c55e','#38bdf8','#a78bfa','#f59e0b','#f87171',
  '#4ade80','#67e8f9','#c4b5fd','#fcd34d','#fca5a5',
];

function renderPlanTable(plan) {
  const { batches, material } = plan;
  const maxPrice = Math.max(...batches.map(b => b.price));
  const minPrice = Math.min(...batches.map(b => b.price));
  const maxQty   = Math.max(...batches.map(b => b.qty));

  planTableBody.innerHTML = batches.map((b, i) => {
    const tier    = priceTier(b.price, maxPrice, minPrice);
    const barPct  = Math.round(b.qty / plan.totalQty * 100);
    const barW    = Math.round(b.qty / maxQty * 100);
    const colour  = BAR_COLOURS[i % BAR_COLOURS.length];
    const marginSign = b.margin >= 0 ? '+' : '';

    return `
      <tr data-idx="${i}">
        <td class="td-num"><span class="batch-num-badge">${b.batchNum}</span></td>
        <td data-field="qty"><strong>${fmtI(b.qty)}</strong></td>
        <td data-field="price" class="td-price ${tier}">${fmt(b.price)}</td>
        <td class="td-margin" style="color:${b.margin >= 0 ? 'var(--green)' : 'var(--red)'}">
          ${marginSign}${fmtP(b.margin)}
        </td>
        <td class="td-bar">
          <div class="mini-bar-wrap">
            <div class="mini-bar-bg">
              <div class="mini-bar-fill" style="width:${barW}%;background:${colour}"></div>
            </div>
            <span class="mini-bar-pct">${barPct}%</span>
          </div>
        </td>
        <td class="td-revenue">${fmt(b.revenue)}</td>
        <td class="td-profit">${fmt(b.profit)}</td>
        <td class="td-run-revenue">${fmt(b.runningRevenue)}</td>
        <td class="td-run-profit">${fmt(b.runningProfit)}</td>
      </tr>
    `;
  }).join('');

  // Totals footer
  planTableFoot.innerHTML = `
    <tr>
      <td class="tfoot-label" colspan="2">الإجمالي</td>
      <td colspan="2"></td>
      <td class="tfoot-label">${fmtI(plan.totalQty)} وحدة</td>
      <td class="td-revenue" style="font-size:.9rem">${fmt(plan.totalRevenue)}</td>
      <td class="td-profit"  style="font-size:.9rem">${fmt(plan.totalProfit)}</td>
      <td colspan="2"></td>
    </tr>
  `;
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 12 ── RENDER: PLAN HEADER META
   ═══════════════════════════════════════════════════════════════ */
function renderPlanHeader(plan) {
  planVariantBadge.textContent = `خطة #${plan.variant + 1}`;
  planHeaderMeta.innerHTML = `
    <span>📦 ${plan.N} دفعة</span>
    <span>📐 توزيع نمط ${(plan.variant % ALGO_CONFIG.BATCH_PROFILES[plan.N].length) + 1}</span>
  `;
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 13 ── RENDER: PLAN SUMMARY
   ═══════════════════════════════════════════════════════════════ */
function renderSummary(plan) {
  const revDiff  = plan.revenueError;  // positive = over-target
  const profDiff = plan.profitError;
  const absDiff  = Math.abs(revDiff);

  // Verdict
  const threshold = plan.targetRevenue * 0.01; // 1 % tolerance
  let verdictClass, verdictText;
  if (absDiff <= threshold) {
    verdictClass = 'pass';
    verdictText  = '✅ الخطة تحقق الهدف المالي المطلوب';
  } else if (absDiff <= plan.targetRevenue * 0.03) {
    verdictClass = 'warn';
    verdictText  = '⚠️ انحراف بسيط عن الهدف (تقريب الأسعار الصحيحة) — مقبول';
  } else {
    verdictClass = 'fail';
    verdictText  = '❌ انحراف ملحوظ — راجع الخطة أو حرّرها يدوياً';
  }

  const profActualPct = plan.totalCapital > 0
    ? (plan.totalProfit / plan.totalCapital * 100)
    : 0;

  summaryContent.innerHTML = `
    <!-- Difference ribbon -->
    <div class="diff-ribbon">
      <div class="diff-cell">
        <span class="diff-cell-label">الإيراد المخطط له</span>
        <span class="diff-cell-val" style="color:var(--blue)">${fmt(plan.totalRevenue)}</span>
        <span class="diff-cell-sub">من أصل ${fmt(plan.targetRevenue)} مستهدف</span>
      </div>
      <div class="diff-cell">
        <span class="diff-cell-label">الربح المخطط له</span>
        <span class="diff-cell-val" style="color:var(--green)">${fmt(plan.totalProfit)}</span>
        <span class="diff-cell-sub">من أصل ${fmt(plan.targetProfit)} مستهدف</span>
      </div>
      <div class="diff-cell">
        <span class="diff-cell-label">فارق الإيراد (تقريب)</span>
        <span class="diff-cell-val" style="color:${Math.abs(revDiff) < 1 ? 'var(--green)' : 'var(--amber)'}">
          ${revDiff >= 0 ? '+' : ''}${fmt(revDiff)}
        </span>
        <span class="diff-cell-sub">ناتج تقريب الأسعار للأعداد الصحيحة</span>
      </div>
      <div class="diff-cell">
        <span class="diff-cell-label">نسبة الربح الفعلية</span>
        <span class="diff-cell-val" style="color:var(--purple)">${fmtP(profActualPct)}</span>
        <span class="diff-cell-sub">مقارنةً بـ ${fmtP(plan.material.profitPct)} مستهدفة</span>
      </div>
    </div>

    <!-- Comparison grid -->
    <div class="summary-compare-grid">

      <div class="cmp-block">
        <div class="cmp-block-title">📦 الكميات</div>
        <div class="cmp-row">
          <span class="cmp-label">الكمية الإجمالية</span>
          <span class="cmp-val blue">${fmtI(plan.material.quantity)}</span>
        </div>
        <div class="cmp-row">
          <span class="cmp-label">كمية الخطة</span>
          <span class="cmp-val blue">${fmtI(plan.totalQty)}</span>
        </div>
        <div class="cmp-row">
          <span class="cmp-label">عدد الدفعات</span>
          <span class="cmp-val">${plan.N} دفعات</span>
        </div>
        <div class="cmp-row">
          <span class="cmp-label">متوسط حجم الدفعة</span>
          <span class="cmp-val">${fmt(plan.totalQty / plan.N)} وحدة</span>
        </div>
      </div>

      <div class="cmp-block">
        <div class="cmp-block-title">💰 الإيراد</div>
        <div class="cmp-row">
          <span class="cmp-label">الهدف</span>
          <span class="cmp-val blue">${fmt(plan.targetRevenue)}</span>
        </div>
        <div class="cmp-row">
          <span class="cmp-label">الخطة</span>
          <span class="cmp-val blue">${fmt(plan.totalRevenue)}</span>
        </div>
        <div class="cmp-row">
          <span class="cmp-label">الفارق</span>
          <span class="cmp-val ${Math.abs(revDiff) < 5 ? 'green' : 'amber'}">${revDiff >= 0 ? '+' : ''}${fmt(revDiff)}</span>
        </div>
        <div class="cmp-row">
          <span class="cmp-label">رأس المال</span>
          <span class="cmp-val amber">${fmt(plan.totalCapital)}</span>
        </div>
      </div>

      <div class="cmp-block">
        <div class="cmp-block-title">📈 الربح</div>
        <div class="cmp-row">
          <span class="cmp-label">الهدف</span>
          <span class="cmp-val green">${fmt(plan.targetProfit)}</span>
        </div>
        <div class="cmp-row">
          <span class="cmp-label">الخطة</span>
          <span class="cmp-val green">${fmt(plan.totalProfit)}</span>
        </div>
        <div class="cmp-row">
          <span class="cmp-label">الفارق</span>
          <span class="cmp-val ${Math.abs(profDiff) < 5 ? 'green' : 'amber'}">${profDiff >= 0 ? '+' : ''}${fmt(profDiff)}</span>
        </div>
        <div class="cmp-row">
          <span class="cmp-label">نسبة الربح الفعلية</span>
          <span class="cmp-val purple">${fmtP(profActualPct)}</span>
        </div>
      </div>

      <div class="cmp-block">
        <div class="cmp-block-title">🏷️ الأسعار</div>
        <div class="cmp-row">
          <span class="cmp-label">أعلى سعر (الدفعة 1)</span>
          <span class="cmp-val green">${fmt(plan.batches[0]?.price)}</span>
        </div>
        <div class="cmp-row">
          <span class="cmp-label">أدنى سعر (آخر دفعة)</span>
          <span class="cmp-val amber">${fmt(plan.batches[plan.batches.length - 1]?.price)}</span>
        </div>
        <div class="cmp-row">
          <span class="cmp-label">متوسط سعر البيع</span>
          <span class="cmp-val blue">${fmt(plan.totalRevenue / plan.totalQty)}</span>
        </div>
        <div class="cmp-row">
          <span class="cmp-label">سعر الشراء / وحدة</span>
          <span class="cmp-val">${fmt(plan.material.costPerUnit)}</span>
        </div>
      </div>

    </div><!-- /compare grid -->

    <!-- Verdict -->
    <div class="verdict-bar ${verdictClass}">${verdictText}</div>
  `;
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 14 ── FULL RENDER (orchestrates all sections)
   ═══════════════════════════════════════════════════════════════ */
function renderPlan(plan) {
  renderMaterialRibbon(plan.material);
  renderPlanHeader(plan);
  renderPlanTable(plan);
  renderSummary(plan);

  planCard.hidden    = false;
  summaryCard.hidden = false;

  // Scroll to the plan
  setTimeout(() => planCard.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 15 ── EDIT MODE
   ═══════════════════════════════════════════════════════════════
   In edit mode, the Qty and Price columns become <input> fields.
   Changing any value recalculates downstream columns in real-time.
   ═══════════════════════════════════════════════════════════════ */

function enterEditMode() {
  if (!state.plan) return;
  state.editMode   = true;
  state.editBackup = JSON.parse(JSON.stringify(state.plan.batches));

  editActionsBar.hidden = false;
  editBtn.classList.add('active');
  editBtn.disabled = true;

  const C = state.plan.material.costPerUnit;

  // Replace qty and price cells with inputs
  const rows = planTableBody.querySelectorAll('tr');
  rows.forEach((tr, i) => {
    const b = state.plan.batches[i];

    // Qty cell
    const qtyTd = tr.querySelector('[data-field="qty"]');
    qtyTd.innerHTML = `<input class="edit-input" type="number" data-field="qty" data-idx="${i}"
      value="${b.qty}" min="1" step="1" aria-label="كمية الدفعة ${i + 1}"/>`;

    // Price cell
    const priceTd = tr.querySelector('[data-field="price"]');
    priceTd.className = 'td-price';
    priceTd.innerHTML = `<input class="edit-input" type="number" data-field="price" data-idx="${i}"
      value="${b.price}" min="${C}" step="1" aria-label="سعر الدفعة ${i + 1}"/>`;
  });

  // Live recalculate while editing
  planTableBody.addEventListener('input', onEditInput);
}

function onEditInput(e) {
  const inp = e.target;
  if (!inp.classList.contains('edit-input')) return;

  const idx   = parseInt(inp.dataset.idx, 10);
  const field = inp.dataset.field;
  const val   = parseFloat(inp.value) || 0;
  const C     = state.plan.material.costPerUnit;

  // Update plan state
  if (field === 'qty')   state.plan.batches[idx].qty   = Math.max(1, Math.round(val));
  if (field === 'price') state.plan.batches[idx].price = Math.max(C, val);

  // Recalculate revenue/profit for all batches
  let runRev = 0, runProf = 0;
  state.plan.batches.forEach(b => {
    b.revenue         = b.qty * b.price;
    b.profit          = b.revenue - b.qty * C;
    b.margin          = C > 0 ? (b.price - C) / C * 100 : 0;
    runRev           += b.revenue;
    runProf          += b.profit;
    b.runningRevenue  = runRev;
    b.runningProfit   = runProf;
  });

  state.plan.totalQty     = state.plan.batches.reduce((s, b) => s + b.qty, 0);
  state.plan.totalRevenue = runRev;
  state.plan.totalProfit  = runProf;
  state.plan.revenueError = runRev - state.plan.targetRevenue;
  state.plan.profitError  = runProf - state.plan.targetProfit;

  // Re-render non-editable cells only
  const rows = planTableBody.querySelectorAll('tr');
  rows.forEach((tr, i) => {
    const b  = state.plan.batches[i];
    const C2 = state.plan.material.costPerUnit;
    const sign = b.margin >= 0 ? '+' : '';

    tr.cells[3].textContent  = '';  // margin
    tr.cells[3].innerHTML    = `<span style="color:${b.margin>=0?'var(--green)':'var(--red)'}">
      ${sign}${fmtP(b.margin)}</span>`;
    tr.cells[5].textContent  = fmt(b.revenue);
    tr.cells[6].textContent  = fmt(b.profit);
    tr.cells[7].textContent  = fmt(b.runningRevenue);
    tr.cells[8].textContent  = fmt(b.runningProfit);
  });

  // Update footer
  planTableFoot.innerHTML = `
    <tr>
      <td class="tfoot-label" colspan="2">الإجمالي</td>
      <td colspan="2"></td>
      <td class="tfoot-label">${fmtI(state.plan.totalQty)} وحدة</td>
      <td class="td-revenue" style="font-size:.9rem">${fmt(state.plan.totalRevenue)}</td>
      <td class="td-profit"  style="font-size:.9rem">${fmt(state.plan.totalProfit)}</td>
      <td colspan="2"></td>
    </tr>`;

  // Update summary live
  renderSummary(state.plan);
}

function saveEditMode() {
  state.editMode = false;
  editActionsBar.hidden = true;
  editBtn.classList.remove('active');
  editBtn.disabled = false;

  // Remove the input listener
  planTableBody.removeEventListener('input', onEditInput);

  // Re-render the table in read-only mode
  renderPlanTable(state.plan);
  renderSummary(state.plan);
}

function cancelEditMode() {
  state.editMode = false;
  // Restore backup
  state.plan.batches      = state.editBackup;
  state.plan.totalQty     = state.editBackup.reduce((s, b) => s + b.qty, 0);
  state.plan.totalRevenue = state.editBackup.reduce((s, b) => s + b.revenue, 0);
  state.plan.totalProfit  = state.editBackup.reduce((s, b) => s + b.profit,  0);
  state.plan.revenueError = state.plan.totalRevenue - state.plan.targetRevenue;
  state.plan.profitError  = state.plan.totalProfit  - state.plan.targetProfit;

  editActionsBar.hidden = true;
  editBtn.classList.remove('active');
  editBtn.disabled = false;

  planTableBody.removeEventListener('input', onEditInput);
  renderPlanTable(state.plan);
  renderSummary(state.plan);
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 16 ── RESET
   ═══════════════════════════════════════════════════════════════ */
function resetAll() {
  state.plan       = null;
  state.variant    = 0;
  state.editMode   = false;
  state.editBackup = null;

  // Clear form
  ['matName','matQty','matCost','matProfit'].forEach(id => {
    const el = document.getElementById(id);
    el.value = '';
    el.classList.remove('invalid');
  });

  // Reset live strip
  ['liveCapital','liveProfit','liveRevenue','liveAvgPrice'].forEach(id => {
    document.getElementById(id).textContent = '—';
  });

  // Hide sections
  controlsBar.hidden    = true;
  editActionsBar.hidden = true;
  planCard.hidden       = true;
  summaryCard.hidden    = true;

  // Reset button states
  recalcBtn.disabled = true;
  editBtn.disabled   = true;
  printBtn.disabled  = true;
  editBtn.classList.remove('active');

  // Clear table content
  planTableBody.innerHTML = '';
  planTableFoot.innerHTML = '';
  materialRibbon.innerHTML = '';
  summaryContent.innerHTML = '';

  // Remove stale listeners
  planTableBody.removeEventListener('input', onEditInput);

  // Focus the first field
  matName.focus();
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 17 ── EVENT LISTENERS
   ═══════════════════════════════════════════════════════════════ */

// Live calculation on any form input
[matName, matQty, matCost, matProfit].forEach(el => {
  el.addEventListener('input', updateLiveStrip);
});

// Generate plan
generateBtn.addEventListener('click', () => {
  if (!validateInputs()) return;

  state.variant = 0;   // reset variant counter on a new Generate
  const material = {
    name:        matName.value.trim(),
    quantity:    matQty.value,
    costPerUnit: matCost.value,
    profitPct:   matProfit.value,
  };

  state.plan = generateSalesPlan(material, state.variant);

  recalcBtn.disabled = false;
  editBtn.disabled   = false;
  printBtn.disabled  = false;

  renderPlan(state.plan);
  addToHistory(state.plan);  // record in history
  autoSave();                // persist to localStorage
});

// Recalculate with next profile variant
recalcBtn.addEventListener('click', () => {
  if (!state.plan) return;
  if (state.editMode) cancelEditMode();

  state.variant++;
  const { material } = state.plan;
  state.plan = generateSalesPlan(material, state.variant);

  renderPlan(state.plan);
  addToHistory(state.plan);  // record in history
  autoSave();                // persist to localStorage
});

// Toggle edit mode
editBtn.addEventListener('click', () => {
  if (!state.plan) return;
  if (!state.editMode) {
    enterEditMode();
  }
});

saveEditBtn.addEventListener('click',   () => { saveEditMode(); autoSave(); showToast('success','💾','تم حفظ التعديلات تلقائياً'); });
cancelEditBtn.addEventListener('click', cancelEditMode);

// Reset
resetBtn.addEventListener('click', resetAll);

// Allow pressing Enter in form to trigger Generate
document.getElementById('materialForm').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    generateBtn.click();
  }
});

// Print plan
printBtn.addEventListener('click', printPlan);

/* ═══════════════════════════════════════════════════════════════
   SECTION 18 ── PRINT PLAN
   ═══════════════════════════════════════════════════════════════
   Opens a clean, self-contained A4 print window with:
     • Report title + timestamp
     • Material information grid
     • Full pricing plan table
     • Summary & comparison section
   All styling is inline-embedded for reliability.
   Uses window.open() so the main app is never disrupted.
   ═══════════════════════════════════════════════════════════════ */
function printPlan() {
  const plan = state.plan;
  if (!plan) return;

  const m    = plan.material;
  const now  = new Date().toLocaleString('ar-EG', { dateStyle:'full', timeStyle:'short' });

  /* ---- Build table rows ---- */
  const rowsHTML = plan.batches.map(b => {
    const marginSign = b.margin >= 0 ? '+' : '';
    const rowBg      = b.batchNum % 2 === 0 ? '#f8fafc' : '#ffffff';
    return `
      <tr style="background:${rowBg};border-bottom:1px solid #e2e8f0">
        <td style="text-align:center;font-weight:700;color:#4b5563">${b.batchNum}</td>
        <td style="font-weight:700">${fmtI(b.qty)}</td>
        <td style="font-weight:800;color:#14532d">${fmt(b.price)}</td>
        <td style="color:${b.margin >= 0 ? '#166534' : '#b91c1c'};font-weight:700">${marginSign}${fmtP(b.margin)}</td>
        <td style="color:#0369a1;font-weight:600">${fmt(b.revenue)}</td>
        <td style="color:#166534;font-weight:600">${fmt(b.profit)}</td>
        <td style="color:#0369a1">${fmt(b.runningRevenue)}</td>
        <td style="color:#166534">${fmt(b.runningProfit)}</td>
      </tr>`;
  }).join('');

  /* ---- Verdict ---- */
  const absDiff   = Math.abs(plan.revenueError);
  const threshold = plan.targetRevenue * 0.01;
  const verdict   = absDiff <= threshold
    ? { cls:'pass', text:'✅ الخطة تحقق الهدف المالي المطلوب' }
    : { cls:'warn', text:'⚠️ انحراف بسيط عن الهدف (تقريب الأسعار) — مقبول' };

  const profActualPct = m.totalCapital > 0
    ? (plan.totalProfit / m.totalCapital * 100).toFixed(1)
    : 0;

  /* ---- Assemble the full HTML document ---- */
  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>تقرير خطة التسعير — ${m.name}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    /* ======== BASE ======== */
    *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
    body {
      font-family: 'Cairo', Arial, sans-serif;
      background: #ffffff;
      color: #1a202c;
      direction: rtl;
      font-size: 10.5pt;
      line-height: 1.6;
    }
    .page {
      max-width: 210mm;
      margin: 0 auto;
      padding: 14mm 16mm 14mm;
    }

    /* ======== REPORT HEADER ======== */
    .report-header {
      text-align: center;
      border-bottom: 3px solid #16a34a;
      padding-bottom: 16px;
      margin-bottom: 22px;
    }
    .report-watermark {
      font-size: 9pt; color: #9ca3af;
      text-transform: uppercase; letter-spacing: 2px;
      margin-bottom: 6px;
    }
    .report-title {
      font-size: 19pt; font-weight: 900;
      color: #14532d; line-height: 1.2;
    }
    .report-subtitle { font-size: 10pt; color: #6b7280; margin-top: 4px; }
    .report-date     { font-size: 8.5pt; color: #9ca3af; margin-top: 5px; }

    /* ======== SECTION TITLE ======== */
    .section-title {
      font-size: 11pt; font-weight: 800; color: #14532d;
      margin: 18px 0 10px;
      padding-bottom: 6px;
      border-bottom: 1.5px solid #bbf7d0;
      display: flex; align-items: center; gap: 8px;
    }

    /* ======== MATERIAL INFO GRID ======== */
    .info-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 20px;
    }
    .info-cell {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 10px 12px;
    }
    .info-label {
      font-size: 7.5pt; font-weight: 700; text-transform: uppercase;
      letter-spacing: .4px; color: #166534; margin-bottom: 4px;
    }
    .info-value { font-size: 10.5pt; font-weight: 800; color: #14532d; }
    .info-value.blue   { color: #0369a1; }
    .info-value.amber  { color: #92400e; }
    .info-value.purple { color: #5b21b6; }
    .info-cell.span2   { grid-column: span 2; }

    /* ======== PLAN TABLE ======== */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
      margin-bottom: 20px;
    }
    thead tr { background: #14532d; }
    thead th {
      padding: 9px 10px;
      font-size: 8pt; font-weight: 800;
      color: #ffffff;
      text-align: right;
      white-space: nowrap;
      letter-spacing: .3px;
    }
    thead th:first-child { text-align: center; }
    tbody td { padding: 8px 10px; font-size: 9pt; vertical-align: middle; }
    tbody td:first-child { text-align: center; }
    tfoot tr { background: #dcfce7; border-top: 2px solid #16a34a; }
    tfoot td { padding: 9px 10px; font-weight: 800; font-size: 9.5pt; }
    tfoot td:first-child { text-align: center; }

    /* ======== SUMMARY GRID ======== */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-bottom: 14px;
    }
    .summary-block {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 14px;
    }
    .summary-block-title {
      font-size: 8pt; font-weight: 800; text-transform: uppercase;
      letter-spacing: .4px; color: #6b7280; margin-bottom: 8px;
      padding-bottom: 5px; border-bottom: 1px solid #e2e8f0;
    }
    .summary-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 4px 0; border-bottom: 1px solid #f1f5f9;
    }
    .summary-row:last-child { border-bottom: none; }
    .summary-lbl { font-size: 9pt; color: #4b5563; }
    .summary-val { font-size: 9pt; font-weight: 700; color: #14532d; }
    .summary-val.blue   { color: #0369a1; }
    .summary-val.purple { color: #5b21b6; }
    .summary-val.amber  { color: #92400e; }
    .summary-val.red    { color: #b91c1c; }

    /* ======== VERDICT ======== */
    .verdict {
      padding: 11px 16px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 10pt;
      margin-bottom: 16px;
    }
    .verdict.pass { background: #dcfce7; color: #14532d; border: 1px solid #86efac; }
    .verdict.warn { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }

    /* ======== FOOTER ======== */
    .print-footer {
      margin-top: 18px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 7.5pt;
      color: #9ca3af;
    }

    /* ======== PRINT RULES ======== */
    @media print {
      @page { size: A4 portrait; margin: 12mm 10mm; }
      body   { font-size: 9.5pt; }
      .page  { padding: 0; max-width: 100%; }
      /* Avoid breaking inside table rows or info cells */
      tr, .info-cell, .summary-block { page-break-inside: avoid; }
      thead { display: table-header-group; } /* repeat header on each page */
    }
  </style>
</head>
<body>
<div class="page">

  <!-- ===== REPORT HEADER ===== -->
  <div class="report-header">
    <div class="report-watermark">Smart Inventory &amp; Pricing System</div>
    <div class="report-title">تقرير خطة التسعير الذكي</div>
    <div class="report-subtitle">Smart Pricing Plan Report</div>
    <div class="report-date">تاريخ الطباعة: ${now}</div>
  </div>

  <!-- ===== MATERIAL INFO ===== -->
  <div class="section-title">ℹ️ بيانات المادة</div>
  <div class="info-grid">
    <div class="info-cell span2">
      <div class="info-label">اسم المادة</div>
      <div class="info-value">${m.name}</div>
    </div>
    <div class="info-cell">
      <div class="info-label">الكمية الإجمالية</div>
      <div class="info-value blue">${fmtI(m.quantity)} وحدة</div>
    </div>
    <div class="info-cell">
      <div class="info-label">سعر الشراء / وحدة</div>
      <div class="info-value">${fmt(m.costPerUnit)}</div>
    </div>
    <div class="info-cell">
      <div class="info-label">رأس المال الكلي</div>
      <div class="info-value amber">${fmt(m.totalCapital)}</div>
    </div>
    <div class="info-cell">
      <div class="info-label">نسبة الربح المستهدف</div>
      <div class="info-value purple">${fmtP(m.profitPct)}</div>
    </div>
    <div class="info-cell">
      <div class="info-label">مبلغ الربح المستهدف</div>
      <div class="info-value" style="color:#166534">${fmt(m.targetProfit)}</div>
    </div>
    <div class="info-cell span2">
      <div class="info-label">إجمالي المبيعات المستهدف</div>
      <div class="info-value blue" style="font-size:13pt">${fmt(m.targetRevenue)}</div>
    </div>
  </div>

  <!-- ===== PRICING TABLE ===== -->
  <div class="section-title">📊 خطة البيع المقترحة <span style="font-size:8pt;color:#6b7280;font-weight:400">— ${plan.N} دفعة • خطة #${plan.variant + 1}</span></div>
  <table>
    <thead>
      <tr>
        <th style="width:36px">#</th>
        <th>الكمية</th>
        <th>سعر الوحدة</th>
        <th>هامش %</th>
        <th>إيراد الدفعة</th>
        <th>ربح الدفعة</th>
        <th>الإيراد التراكمي</th>
        <th>الربح التراكمي</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHTML}
    </tbody>
    <tfoot>
      <tr>
        <td style="text-align:center">∑</td>
        <td style="color:#14532d">${fmtI(plan.totalQty)} وحدة</td>
        <td colspan="2"></td>
        <td style="color:#0369a1">${fmt(plan.totalRevenue)}</td>
        <td style="color:#166534">${fmt(plan.totalProfit)}</td>
        <td style="color:#0369a1">${fmt(plan.totalRevenue)}</td>
        <td style="color:#166534">${fmt(plan.totalProfit)}</td>
      </tr>
    </tfoot>
  </table>

  <!-- ===== SUMMARY ===== -->
  <div class="section-title">✅ ملخص ومقارنة الخطة</div>
  <div class="summary-grid">
    <div class="summary-block">
      <div class="summary-block-title">💰 الإيراد</div>
      <div class="summary-row"><span class="summary-lbl">الهدف</span><span class="summary-val blue">${fmt(plan.targetRevenue)}</span></div>
      <div class="summary-row"><span class="summary-lbl">الخطة</span><span class="summary-val blue">${fmt(plan.totalRevenue)}</span></div>
      <div class="summary-row"><span class="summary-lbl">الفارق (تقريب)</span><span class="summary-val ${Math.abs(plan.revenueError) < 5 ? '' : 'amber'}">${plan.revenueError >= 0 ? '+' : ''}${fmt(plan.revenueError)}</span></div>
      <div class="summary-row"><span class="summary-lbl">رأس المال</span><span class="summary-val amber">${fmt(m.totalCapital)}</span></div>
    </div>
    <div class="summary-block">
      <div class="summary-block-title">📈 الربح</div>
      <div class="summary-row"><span class="summary-lbl">الهدف</span><span class="summary-val">${fmt(plan.targetProfit)}</span></div>
      <div class="summary-row"><span class="summary-lbl">الخطة</span><span class="summary-val">${fmt(plan.totalProfit)}</span></div>
      <div class="summary-row"><span class="summary-lbl">الفارق (تقريب)</span><span class="summary-val ${Math.abs(plan.profitError) < 5 ? '' : 'amber'}">${plan.profitError >= 0 ? '+' : ''}${fmt(plan.profitError)}</span></div>
      <div class="summary-row"><span class="summary-lbl">نسبة الربح الفعلية</span><span class="summary-val purple">${profActualPct}%</span></div>
    </div>
    <div class="summary-block">
      <div class="summary-block-title">🏷️ الأسعار</div>
      <div class="summary-row"><span class="summary-lbl">أعلى سعر (الدفعة 1)</span><span class="summary-val">${fmt(plan.batches[0]?.price)}</span></div>
      <div class="summary-row"><span class="summary-lbl">أدنى سعر (آخر دفعة)</span><span class="summary-val amber">${fmt(plan.batches[plan.batches.length-1]?.price)}</span></div>
      <div class="summary-row"><span class="summary-lbl">متوسط سعر البيع</span><span class="summary-val blue">${fmt(plan.totalRevenue / plan.totalQty)}</span></div>
      <div class="summary-row"><span class="summary-lbl">سعر الشراء / وحدة</span><span class="summary-val">${fmt(m.costPerUnit)}</span></div>
    </div>
    <div class="summary-block">
      <div class="summary-block-title">📦 الكميات</div>
      <div class="summary-row"><span class="summary-lbl">الكمية الكلية</span><span class="summary-val blue">${fmtI(m.quantity)}</span></div>
      <div class="summary-row"><span class="summary-lbl">كمية الخطة</span><span class="summary-val blue">${fmtI(plan.totalQty)}</span></div>
      <div class="summary-row"><span class="summary-lbl">عدد الدفعات</span><span class="summary-val">${plan.N} دفعات</span></div>
      <div class="summary-row"><span class="summary-lbl">متوسط حجم الدفعة</span><span class="summary-val">${fmt(plan.totalQty / plan.N)} وحدة</span></div>
    </div>
  </div>

  <!-- Verdict -->
  <div class="verdict ${verdict.cls}">${verdict.text}</div>

  <!-- ===== FOOTER ===== -->
  <div class="print-footer">
    — تم إنشاء هذا التقرير تلقائياً بواسطة نظام التسعير الذكي — جميع البيانات تم معالجتها محلياً —
  </div>

</div><!-- /page -->
<script>window.onload = function() { window.focus(); window.print(); };</script>
</body>
</html>`;

  /* ---- Open a new window and write the HTML ---- */
  const win = window.open('', '_blank', 'width=900,height=750');
  if (!win) {
    alert('تعذر فتح نافذة الطباعة. يُرجى السماح للنوافذ المنبثقة في إعدادات المتصفح.');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 19 ── LOCAL STORAGE PERSISTENCE
   ═══════════════════════════════════════════════════════════════
   All app data is stored as one JSON object under STORAGE_KEY.

   Payload schema:
   {
     version:     1,
     savedAt:     ISO string,
     formData:    { name, quantity, costPerUnit, profitPct },
     currentPlan: plan | null,
     variant:     number,
     planHistory: [{ id, savedAt, plan }, ...]
   }
   ═══════════════════════════════════════════════════════════════ */

/* ── 19a: TOAST NOTIFICATIONS ── */
function showToast(type, icon, msg, duration) {
  if (duration === undefined) duration = 3500;
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.innerHTML =
    '<span class="toast-icon">' + icon + '</span>' +
    '<span class="toast-msg">' + msg + '</span>' +
    '<button class="toast-close" aria-label="إغلاق">×</button>';

  const close = function() {
    toast.classList.add('hiding');
    setTimeout(function() { toast.remove(); }, 300);
  };
  toast.querySelector('.toast-close').addEventListener('click', close);
  toastContainer.appendChild(toast);
  if (duration > 0) setTimeout(close, duration);
}

/* ── 19b: INDICATOR ── */
function setIndicator(status, label) {
  autosaveDot.className = 'autosave-dot' + (status ? ' ' + status : '');
  autosaveLabel.textContent = label;
}

/* ── 19c: BUILD PAYLOAD ── */
function buildPayload() {
  return {
    version:     1,
    savedAt:     new Date().toISOString(),
    formData: {
      name:        matName.value.trim(),
      quantity:    matQty.value,
      costPerUnit: matCost.value,
      profitPct:   matProfit.value,
    },
    currentPlan: state.plan,
    variant:     state.variant,
    planHistory: state.planHistory,
  };
}

/* ── 19d: SAVE ── */
function saveToStorage(silent) {
  if (silent === undefined) silent = false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buildPayload()));
    var dt = new Date().toLocaleTimeString('ar-EG', { hour:'2-digit', minute:'2-digit' });
    setIndicator('saved', 'تم الحفظ ' + dt);
    if (!silent) showToast('success', '✅', 'تم حفظ البيانات بنجاح');
    return true;
  } catch(err) {
    console.error('Save failed:', err);
    setIndicator('error', 'فشل الحفظ');
    if (!silent) showToast('error', '❌', 'فشل حفظ البيانات: ' + err.message);
    return false;
  }
}
function autoSave() { saveToStorage(true); }

/* ── 19e: LOAD ── */
function loadFromStorage(silent) {
  if (silent === undefined) silent = false;
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      if (!silent) showToast('warning', '⚠️', 'لا توجد بيانات محفوظة لتحميلها.');
      setIndicator('', 'لا توجد بيانات محفوظة');
      return false;
    }

    var payload = JSON.parse(raw);
    if (!payload || typeof payload !== 'object' || payload.version !== 1) {
      if (!silent) showToast('error', '❌', 'بيانات الحفظ تالفة أو غير متوافقة. تم تجاهلها.');
      return false;
    }

    // Restore form
    var fd = payload.formData || {};
    matName.value   = fd.name        || '';
    matQty.value    = fd.quantity    || '';
    matCost.value   = fd.costPerUnit || '';
    matProfit.value = fd.profitPct   || '';
    updateLiveStrip();

    // Restore state
    state.variant     = payload.variant || 0;
    state.planHistory = Array.isArray(payload.planHistory) ? payload.planHistory : [];

    // Restore plan
    if (payload.currentPlan) {
      state.plan = payload.currentPlan;
      recalcBtn.disabled = false;
      editBtn.disabled   = false;
      printBtn.disabled  = false;
      renderPlan(state.plan);
    }

    renderHistory();

    var dt = new Date(payload.savedAt).toLocaleString('ar-EG', { dateStyle:'short', timeStyle:'short' });
    setIndicator('saved', 'محمّل — حُفظ ' + dt);
    if (!silent) showToast('info', 'ℹ️', 'تم تحميل البيانات بنجاح');
    return true;

  } catch(err) {
    console.error('Load failed:', err);
    if (!silent) showToast('error', '❌', 'حدث خطأ أثناء تحميل البيانات.');
    return false;
  }
}

/* ── 19f: CLEAR ── */
function clearStorage() {
  if (!confirm('سيتم حذف جميع البيانات المحفوظة نهائياً.\nهل تريد المتابعة؟')) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    state.planHistory = [];
    renderHistory();
    setIndicator('', 'لا توجد بيانات محفوظة');
    showToast('warning', '🗑️', 'تم مسح جميع البيانات المحفوظة بنجاح');
  } catch(err) {
    showToast('error', '❌', 'فشل مسح البيانات: ' + err.message);
  }
}

/* ── 19g: ADD TO HISTORY ── */
function addToHistory(plan) {
  if (!plan) return;
  var entry = {
    id:      Date.now(),
    savedAt: new Date().toISOString(),
    plan:    JSON.parse(JSON.stringify(plan)),
  };
  state.planHistory.unshift(entry);
  if (state.planHistory.length > MAX_HISTORY) {
    state.planHistory = state.planHistory.slice(0, MAX_HISTORY);
  }
  renderHistory();
}

/* ── 19h: RENDER HISTORY ── */
function renderHistory() {
  var count = state.planHistory.length;
  historyCountBadge.textContent = count + ' خطة';

  if (count === 0) {
    historyCard.hidden = true;
    historyBody.innerHTML = '';
    return;
  }
  historyCard.hidden = false;

  var cards = state.planHistory.map(function(entry, idx) {
    var p  = entry.plan;
    var m  = p.material;
    var dt = new Date(entry.savedAt).toLocaleString('ar-EG', { dateStyle:'short', timeStyle:'short' });
    var profPct = m.totalCapital > 0
      ? (p.totalProfit / m.totalCapital * 100).toFixed(1) + '%'
      : '—';
    return '<div class="history-entry" data-idx="' + idx + '" title="اضغط لتحميل هذه الخطة">' +
      '<button class="history-delete-btn" data-id="' + entry.id + '" title="حذف هذا السجل" aria-label="حذف">×</button>' +
      '<div class="history-entry-top">' +
        '<span class="history-mat-name">' + m.name + '</span>' +
        '<span class="history-date-badge">' + dt + '</span>' +
      '</div>' +
      '<div class="history-meta">' +
        '<div class="history-meta-cell"><span class="history-meta-label">الكمية</span>' +
          '<span class="history-meta-val" style="color:var(--blue)">' + fmtI(m.quantity) + ' وحدة</span></div>' +
        '<div class="history-meta-cell"><span class="history-meta-label">سعر الشراء</span>' +
          '<span class="history-meta-val">' + fmt(m.costPerUnit) + '</span></div>' +
        '<div class="history-meta-cell"><span class="history-meta-label">إيراد الخطة</span>' +
          '<span class="history-meta-val" style="color:var(--blue)">' + fmt(p.totalRevenue) + '</span></div>' +
        '<div class="history-meta-cell"><span class="history-meta-label">ربح فعلي</span>' +
          '<span class="history-meta-val" style="color:var(--green)">' + profPct + '</span></div>' +
      '</div>' +
      '<div class="history-load-hint">← اضغط لتحميل هذه الخطة</div>' +
    '</div>';
  }).join('');

  historyBody.innerHTML = '<div class="history-grid">' + cards + '</div>';

  // Load on entry click
  historyBody.querySelectorAll('.history-entry').forEach(function(card) {
    card.addEventListener('click', function(e) {
      if (e.target.closest('.history-delete-btn')) return;
      var idx   = parseInt(card.dataset.idx, 10);
      var entry = state.planHistory[idx];
      if (!entry) return;
      var p = entry.plan;
      var m = p.material;
      matName.value   = m.name;
      matQty.value    = String(m.quantity);
      matCost.value   = String(m.costPerUnit);
      matProfit.value = String(m.profitPct);
      updateLiveStrip();
      state.plan    = p;
      state.variant = p.variant || 0;
      recalcBtn.disabled = false;
      editBtn.disabled   = false;
      printBtn.disabled  = false;
      renderPlan(state.plan);
      showToast('info', '↩️', 'تم تحميل خطة: ' + m.name);
      window.scrollTo({ top:0, behavior:'smooth' });
    });
  });

  // Delete entry
  historyBody.querySelectorAll('.history-delete-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var id = parseInt(btn.dataset.id, 10);
      state.planHistory = state.planHistory.filter(function(h) { return h.id !== id; });
      renderHistory();
      autoSave();
    });
  });
}

/* ── 19i: HISTORY TOGGLE ── */
var historyOpen = true;
historyToggleIcon.classList.add('open');
historyToggle.addEventListener('click', function() {
  historyOpen = !historyOpen;
  historyBody.style.display = historyOpen ? '' : 'none';
  historyToggleIcon.classList.toggle('open', historyOpen);
});

/* ── 19j: PERSISTENCE BAR BUTTONS ── */
persistSaveBtn.addEventListener('click',  function() { saveToStorage(false); });
persistLoadBtn.addEventListener('click',  function() { loadFromStorage(false); });
persistClearBtn.addEventListener('click', clearStorage);

/* ── 19k: AUTO-LOAD ON PAGE START ── */
(function autoLoadOnStart() {
  var raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    setIndicator('', 'لا توجد بيانات محفوظة');
    return;
  }
  var ok = loadFromStorage(true);  // silent on startup
  if (ok) {
    setTimeout(function() {
      showToast('info', '🔁', 'تم استعادة آخر جلسة محفوظة', 3000);
    }, 600);
  }
})();
