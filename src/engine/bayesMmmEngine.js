/**
 * Bayesian MMM Engine v3.0
 * Google Meridian(국가 단위 모델) 방식을 브라우저 JavaScript로 구현한 엔진
 *
 * 처리 흐름
 *  1. 일 단위 업로드 데이터 → 주 단위(월요일 시작) 자동 변환
 *     - 같은 날짜 행은 합산, 앞뒤 7일이 안 되는 불완전한 주는 제외
 *     - 중간에 빠진 날이 있는 주는 7일 기준으로 환산
 *     - 이미 주 단위로 올린 데이터(날짜 간격 6일 이상)는 그대로 사용
 *  2. Meridian 방식 스케일링
 *     - KPI: 평균 0, 표준편차 1
 *     - 광고비: 매체별 '0이 아닌 주간 광고비의 중앙값'으로 나눔 (ec=1 이 중앙값 수준의 반포화점)
 *  3. 모델: KPI_t = 기저(knot 선형보간) + 프로모션 + Σ_m β_m · Hill(Adstock(광고비_m))
 *     - Adstock: geometric, max_lag 8주, 가중치 합 1로 정규화 (Meridian 기본값)
 *     - Hill: slope 1 고정, ec(반포화점) 추정 (Meridian 기본값)
 *     - β는 ROI로부터 역산 (Meridian media_prior_type='roi')
 *  4. 사전분포 (Meridian 기본값)
 *     - ROI ~ LogNormal(0.2, 0.9) / 매체 카테고리 지정 시 카테고리별 값
 *     - 매출이 아닌 KPI: '광고 총 기여 40% ± 20%' 공통 ROI 사전분포 (Meridian 기본 동작)
 *     - 감쇠율 ~ Uniform(0,1), ec ~ TruncatedNormal(0.8, 0.8, 0.1, 10)
 *     - knot·프로모션 계수 ~ Normal(0,5), σ ~ HalfNormal(5)
 *  5. 추정: MCMC 4체인. 선형 계수(knot·프로모션)는 해석적으로 적분(collapsed)하고
 *     매체별 (ROI, 감쇠율, ec) 블록을 적응형 Metropolis로 샘플링
 *  6. 사후분포에서 ROI·mROI·기여도·반응곡선·95% 신뢰구간을 계산하고 R-hat으로 수렴 진단
 *
 * Meridian과 다른 점: NUTS 대신 적응형 Metropolis-within-Gibbs 사용,
 * 지역(geo) 계층 모델·Reach&Frequency·organic media 미지원.
 * 같은 데이터를 넣으면 항상 같은 결과가 나오도록 난수 시드를 고정합니다.
 */

// ============================================================
// SECTION 0: 모델 설정 & 매체 카테고리별 ROI 사전분포
// ============================================================

export const MODEL_SETTINGS = {
  maxLag: 8,              // Adstock 최대 이월 기간 (주)
  hillSlope: 1,           // Meridian 기본: slope 1 고정
  chains: 4,
  warmup: 2000,
  samplesPerChain: 1000,
  thin: 3,
  derivedDraws: 500,      // ROI·기여도·반응곡선 계산에 쓰는 사후 표본 수
  seed: 20240501,
  linearPriorVar: 25,     // knot·통제변수 계수 Normal(0,5) → 분산 25
  sigmaPriorScale: 5,     // σ ~ HalfNormal(5)
  ecPrior: { loc: 0.8, scale: 0.8, low: 0.1, high: 10 },
  minWeeks: 8,
  recommendedWeeks: 52
};

const MERIDIAN_DEFAULT_ROI = { mu: 0.2, sigma: 0.9 }; // LogNormal(0.2, 0.9): 중앙값 1.22, 평균 1.83

/**
 * 매체 카테고리별 ROI 사전분포 (LogNormal의 중앙값 roiMedian, 로그 표준편차 roiSigma)
 * - roiSigma가 작을수록 사전 정보를 강하게 믿고, 클수록 데이터에 맡깁니다.
 * - mix 항목은 브랜드 키워드/리타겟팅 비중 슬라이더 100%일 때의 값 (비중만큼 로그 스케일로 보간)
 */
export const MEDIA_CATEGORIES = {
  'brand_search': {
    label: '브랜드 검색 캠페인',
    roiMedian: 0.8, roiSigma: 0.6,
    description: '자사명/브랜드명 키워드 검색 광고 (원래 살 사람이 많이 클릭해 증분 효과가 낮은 편)'
  },
  'keyword_search': {
    label: '키워드 및 쇼핑 검색 캠페인',
    roiMedian: 1.5, roiSigma: 0.7,
    mixRoiMedian: 0.6, mixRoiSigma: 0.6,
    description: '일반/쇼핑 검색 (브랜드 키워드 비중 슬라이더 지원)'
  },
  'display_conversion': {
    label: '디스플레이 - 전환',
    roiMedian: 1.2, roiSigma: 0.8,
    mixRoiMedian: 0.5, mixRoiSigma: 0.7,
    description: '메타/구글/틱톡 등 전환 목적 캠페인 (리타겟팅 비중 슬라이더 지원)'
  },
  'display_traffic': {
    label: '디스플레이 - 트래픽/유입',
    roiMedian: 1.0, roiSigma: 0.9,
    description: '신규 유입/인지 목적 디스플레이 배너'
  },
  'video_content': {
    label: '동영상 / 콘텐츠',
    roiMedian: 1.0, roiSigma: 1.0,
    description: '유튜브, 틱톡 브랜딩, 인플루언서, 브랜디드 콘텐츠 (효과가 늦게·넓게 나타나 사전분포를 약하게 둠)'
  },
  'offline_ooh': {
    label: '오프라인 / 옥외 (OOH, TV 등)',
    roiMedian: 1.0, roiSigma: 1.1,
    description: '옥외광고, TV, 라디오 등 오프라인 매체 (거의 데이터에 맡김)'
  },
  'none': {
    label: '설정 안함 (Meridian 기본값)',
    roiMedian: Math.exp(MERIDIAN_DEFAULT_ROI.mu), roiSigma: MERIDIAN_DEFAULT_ROI.sigma,
    description: 'Meridian 기본 ROI 사전분포 LogNormal(0.2, 0.9)'
  }
};

/**
 * 카테고리와 혼합 비중으로 ROI 사전분포(LogNormal)를 계산합니다. (매출 KPI 기준)
 * @returns {{ mu:number, sigma:number, roiMedian:number, roiSigma:number, targetRoas:number }}
 */
export function computePrior(category = 'none', mixRatio = 0) {
  const config = MEDIA_CATEGORIES[category] || MEDIA_CATEGORIES['none'];
  let logMedian = Math.log(config.roiMedian);
  let sigma = config.roiSigma;
  const w = Math.max(0, Math.min(1, Number(mixRatio) || 0));
  if (config.mixRoiMedian !== undefined && w > 0) {
    logMedian = (1 - w) * logMedian + w * Math.log(config.mixRoiMedian);
    sigma = (1 - w) * sigma + w * config.mixRoiSigma;
  }
  const roiMedian = Math.exp(logMedian);
  return { mu: logMedian, sigma, roiMedian, roiSigma: sigma, targetRoas: roiMedian };
}


// ============================================================
// SECTION 1: 난수 · 선형대수 · 통계 헬퍼
// ============================================================

function makeRng(seed) {
  let a = seed >>> 0;
  const uniform = () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let spare = null;
  const normal = () => {
    if (spare !== null) { const s = spare; spare = null; return s; }
    let x, y, r;
    do { x = 2 * uniform() - 1; y = 2 * uniform() - 1; r = x * x + y * y; } while (r === 0 || r >= 1);
    const f = Math.sqrt(-2 * Math.log(r) / r);
    spare = y * f;
    return x * f;
  };
  return { uniform, normal };
}

// n×n 대칭 양의정부호 행렬(row-major Float64Array)의 Cholesky 분해 (하삼각 L)
function cholesky(A, n) {
  const L = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = A[i * n + j];
      for (let k = 0; k < j; k++) sum -= L[i * n + k] * L[j * n + k];
      if (i === j) L[i * n + i] = Math.sqrt(Math.max(sum, 1e-12));
      else L[i * n + j] = sum / L[j * n + j];
    }
  }
  return L;
}

// L Lᵀ x = b
function cholSolve(L, n, b) {
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = b[i];
    for (let k = 0; k < i; k++) s -= L[i * n + k] * y[k];
    y[i] = s / L[i * n + i];
  }
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = y[i];
    for (let k = i + 1; k < n; k++) s -= L[k * n + i] * x[k];
    x[i] = s / L[i * n + i];
  }
  return x;
}

// Lᵀ x = z  (x ~ N(0, (L Lᵀ)⁻¹) 샘플링용)
function cholBackSolveT(L, n, z) {
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = z[i];
    for (let k = i + 1; k < n; k++) s -= L[k * n + i] * x[k];
    x[i] = s / L[i * n + i];
  }
  return x;
}

function cholLogDet(L, n) {
  let s = 0;
  for (let i = 0; i < n; i++) s += Math.log(L[i * n + i]);
  return 2 * s;
}

const sigmoid = (a) => 1 / (1 + Math.exp(-a));
const logit = (p) => Math.log(p / (1 - p));
const softplus = (x) => (x > 30 ? x : Math.log1p(Math.exp(x)));

function mean(arr) {
  if (!arr.length) return 0;
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  return s / arr.length;
}

function quantile(sortedArr, q) {
  const n = sortedArr.length;
  if (n === 0) return 0;
  const pos = (n - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sortedArr[lo] + (sortedArr[hi] - sortedArr[lo]) * (pos - lo);
}

function interval95(values) {
  const s = Float64Array.from(values).sort();
  return [quantile(s, 0.025), quantile(s, 0.975)];
}

function median(arr) {
  if (!arr.length) return 0;
  return quantile(Float64Array.from(arr).sort(), 0.5);
}

// Split R-hat (Gelman-Rubin). chains: number[][]
function splitRhat(chains) {
  const seqs = [];
  chains.forEach(c => {
    const h = Math.floor(c.length / 2);
    if (h >= 2) { seqs.push(c.slice(0, h)); seqs.push(c.slice(h, 2 * h)); }
  });
  if (seqs.length < 2) return NaN;
  const n = seqs[0].length;
  const means = seqs.map(mean);
  const vars = seqs.map((s, i) => s.reduce((acc, v) => acc + (v - means[i]) ** 2, 0) / (n - 1));
  const W = mean(vars);
  const grand = mean(means);
  const B = n * means.reduce((acc, m) => acc + (m - grand) ** 2, 0) / (means.length - 1);
  if (W <= 1e-300) return 1;
  const varPlus = ((n - 1) / n) * W + B / n;
  return Math.sqrt(varPlus / W);
}

// "1,500,000", "₩1,500,000", " 12 " 같은 문자열 숫자도 처리
function toNum(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[,₩\s원%]/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof v === 'boolean') return v ? 1 : 0;
  return 0;
}


// ============================================================
// SECTION 2: 날짜 처리 & 일 → 주 변환
// ============================================================

const DAY_MS = 86400000;
const pad2 = (n) => String(n).padStart(2, '0');

function ymdToDayNum(y, m, d) {
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

function dayNumToKey(dn) {
  const d = new Date(dn * DAY_MS);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function dayNumParts(dn) {
  const d = new Date(dn * DAY_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

// 0=일, 1=월, ..., 6=토 (1970-01-01은 목요일)
const weekdayOf = (dn) => (((dn + 4) % 7) + 7) % 7;
const mondayOf = (dn) => dn - ((weekdayOf(dn) + 6) % 7);

/** 엑셀 날짜 일련번호, Date 객체, 다양한 문자열(2024-05-01, 2024.5.1, 2024/05/01, 20240501)을 일련 일수로 변환 */
export function parseDayNum(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) {
    if (v >= 19000101 && v <= 21001231) {
      const s = String(Math.round(v));
      return ymdToDayNum(+s.slice(0, 4), +s.slice(4, 6), +s.slice(6, 8));
    }
    if (v > 1000 && v < 100000) return Math.round(v) - 25569; // 엑셀 일련번호 (25569 = 1970-01-01)
    return null;
  }
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    return ymdToDayNum(v.getFullYear(), v.getMonth() + 1, v.getDate());
  }
  if (typeof v === 'string') {
    const s = v.trim();
    let m = s.match(/^(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/);
    if (m) return ymdToDayNum(+m[1], +m[2], +m[3]);
    m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (m) return ymdToDayNum(+m[1], +m[2], +m[3]);
    const p = new Date(s);
    if (!isNaN(p.getTime())) return ymdToDayNum(p.getFullYear(), p.getMonth() + 1, p.getDate());
  }
  return null;
}

/**
 * 일 단위 행 데이터를 주 단위(월요일 시작)로 변환합니다.
 * @param {Array<Object>} rawData
 * @param {string} dateCol
 * @param {string[]} sumCols  합산할 컬럼 (KPI, 광고비, 노출수, 클릭수)
 * @param {string[]} flagCols 프로모션 컬럼 (같은 날 중복 행은 최댓값, 주간은 일수 합)
 */
export function aggregateToWeekly(rawData, dateCol, sumCols, flagCols = []) {
  const byDay = new Map();
  let invalidDateRows = 0;

  rawData.forEach(r => {
    const dn = parseDayNum(r[dateCol]);
    if (dn === null) { invalidDateRows++; return; }
    let rec = byDay.get(dn);
    if (!rec) {
      rec = { sums: {}, flags: {} };
      sumCols.forEach(c => { rec.sums[c] = 0; });
      flagCols.forEach(c => { rec.flags[c] = 0; });
      byDay.set(dn, rec);
    }
    sumCols.forEach(c => { rec.sums[c] += toNum(r[c]); });
    flagCols.forEach(c => { rec.flags[c] = Math.max(rec.flags[c], toNum(r[c])); });
  });

  const days = [...byDay.keys()].sort((a, b) => a - b);
  if (days.length === 0) {
    throw new Error('일자 컬럼에서 날짜를 읽지 못했습니다. 날짜 형식(예: 2024-05-01)을 확인해 주세요.');
  }

  const gaps = [];
  for (let i = 1; i < days.length; i++) gaps.push(days[i] - days[i - 1]);
  const medianGap = gaps.length ? median(gaps) : 1;
  const inputFrequency = medianGap >= 6 ? 'weekly' : 'daily';

  const allCols = [...sumCols, ...flagCols];
  const result = {
    inputFrequency,
    invalidDateRows,
    duplicateDateRows: rawData.length - invalidDateRows - days.length,
    totalInputDays: inputFrequency === 'daily' ? days.length : days.length * 7,
    droppedEdgeDays: 0,
    scaledWeeks: 0,
    filledWeeks: 0,
    periodStarts: [],
    values: {},
    byDay,
    days
  };
  allCols.forEach(c => { result.values[c] = []; });

  if (inputFrequency === 'weekly') {
    days.forEach(dn => {
      const rec = byDay.get(dn);
      result.periodStarts.push(dn);
      sumCols.forEach(c => result.values[c].push(rec.sums[c]));
      flagCols.forEach(c => result.values[c].push(rec.flags[c]));
    });
    return result;
  }

  // ---- 일 단위 → 주 단위 ----
  const firstWeek = mondayOf(days[0]);
  const lastWeek = mondayOf(days[days.length - 1]);
  const weeks = [];
  for (let ws = firstWeek; ws <= lastWeek; ws += 7) {
    const w = { start: ws, count: 0, vals: {} };
    allCols.forEach(c => { w.vals[c] = 0; });
    weeks.push(w);
  }
  days.forEach(dn => {
    const w = weeks[(mondayOf(dn) - firstWeek) / 7];
    const rec = byDay.get(dn);
    w.count++;
    sumCols.forEach(c => { w.vals[c] += rec.sums[c]; });
    flagCols.forEach(c => { w.vals[c] += rec.flags[c]; });
  });

  // 앞뒤 불완전한 주 제외
  while (weeks.length && weeks[0].count < 7) { result.droppedEdgeDays += weeks[0].count; weeks.shift(); }
  while (weeks.length && weeks[weeks.length - 1].count < 7) { result.droppedEdgeDays += weeks[weeks.length - 1].count; weeks.pop(); }

  // 중간에 빈 날이 있는 주: 7일 기준으로 환산 / 통째로 빈 주: 앞뒤 주 평균으로 채움
  weeks.forEach((w, i) => {
    if (w.count > 0 && w.count < 7) {
      const f = 7 / w.count;
      allCols.forEach(c => { w.vals[c] *= f; });
      result.scaledWeeks++;
    } else if (w.count === 0) {
      const prev = weeks[i - 1], next = weeks[i + 1];
      allCols.forEach(c => {
        const a = prev ? prev.vals[c] : 0, b = next && next.count > 0 ? next.vals[c] : a;
        w.vals[c] = (a + b) / 2;
      });
      result.filledWeeks++;
    }
  });

  weeks.forEach(w => {
    result.periodStarts.push(w.start);
    allCols.forEach(c => result.values[c].push(w.vals[c]));
  });
  return result;
}

/**
 * 일 데이터로 주말·월초·월말 패턴을 계산합니다 (모델 밖의 참고 지표, 광고 효과 포함 전체 KPI 기준).
 * - 주말: 각 날 KPI ÷ 앞뒤 3일 포함 7일 평균 → 요일별 평균 비율을 비교 (추세·계절·광고 수준 차이 제거)
 * - 월초·월말: 요일 효과를 나눈 값 ÷ 앞뒤 15일 포함 31일 평균 → 월 안에서의 위치별 비율을 비교
 */
function computeDailyPatterns(byDay, kpiCol, rangeStart, rangeEnd) {
  const yAt = (dn) => { const rec = byDay.get(dn); return rec ? rec.sums[kpiCol] : null; };
  const centeredMean = (dn, half, f = (v) => v) => {
    let s = 0;
    for (let k = -half; k <= half; k++) {
      const v = yAt(dn + k);
      if (v === null) return null;
      s += f(v, dn + k);
    }
    return s / (2 * half + 1);
  };

  // 1) 요일 지수
  const wdRatios = [[], [], [], [], [], [], []];
  for (let dn = rangeStart; dn <= rangeEnd; dn++) {
    const v = yAt(dn), ma = centeredMean(dn, 3);
    if (v === null || !ma || ma <= 0) continue;
    wdRatios[weekdayOf(dn)].push(v / ma);
  }
  if (wdRatios.some(a => a.length < 4)) return null;
  const wdIdx = wdRatios.map(a => mean(a));
  const wdNorm = mean(wdIdx);
  const wdFactor = wdIdx.map(v => v / wdNorm);
  const weekend = (wdFactor[0] + wdFactor[6]) / 2;
  const weekday = (wdFactor[1] + wdFactor[2] + wdFactor[3] + wdFactor[4] + wdFactor[5]) / 5;

  // 2) 월 안의 위치 지수 (요일 효과 제거 후)
  const adj = (v, dn) => v / wdFactor[weekdayOf(dn)];
  const pos = [];
  for (let dn = rangeStart; dn <= rangeEnd; dn++) {
    const v = yAt(dn), ma = centeredMean(dn, 15, adj);
    if (v === null || !ma || ma <= 0) continue;
    const { year, month, day } = dayNumParts(dn);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    pos.push({ r: adj(v, dn) / ma, day, lastDay });
  }
  const avg = (f) => { const a = pos.filter(f); return a.length ? mean(a.map(x => x.r)) : null; };
  const early = avg(x => x.day <= 5);
  const late = avg(x => x.day > x.lastDay - 5);
  const mid = avg(x => x.day > 5 && x.day <= x.lastDay - 5);
  const pct = (a, b) => (a !== null && b) ? (a / b - 1) * 100 : 0;
  return {
    weekendEffectRatio: (weekend / weekday - 1) * 100,
    earlyMonthEffectRatio: pct(early, mid),
    lateMonthEffectRatio: pct(late, mid),
    dayOfWeekIndex: wdFactor.map(v => (v - 1) * 100) // 0=일 ~ 6=토, 평균 대비 %
  };
}


// ============================================================
// SECTION 3: 매체 변환 (Adstock → Hill)
// ============================================================

/** Geometric Adstock (Meridian): 가중치 α^s (s=0..L), 합이 1이 되도록 정규화 */
export function geometricAdstockWeights(alpha, maxLag) {
  const w = new Float64Array(maxLag + 1);
  let norm = 0;
  for (let s = 0; s <= maxLag; s++) { w[s] = Math.pow(alpha, s); norm += w[s]; }
  for (let s = 0; s <= maxLag; s++) w[s] /= norm;
  return w;
}

function adstock(x, weights) {
  const T = x.length, L = weights.length - 1;
  const A = new Float64Array(T);
  for (let t = 0; t < T; t++) {
    let acc = 0;
    const smax = t < L ? t : L;
    for (let s = 0; s <= smax; s++) acc += weights[s] * x[t - s];
    A[t] = acc;
  }
  return A;
}

/** Hill (slope=1): h = A / (A + ec) 와 그 합계 */
function hillSum(A, ec, mult = 1) {
  let H = 0;
  for (let t = 0; t < A.length; t++) {
    const v = A[t] * mult;
    H += v / (v + ec);
  }
  return H;
}


// ============================================================
// SECTION 4: 베이지안 추정 (Collapsed adaptive Metropolis-within-Gibbs)
// ============================================================

function buildKnotBasis(T, nKnots) {
  const W = [];
  if (nKnots <= 1) {
    for (let t = 0; t < T; t++) W.push([1]);
    return { W, positions: [0] };
  }
  const positions = [];
  for (let k = 0; k < nKnots; k++) positions.push((k * (T - 1)) / (nKnots - 1));
  for (let t = 0; t < T; t++) {
    const row = new Array(nKnots).fill(0);
    let seg = 0;
    while (seg < nKnots - 2 && t > positions[seg + 1]) seg++;
    const left = positions[seg], right = positions[seg + 1];
    const w = (right - t) / (right - left);
    row[seg] = w;
    row[seg + 1] = 1 - w;
    W.push(row);
  }
  return { W, positions: positions.map(p => Math.round(p)) };
}

/**
 * MCMC 샘플러
 * ctx: { T, M, K, L, yStar, G(T×K row-major), GtG, Gty, xStar[], spendTotal[], sY, priors[] }
 */
function runSampler(ctx, settings, rng) {
  const { T, M, K, L, yStar, G, GtG, Gty, xStar, spendTotal, sY, priors } = ctx;
  const c = settings.linearPriorVar;
  const ecP = settings.ecPrior;
  const sigScale2 = settings.sigmaPriorScale ** 2;
  const totalIter = settings.warmup + settings.samplesPerChain * settings.thin;

  const logPriorChannel = (m, r, a, e) => {
    const ec = Math.exp(e);
    if (ec < ecP.low || ec > ecP.high) return -Infinity;
    const z = (r - priors[m].mu) / priors[m].sigma;
    const zec = (ec - ecP.loc) / ecP.scale;
    return -0.5 * z * z - softplus(-a) - softplus(a) - 0.5 * zec * zec + e;
  };
  const logPriorSigma = (s) => { const sig = Math.exp(s); return -(sig * sig) / (2 * sigScale2) + s; };

  const transform = (m, a, e) => {
    const alpha = sigmoid(a);
    const ec = Math.exp(e);
    const A = adstock(xStar[m], geometricAdstockWeights(alpha, L));
    const h = new Float64Array(T);
    let H = 0;
    for (let t = 0; t < T; t++) { h[t] = A[t] / (A[t] + ec); H += h[t]; }
    const g = new Float64Array(K);
    for (let t = 0; t < T; t++) {
      const ht = h[t], base = t * K;
      for (let k = 0; k < K; k++) g[k] += G[base + k] * ht;
    }
    return { h, H, g };
  };

  const setSigma = (st, s) => {
    st.s = s;
    st.sig2 = Math.exp(2 * s);
    const P = new Float64Array(K * K);
    for (let i = 0; i < K * K; i++) P[i] = GtG[i] / st.sig2;
    for (let i = 0; i < K; i++) P[i * K + i] += 1 / c;
    st.Pchol = cholesky(P, K);
    st.logdetP = cholLogDet(st.Pchol, K);
  };

  const quadForm = (st, Gtr) => {
    const q = new Float64Array(K);
    for (let k = 0; k < K; k++) q[k] = Gtr[k] / st.sig2;
    const x = cholSolve(st.Pchol, K, q);
    let s = 0;
    for (let k = 0; k < K; k++) s += q[k] * x[k];
    return s;
  };

  // 선형 계수를 적분한 로그우도의 데이터 의존 부분
  const dataTerm = (st, rr, Gtr) => -0.5 * (rr / st.sig2 - quadForm(st, Gtr));
  const sigmaTerm = (st) => -T * st.s - 0.5 * (K * Math.log(c) + st.logdetP);

  const chainsOut = [];
  const acceptStats = { channel: new Array(M).fill(0), sigma: 0, proposals: 0 };

  for (let ch = 0; ch < settings.chains; ch++) {
    // ---- 초기값 (체인마다 다르게 흩뿌려 수렴 진단이 가능하도록) ----
    const st = {
      r: new Float64Array(M), a: new Float64Array(M), e: new Float64Array(M),
      beta: new Float64Array(M), h: [], H: new Float64Array(M), g: [],
      media: new Float64Array(T), Gtr: new Float64Array(K), rr: 0
    };
    setSigma(st, Math.log(0.3 + 0.4 * rng.uniform()));
    for (let m = 0; m < M; m++) {
      st.r[m] = priors[m].mu + 0.5 * priors[m].sigma * rng.normal();
      st.a[m] = logit(0.15 + 0.6 * rng.uniform());
      st.e[m] = Math.log(0.4 + 1.2 * rng.uniform());
      const tr = transform(m, st.a[m], st.e[m]);
      st.h[m] = tr.h; st.H[m] = tr.H; st.g[m] = tr.g;
      st.beta[m] = Math.exp(st.r[m]) * spendTotal[m] / (sY * tr.H);
    }
    for (let t = 0; t < T; t++) {
      let v = 0;
      for (let m = 0; m < M; m++) v += st.beta[m] * st.h[m][t];
      st.media[t] = v;
    }
    for (let k = 0; k < K; k++) {
      let v = Gty[k];
      for (let m = 0; m < M; m++) v -= st.beta[m] * st.g[m][k];
      st.Gtr[k] = v;
    }
    st.rr = 0;
    for (let t = 0; t < T; t++) { const d = yStar[t] - st.media[t]; st.rr += d * d; }
    let curData = dataTerm(st, st.rr, st.Gtr);
    const curPrior = new Float64Array(M);
    for (let m = 0; m < M; m++) curPrior[m] = logPriorChannel(m, st.r[m], st.a[m], st.e[m]);

    // ---- 적응형 제안분포 ----
    const propL = [], logScale = new Float64Array(M);
    const hist = [];
    for (let m = 0; m < M; m++) {
      propL.push(Float64Array.from([0.25, 0, 0, 0, 0.5, 0, 0, 0, 0.4]));
      hist.push({ n: 0, mean: new Float64Array(3), M2: new Float64Array(9) });
    }
    let sigLogStep = Math.log(0.1);

    const draws = { r: [], a: [], e: [], s: [] };

    for (let it = 0; it < totalIter; it++) {
      const warm = it < settings.warmup;

      // 1) 매체별 (log ROI, logit 감쇠율, log ec) 블록 업데이트
      for (let m = 0; m < M; m++) {
        const z0 = rng.normal(), z1 = rng.normal(), z2 = rng.normal();
        const Lp = propL[m], sc = Math.exp(logScale[m]);
        const nr = st.r[m] + sc * (Lp[0] * z0);
        const na = st.a[m] + sc * (Lp[3] * z0 + Lp[4] * z1);
        const ne = st.e[m] + sc * (Lp[6] * z0 + Lp[7] * z1 + Lp[8] * z2);
        const lpNew = logPriorChannel(m, nr, na, ne);
        let accepted = false;
        if (lpNew > -Infinity) {
          const tr = transform(m, na, ne);
          const nBeta = Math.exp(nr) * spendTotal[m] / (sY * tr.H);
          const oBeta = st.beta[m], oh = st.h[m];
          const newMedia = new Float64Array(T);
          let rr = 0;
          for (let t = 0; t < T; t++) {
            const v = st.media[t] - oBeta * oh[t] + nBeta * tr.h[t];
            newMedia[t] = v;
            const d = yStar[t] - v;
            rr += d * d;
          }
          const newGtr = new Float64Array(K);
          for (let k = 0; k < K; k++) newGtr[k] = st.Gtr[k] + oBeta * st.g[m][k] - nBeta * tr.g[k];
          const newData = dataTerm(st, rr, newGtr);
          const logRatio = newData + lpNew - curData - curPrior[m];
          if (Math.log(rng.uniform()) < logRatio) {
            st.r[m] = nr; st.a[m] = na; st.e[m] = ne;
            st.beta[m] = nBeta; st.h[m] = tr.h; st.H[m] = tr.H; st.g[m] = tr.g;
            st.media = newMedia; st.rr = rr; st.Gtr = newGtr;
            curData = newData; curPrior[m] = lpNew;
            accepted = true;
          }
        }
        if (warm) {
          logScale[m] += ((accepted ? 1 : 0) - 0.3) * 0.08 / Math.sqrt(1 + it / 200);
          if (it >= settings.warmup * 0.15) {
            const hst = hist[m];
            const v = [st.r[m], st.a[m], st.e[m]];
            hst.n++;
            const delta = v.map((x, i) => x - hst.mean[i]);
            for (let i = 0; i < 3; i++) hst.mean[i] += delta[i] / hst.n;
            const delta2 = v.map((x, i) => x - hst.mean[i]);
            for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) hst.M2[i * 3 + j] += delta[i] * delta2[j];
            if (hst.n >= 100 && hst.n % 100 === 0) {
              const cov = new Float64Array(9);
              for (let i = 0; i < 9; i++) cov[i] = (hst.M2[i] / (hst.n - 1)) * (2.38 * 2.38 / 3);
              for (let i = 0; i < 3; i++) cov[i * 3 + i] += 1e-6;
              propL[m] = cholesky(cov, 3);
              logScale[m] = 0;
            }
          }
        } else {
          acceptStats.channel[m] += accepted ? 1 : 0;
        }
      }

      // 2) 잡음 σ 업데이트
      {
        const sNew = st.s + Math.exp(sigLogStep) * rng.normal();
        const old = { s: st.s, sig2: st.sig2, Pchol: st.Pchol, logdetP: st.logdetP };
        const curTotal = curData + sigmaTerm(st) + logPriorSigma(st.s);
        setSigma(st, sNew);
        const newData = dataTerm(st, st.rr, st.Gtr);
        const newTotal = newData + sigmaTerm(st) + logPriorSigma(sNew);
        const accepted = Math.log(rng.uniform()) < newTotal - curTotal;
        if (accepted) {
          curData = newData;
        } else {
          st.s = old.s; st.sig2 = old.sig2; st.Pchol = old.Pchol; st.logdetP = old.logdetP;
        }
        if (warm) sigLogStep += ((accepted ? 1 : 0) - 0.44) * 0.08 / Math.sqrt(1 + it / 200);
        else acceptStats.sigma += accepted ? 1 : 0;
      }

      if (!warm) {
        acceptStats.proposals++;
        if ((it - settings.warmup) % settings.thin === 0) {
          draws.r.push(Float64Array.from(st.r));
          draws.a.push(Float64Array.from(st.a));
          draws.e.push(Float64Array.from(st.e));
          draws.s.push(st.s);
        }
      }
    }
    chainsOut.push(draws);
  }

  // ---- 수렴 진단 (split R-hat) ----
  const rhat = { roi: [], decay: [], ec: [], sigma: 0 };
  for (let m = 0; m < M; m++) {
    rhat.roi.push(splitRhat(chainsOut.map(d => d.r.map(v => v[m]))));
    rhat.decay.push(splitRhat(chainsOut.map(d => d.a.map(v => v[m]))));
    rhat.ec.push(splitRhat(chainsOut.map(d => d.e.map(v => v[m]))));
  }
  rhat.sigma = splitRhat(chainsOut.map(d => d.s));
  const allR = [...rhat.roi, ...rhat.decay, ...rhat.ec, rhat.sigma].filter(Number.isFinite);
  rhat.max = allR.length ? Math.max(...allR) : NaN;

  const pooled = [];
  chainsOut.forEach(d => d.r.forEach((_, i) => pooled.push({ r: d.r[i], a: d.a[i], e: d.e[i], s: d.s[i] })));

  const nPost = acceptStats.proposals || 1;
  return {
    pooled,
    rhat,
    acceptance: {
      channel: acceptStats.channel.map(v => v / nPost),
      sigma: acceptStats.sigma / nPost
    }
  };
}


// ============================================================
// SECTION 5: 메인 분석 함수
// ============================================================

const KPI_TERMS = {
  'revenue': { name: '매출액', roas: 'ROAS', unit: '₩' },
  'purchase': { name: '구매수', roas: 'CPA(단위당 효율)', unit: '건' },
  'traffic': { name: '유입수', roas: '단위당 효율', unit: '회' },
  'install': { name: '앱설치수', roas: 'CPI(단위당 효율)', unit: '건' },
  'lead': { name: '잠재고객 획득', roas: 'CPA(단위당 효율)', unit: '명' }
};

const CURVE_STEP = 0.05;
const CURVE_MAX = 3.0;

/**
 * 베이지안 MMM 분석
 * @param {Array} rawData 업로드된 행 데이터 (일 단위 권장, 주 단위도 가능)
 * @param {string} dateCol
 * @param {string} kpiCol
 * @param {string[]} mediaCols 매체 광고비 컬럼
 * @param {Object} extraCols { promoCols: [], '<매체>_impressions': '<컬럼>', '<매체>_clicks': '<컬럼>' }
 * @param {string} kpiType 'revenue' | 'purchase' | 'traffic' | 'install' | 'lead'
 * @param {Object} mediaPriorConfig { '<매체>': { category, mixRatio } }
 * @param {Object} settingsOverride MODEL_SETTINGS 일부 덮어쓰기 (테스트용)
 */
export function runMMMAnalysis(rawData, dateCol, kpiCol, mediaCols, extraCols = {}, kpiType = 'revenue', mediaPriorConfig = {}, settingsOverride = {}) {
  if (!rawData || rawData.length === 0 || !mediaCols || mediaCols.length === 0) {
    throw new Error('데이터가 충분하지 않습니다.');
  }
  const settings = { ...MODEL_SETTINGS, ...settingsOverride };
  const kpiTerms = KPI_TERMS[kpiType] || KPI_TERMS['revenue'];
  const isCpaMode = kpiType !== 'revenue';
  const warnings = [];

  // ---- 1. 일 → 주 변환 ----
  const impCols = {}, clkCols = {};
  mediaCols.forEach(col => {
    const ic = extraCols[`${col}_impressions`] || extraCols[`${col}_imp`];
    const cc = extraCols[`${col}_clicks`] || extraCols[`${col}_clk`];
    if (ic) impCols[col] = ic;
    if (cc) clkCols[col] = cc;
  });
  const promoColsInput = (extraCols.promoCols || []).filter(Boolean);
  const sumCols = [...new Set([kpiCol, ...mediaCols, ...Object.values(impCols), ...Object.values(clkCols)])];
  const flagCols = promoColsInput.filter(c => !sumCols.includes(c));

  const agg = aggregateToWeekly(rawData, dateCol, sumCols, flagCols);
  const T = agg.periodStarts.length;
  if (T < settings.minWeeks) {
    throw new Error(`주 단위로 바꾸면 ${T}주뿐이라 분석할 수 없습니다. 최소 ${settings.minWeeks}주(권장 ${settings.recommendedWeeks}주 이상)의 일 데이터를 넣어주세요.`);
  }
  if (agg.invalidDateRows > 0) warnings.push(`날짜를 읽을 수 없는 ${agg.invalidDateRows}개 행은 제외했습니다.`);
  if (agg.inputFrequency === 'daily' && agg.droppedEdgeDays > 0) warnings.push(`첫 주·마지막 주가 7일이 안 돼서 ${agg.droppedEdgeDays}일은 분석에서 제외했습니다 (주 단위는 월~일 기준).`);
  if (agg.scaledWeeks > 0) warnings.push(`중간에 빠진 날이 있는 ${agg.scaledWeeks}개 주는 7일 기준으로 환산했습니다.`);
  if (agg.filledWeeks > 0) warnings.push(`데이터가 통째로 빠진 ${agg.filledWeeks}개 주는 앞뒤 주 평균으로 채웠습니다.`);
  if (T < settings.recommendedWeeks) warnings.push(`분석 기간이 ${T}주로 1년(52주) 미만입니다. 계절성과 광고 효과가 섞일 수 있어 신뢰구간이 넓게 나옵니다.`);

  const dates = agg.periodStarts.map(dayNumToKey);
  const y = Float64Array.from(agg.values[kpiCol]);

  // ---- 2. 매체 데이터 정리 (광고비 0인 매체 제외) ----
  const activeMedia = [];
  mediaCols.forEach(col => {
    const total = agg.values[col].reduce((a, b) => a + b, 0);
    if (total > 0) activeMedia.push(col);
    else warnings.push(`${col}: 분석 기간 광고비가 0이라 모델에서 제외했습니다.`);
  });
  if (activeMedia.length === 0) throw new Error('분석 기간에 광고비가 있는 매체가 없습니다.');
  const M = activeMedia.length;

  const spendWeekly = activeMedia.map(col => Float64Array.from(agg.values[col]));
  const spendTotal = spendWeekly.map(arr => arr.reduce((a, b) => a + b, 0));
  const totalSpendSum = spendTotal.reduce((a, b) => a + b, 0);
  const totalKPI = y.reduce((a, b) => a + b, 0);

  spendWeekly.forEach((arr, m) => {
    const mu = mean(arr);
    const sd = Math.sqrt(mean(Array.from(arr, v => (v - mu) ** 2)));
    if (mu > 0 && sd / mu < 0.15) warnings.push(`${activeMedia[m]}: 주간 광고비 변동이 거의 없어(변동계수 ${(sd / mu * 100).toFixed(0)}%) 효과 추정의 불확실성이 큽니다.`);
  });

  // ---- 3. Meridian 방식 스케일링 ----
  const yMean = mean(y);
  const sY = Math.sqrt(mean(Array.from(y, v => (v - yMean) ** 2)));
  if (!(sY > 0)) throw new Error('KPI 값이 모든 주에서 같아 분석할 수 없습니다.');
  const yStar = Float64Array.from(y, v => (v - yMean) / sY);

  const mediaScale = spendWeekly.map(arr => {
    const nz = Array.from(arr).filter(v => v > 0);
    return median(nz) || 1;
  });
  const xStar = spendWeekly.map((arr, m) => Float64Array.from(arr, v => v / mediaScale[m]));

  // ---- 4. 기저(knots) & 통제변수(프로모션) 설계행렬 ----
  const nKnots = T < 26 ? 1 : Math.max(2, Math.round(T / 12) + 1);
  const { W: knotW, positions: knotPositions } = buildKnotBasis(T, nKnots);

  const controls = [];
  promoColsInput.forEach(pc => {
    const raw = Float64Array.from(agg.values[pc] || []);
    if (raw.length !== T) return;
    const mu = mean(raw);
    const sd = Math.sqrt(mean(Array.from(raw, v => (v - mu) ** 2)));
    if (!(sd > 1e-9)) { warnings.push(`${pc}: 분석 기간 내내 값이 같아 프로모션 효과를 추정할 수 없어 제외했습니다.`); return; }
    controls.push({ name: pc, raw, mu, sd, z: Float64Array.from(raw, v => (v - mu) / sd) });
  });

  const K = nKnots + controls.length;
  const G = new Float64Array(T * K);
  for (let t = 0; t < T; t++) {
    for (let k = 0; k < nKnots; k++) G[t * K + k] = knotW[t][k];
    controls.forEach((cv, j) => { G[t * K + nKnots + j] = cv.z[t]; });
  }
  const GtG = new Float64Array(K * K);
  const Gty = new Float64Array(K);
  for (let t = 0; t < T; t++) {
    for (let i = 0; i < K; i++) {
      const gi = G[t * K + i];
      Gty[i] += gi * yStar[t];
      for (let j = 0; j < K; j++) GtG[i * K + j] += gi * G[t * K + j];
    }
  }

  // ---- 5. ROI 사전분포 ----
  let contribPrior = null;
  if (isCpaMode) {
    // Meridian: 매출이 아닌 KPI + revenue_per_kpi 없음 → 광고 총 기여 40% ± 20% 공통 ROI 사전분포
    const roiMean = 0.4 * totalKPI / totalSpendSum;
    const roiSd = 0.2 * totalKPI / Math.sqrt(spendTotal.reduce((a, b) => a + b * b, 0));
    const sig = Math.sqrt(Math.log(1 + (roiSd * roiSd) / (roiMean * roiMean)));
    contribPrior = { mu: Math.log(roiMean) - sig * sig / 2, sigma: sig };
  }
  const priors = activeMedia.map(col => {
    const conf = mediaPriorConfig[col] || {};
    const category = conf.category || 'none';
    const p = computePrior(category, conf.mixRatio || 0);
    if (!isCpaMode) return { ...p, category };
    // 매출이 아닌 KPI: 공통 사전분포를 기준으로, 카테고리를 지정한 경우 기본값 대비 상대 비율만 반영
    const rel = category === 'none' ? 0 : p.mu - MERIDIAN_DEFAULT_ROI.mu;
    const sigma = category === 'none' ? contribPrior.sigma : p.sigma;
    const mu = contribPrior.mu + rel;
    return { mu, sigma, roiMedian: Math.exp(mu), roiSigma: sigma, targetRoas: Math.exp(mu), category };
  });

  // ---- 6. MCMC ----
  const rng = makeRng(settings.seed);
  const ctx = { T, M, K, L: settings.maxLag, yStar, G, GtG, Gty, xStar, spendTotal, sY, priors };
  const fit = runSampler(ctx, settings, rng);
  if (Number.isFinite(fit.rhat.max) && fit.rhat.max > 1.1) {
    warnings.push(`MCMC 수렴 지표(R-hat 최대 ${fit.rhat.max.toFixed(2)})가 1.1을 넘었습니다. 데이터 기간을 늘리거나 매체를 묶어서 다시 분석하는 것을 권장합니다.`);
  }

  // ---- 7. 사후 표본으로 파생 지표 계산 ----
  const nD = Math.min(settings.derivedDraws, fit.pooled.length);
  const idxs = [];
  for (let i = 0; i < nD; i++) idxs.push(Math.floor((i * fit.pooled.length) / nD));
  const nGrid = Math.round(CURVE_MAX / CURVE_STEP) + 1;
  const gridMult = Array.from({ length: nGrid }, (_, j) => +(j * CURVE_STEP).toFixed(4));

  const roiDraws = activeMedia.map(() => new Float64Array(nD));
  const mroiDraws = activeMedia.map(() => new Float64Array(nD));
  const contribDraws = activeMedia.map(() => new Float64Array(nD));
  const decayDraws = activeMedia.map(() => new Float64Array(nD));
  const ecDraws = activeMedia.map(() => new Float64Array(nD));
  const weeklyContribSum = activeMedia.map(() => new Float64Array(T));
  const curveSum = activeMedia.map(() => new Float64Array(nGrid));
  const expectedSum = new Float64Array(T);
  const baseSum = new Float64Array(T);
  const predictive = [];
  const promoDraws = controls.map(() => new Float64Array(nD));
  const sigmaDraws = new Float64Array(nD);

  idxs.forEach((pi, d) => {
    const draw = fit.pooled[pi];
    const sig = Math.exp(draw.s);
    const sig2 = sig * sig;
    sigmaDraws[d] = sig;
    const media = new Float64Array(T);
    const Gtr = Float64Array.from(Gty);

    for (let m = 0; m < M; m++) {
      const alpha = sigmoid(draw.a[m]);
      const ec = Math.exp(draw.e[m]);
      const A = adstock(xStar[m], geometricAdstockWeights(alpha, settings.maxLag));
      let H = 0;
      const h = new Float64Array(T);
      for (let t = 0; t < T; t++) { h[t] = A[t] / (A[t] + ec); H += h[t]; }
      const roi = Math.exp(draw.r[m]);
      const beta = roi * spendTotal[m] / (sY * H);
      for (let t = 0; t < T; t++) {
        media[t] += beta * h[t];
        weeklyContribSum[m][t] += sY * beta * h[t];
        const bt = beta * h[t];
        for (let k = 0; k < K; k++) Gtr[k] -= G[t * K + k] * bt;
      }
      roiDraws[m][d] = roi;
      contribDraws[m][d] = roi * spendTotal[m];
      decayDraws[m][d] = alpha;
      ecDraws[m][d] = ec;
      const H101 = hillSum(A, ec, 1.01);
      mroiDraws[m][d] = sY * beta * (H101 - H) / (0.01 * spendTotal[m]);
      for (let j = 0; j < nGrid; j++) {
        curveSum[m][j] += sY * beta * (gridMult[j] === 0 ? 0 : hillSum(A, ec, gridMult[j]));
      }
    }

    // 선형 계수(knot·프로모션) 조건부 사후분포에서 1회 추출
    const P = new Float64Array(K * K);
    for (let i = 0; i < K * K; i++) P[i] = GtG[i] / sig2;
    for (let i = 0; i < K; i++) P[i * K + i] += 1 / settings.linearPriorVar;
    const Lc = cholesky(P, K);
    const q = Float64Array.from(Gtr, v => v / sig2);
    const meanLin = cholSolve(Lc, K, q);
    const noise = cholBackSolveT(Lc, K, Float64Array.from({ length: K }, () => rng.normal()));
    const lin = meanLin.map((v, k) => v + noise[k]);

    const pred = new Float64Array(T);
    for (let t = 0; t < T; t++) {
      let lp = 0, base = 0;
      for (let k = 0; k < K; k++) lp += G[t * K + k] * lin[k];
      for (let k = 0; k < nKnots; k++) base += G[t * K + k] * lin[k];
      controls.forEach((cv, j) => { base += lin[nKnots + j] * (-cv.mu / cv.sd); });
      const expected = yMean + sY * (lp + media[t]);
      expectedSum[t] += expected;
      baseSum[t] += yMean + sY * base;
      pred[t] = expected + sY * sig * rng.normal();
    }
    predictive.push(pred);
    controls.forEach((cv, j) => {
      let s = 0;
      for (let t = 0; t < T; t++) s += cv.raw[t];
      promoDraws[j][d] = sY * lin[nKnots + j] * s / cv.sd;
    });
  });

  // ---- 8. 적합도 ----
  const predictedKPI = Array.from(expectedSum, v => v / nD);
  const yUpper95 = [], yLower95 = [];
  let covered = 0;
  for (let t = 0; t < T; t++) {
    const col = Float64Array.from(predictive, p => p[t]).sort();
    const lo = quantile(col, 0.025), hi = quantile(col, 0.975);
    yLower95.push(Math.max(0, lo));
    yUpper95.push(hi);
    if (y[t] >= lo && y[t] <= hi) covered++;
  }
  let ssRes = 0, ssTot = 0, apeSum = 0, apeN = 0;
  for (let t = 0; t < T; t++) {
    ssRes += (y[t] - predictedKPI[t]) ** 2;
    ssTot += (y[t] - yMean) ** 2;
    if (y[t] !== 0) { apeSum += Math.abs((y[t] - predictedKPI[t]) / y[t]); apeN++; }
  }
  const rSquaredWeekly = Math.max(0, 1 - ssRes / (ssTot || 1));
  const rmse = Math.sqrt(ssRes / T);
  const mape = apeN ? (apeSum / apeN) * 100 : null;

  // ---- 9. 매체별 지표 ----
  const contribMean = contribDraws.map(arr => mean(arr));
  const totalMediaContrib = contribMean.reduce((a, b) => a + b, 0);
  const baselineKPI = totalKPI - totalMediaContrib;
  const scaleCpa = isCpaMode ? 1e6 : 1; // 매출이 아닌 KPI는 '광고비 100만원당' 단위로 표시

  const mRoasMap = {};
  activeMedia.forEach((col, m) => { mRoasMap[col] = mean(mroiDraws[m]) * scaleCpa; });
  const mRoasSorted = Object.values(mRoasMap).sort((a, b) => a - b);
  const medianMRoas = quantile(Float64Array.from(mRoasSorted), 0.5);

  const transformedMedia = {};
  const coefficients = {};
  const rawSpends = {}, rawImpressions = {}, rawClicks = {};

  const channelMetrics = activeMedia.map((col, m) => {
    const spend = spendTotal[m];
    const contrib = contribMean[m];
    const roiMean = mean(roiDraws[m]);
    const roiCI = interval95(roiDraws[m]);
    const contribCI = interval95(contribDraws[m]);
    const mRoas = mRoasMap[col];
    const mRoasCIraw = interval95(mroiDraws[m]);
    const decay = mean(decayDraws[m]);
    const ecMean = mean(ecDraws[m]);
    const shareOfSpend = totalSpendSum > 0 ? (spend / totalSpendSum) * 100 : 0;
    const shareOfContrib = totalKPI > 0 ? (contrib / totalKPI) * 100 : 0;

    const isEfficient = mRoas >= medianMRoas;
    const isHighSpend = shareOfSpend >= 100 / M;
    let quadrant;
    if (isHighSpend && isEfficient) quadrant = 'Stars';
    else if (isHighSpend && !isEfficient) quadrant = 'Cash Cows';
    else if (!isHighSpend && isEfficient) quadrant = 'Opportunities';
    else quadrant = 'Red Flags';

    const impArr = impCols[col] ? agg.values[impCols[col]] : null;
    const clkArr = clkCols[col] ? agg.values[clkCols[col]] : null;
    const totImp = impArr ? impArr.reduce((a, b) => a + b, 0) : 0;
    const totClk = clkArr ? clkArr.reduce((a, b) => a + b, 0) : 0;

    const curve = Array.from(curveSum[m], v => v / nD);
    const responseCurvePoints = [];
    for (let pct = 0; pct <= 200; pct += 10) {
      responseCurvePoints.push({ spendPercent: pct, spendAmount: spend * pct / 100, predictedKPI: curve[Math.round(pct / 100 / CURVE_STEP)] });
    }

    rawSpends[col] = Array.from(spendWeekly[m]);
    if (impArr) rawImpressions[col] = Array.from(impArr);
    if (clkArr) rawClicks[col] = Array.from(clkArr);
    transformedMedia[col] = Array.from(weeklyContribSum[m], v => v / nD); // 주별 기여분 (사후평균)
    coefficients[col] = 1;

    return {
      channel: col,
      spend,
      revenueContrib: contrib,
      contribCI,
      roi: roiMean,
      roiCI,
      avgRoas: isCpaMode ? (spend > 0 ? contrib / (spend / 1e6) : 0) : roiMean,
      avgRoasCI: roiCI.map(v => v * scaleCpa),
      mRoas,
      mRoasCI: mRoasCIraw.map(v => v * scaleCpa),
      params: {
        adstockType: 'geometric',
        decay,
        decayCI: interval95(decayDraws[m]),
        halfLifeWeeks: decay > 0 && decay < 1 ? Math.log(0.5) / Math.log(decay) : 0,
        peakLag: 0,
        alpha: settings.hillSlope,
        ec: ecMean,
        K: ecMean * mediaScale[m],
        mediaScale: mediaScale[m],
        adstockWeights: Array.from(geometricAdstockWeights(decay, settings.maxLag))
      },
      shareOfSpend,
      shareOfContrib,
      quadrant,
      cpm: totImp > 0 ? (spend / totImp) * 1000 : 0,
      cpc: totClk > 0 ? spend / totClk : 0,
      ctr: totImp > 0 ? (totClk / totImp) * 100 : 0,
      totImp,
      totClk,
      responseCurvePoints,
      responseCurve: { step: CURVE_STEP, max: CURVE_MAX, multipliers: gridMult, contrib: curve },
      priorConfig: { category: priors[m].category, roiMedian: priors[m].roiMedian * scaleCpa, roiSigma: priors[m].roiSigma },
      rhat: Math.max(fit.rhat.roi[m], fit.rhat.decay[m], fit.rhat.ec[m])
    };
  });

  // ---- 10. 계절성 (모델 기저선) & 요일·월초·월말 패턴 (일 데이터 참고 지표) ----
  const baseline = Array.from(baseSum, v => v / nD);
  const meanBase = mean(baseline);
  const seasonOf = (dn) => {
    const { month } = dayNumParts(dn + 3); // 주 중간(목요일) 기준
    if (month >= 3 && month <= 5) return 'Spring';
    if (month >= 6 && month <= 8) return 'Summer';
    if (month >= 9 && month <= 11) return 'Autumn';
    return 'Winter';
  };
  const seasonVals = { Spring: [], Summer: [], Autumn: [], Winter: [] };
  agg.periodStarts.forEach((dn, t) => seasonVals[seasonOf(dn)].push(baseline[t]));
  const seasonRatio = (arr) => arr.length ? ((mean(arr) - meanBase) / (yMean || 1)) * 100 : 0;

  let dailyPatterns = null;
  if (agg.inputFrequency === 'daily') {
    const start = agg.periodStarts[0];
    const end = agg.periodStarts[T - 1] + 6;
    dailyPatterns = computeDailyPatterns(agg.byDay, kpiCol, start, end);
  }
  const seasonalityEffects = {
    trendRatio: 0,
    weekendEffectRatio: dailyPatterns ? dailyPatterns.weekendEffectRatio : 0,
    earlyMonthEffectRatio: dailyPatterns ? dailyPatterns.earlyMonthEffectRatio : 0,
    lateMonthEffectRatio: dailyPatterns ? dailyPatterns.lateMonthEffectRatio : 0,
    springEffectRatio: seasonRatio(seasonVals.Spring),
    summerEffectRatio: seasonRatio(seasonVals.Summer),
    autumnEffectRatio: seasonRatio(seasonVals.Autumn),
    winterEffectRatio: seasonRatio(seasonVals.Winter),
    dayOfWeekIndex: dailyPatterns ? dailyPatterns.dayOfWeekIndex : null,
    hasDailyPatterns: !!dailyPatterns,
    seasonWeeks: { Spring: seasonVals.Spring.length, Summer: seasonVals.Summer.length, Autumn: seasonVals.Autumn.length, Winter: seasonVals.Winter.length }
  };

  const promoEffects = controls.map((cv, j) => {
    const total = mean(promoDraws[j]);
    const promoUnits = cv.raw.reduce((a, b) => a + b, 0);
    return {
      name: cv.name,
      coef: promoUnits > 0 ? total / promoUnits : 0, // 프로모션 1일당 효과
      totalEffect: total,
      totalEffectCI: interval95(promoDraws[j]),
      effectRatio: totalKPI > 0 ? (total / totalKPI) * 100 : 0
    };
  });

  const periodEndDn = agg.periodStarts[T - 1] + 6;

  return {
    kpiTerms,
    isCpaMode,
    mediaPriors: Object.fromEntries(activeMedia.map((col, m) => [col, priors[m]])),
    knotBaseline: { knotIndices: knotPositions, numKnots: nKnots, knotIntervalWeeks: nKnots > 1 ? (T - 1) / (nKnots - 1) : T },
    modelInfo: {
      engine: 'Bayesian MMM v3 (Meridian 방식 JavaScript 구현)',
      frequency: 'weekly',
      inputFrequency: agg.inputFrequency,
      nWeeks: T,
      nInputDays: agg.inputFrequency === 'daily' ? agg.days.length : null,
      droppedEdgeDays: agg.droppedEdgeDays,
      periodStart: dates[0],
      periodEnd: dayNumToKey(periodEndDn),
      adstock: `geometric (max_lag ${settings.maxLag}주)`,
      hill: `slope ${settings.hillSlope} 고정`,
      knots: nKnots,
      controls: controls.map(cv => cv.name),
      chains: settings.chains,
      draws: fit.pooled.length,
      derivedDraws: nD,
      rhatMax: fit.rhat.max,
      acceptance: fit.acceptance,
      roiPriorType: isCpaMode ? '광고 총 기여 40%±20% (Meridian 기본, 매출 외 KPI)' : 'ROI LogNormal (Meridian 기본 0.2, 0.9 / 카테고리별 조정)',
      warnings
    },
    summary: {
      totalKPI,
      totalSpend: totalSpendSum,
      totalROAS: isCpaMode
        ? (totalSpendSum > 0 ? totalKPI / (totalSpendSum / 1e6) : 0)
        : (totalSpendSum > 0 ? totalKPI / totalSpendSum : 0),
      mediaROAS: isCpaMode
        ? (totalSpendSum > 0 ? totalMediaContrib / (totalSpendSum / 1e6) : 0)
        : (totalSpendSum > 0 ? totalMediaContrib / totalSpendSum : 0),
      totalMediaContrib,
      rSquared: rSquaredWeekly,
      rSquaredWeekly,
      rSquaredDaily: null,
      rmse,
      mape,
      ciCoverage: (covered / T) * 100,
      rhatMax: fit.rhat.max,
      baselineKPI,
      baselineRatio: totalKPI > 0 ? (baselineKPI / totalKPI) * 100 : 0,
      sampleSize: T,
      sampleUnit: '주'
    },
    dates,
    actualKPI: Array.from(y),
    predictedKPI,
    yUpper95,
    yLower95,
    baselineSeries: baseline,
    channelMetrics,
    seasonalityEffects,
    promoEffects,
    coefficients,
    rawSpends,
    rawImpressions,
    rawClicks,
    transformedMedia
  };
}


// ============================================================
// SECTION 6: 예산 시뮬레이터 & 최적화 (사후평균 반응곡선 기반)
// ============================================================

/** 반응곡선에서 배수(multiplier)에 해당하는 기여분을 선형보간 */
function curveAt(curve, mult) {
  if (!curve) return 0;
  const k = Math.max(0, Math.min(curve.max, mult));
  const pos = k / curve.step;
  const lo = Math.floor(pos), hi = Math.min(curve.contrib.length - 1, lo + 1);
  const w = pos - lo;
  return curve.contrib[lo] * (1 - w) + curve.contrib[hi] * w;
}

/**
 * 매체별 예산 배수를 바꿨을 때의 예상 KPI
 * (과거 주별 집행 패턴을 그대로 두고 금액만 배수만큼 바꾼다고 가정)
 */
export function simulateBudgetChange(baseMMMResult, budgetMultipliers) {
  const { channelMetrics, summary, isCpaMode } = baseMMMResult;
  let newTotalMediaContrib = 0;
  let newTotalSpend = 0;

  const simulatedChannels = channelMetrics.map(m => {
    const multiplier = budgetMultipliers[m.channel] !== undefined ? Number(budgetMultipliers[m.channel]) : 1.0;
    const newSpend = m.spend * multiplier;
    const newContrib = curveAt(m.responseCurve, multiplier);
    newTotalSpend += newSpend;
    newTotalMediaContrib += newContrib;
    return {
      channel: m.channel,
      originalSpend: m.spend,
      newSpend,
      originalContrib: m.revenueContrib,
      newContrib,
      newROAS: isCpaMode
        ? (newSpend > 0 ? newContrib / (newSpend / 1e6) : 0)
        : (newSpend > 0 ? newContrib / newSpend : 0)
    };
  });

  const predictedTotalKPI = summary.baselineKPI + newTotalMediaContrib;
  return {
    simulatedChannels,
    predictedTotalKPI,
    newTotalSpend,
    newTotalMediaContrib,
    // 광고 기여분 기준 ROAS (자연 발생 매출 제외)
    newOverallROAS: isCpaMode
      ? (newTotalSpend > 0 ? newTotalMediaContrib / (newTotalSpend / 1e6) : 0)
      : (newTotalSpend > 0 ? newTotalMediaContrib / newTotalSpend : 0),
    kpiChangePercent: summary.totalKPI > 0 ? ((predictedTotalKPI - summary.totalKPI) / summary.totalKPI) * 100 : 0
  };
}

/**
 * mROAS 균등화 예산 최적화
 * 총 예산을 작은 단위로 나눠, 매번 '1원당 추가 기여'가 가장 큰 매체에 배정합니다.
 * 반응곡선이 오목(체감)하므로 이 방식이 주어진 범위 안에서의 최적 배분이 됩니다.
 * @param {number} totalBudget 0이면 현재 총 예산 유지
 * @param {Object} constraints { 매체: { minMult, maxMult } } 기본 0.5배 ~ 2.0배 (시뮬레이터 슬라이더 범위)
 */
export function optimizeBudget(baseMMMResult, totalBudget = 0, constraints = {}) {
  const { channelMetrics, summary, isCpaMode } = baseMMMResult;
  const budget = totalBudget > 0 ? totalBudget : summary.totalSpend;

  const ch = channelMetrics.map(m => {
    const c = constraints[m.channel] || {};
    const lo = m.spend * (c.minMult ?? 0.5);
    const hi = m.spend * (c.maxMult ?? 2.0);
    return { m, lo, hi, alloc: lo };
  });
  const contribAt = (c, spend) => (c.m.spend > 0 ? curveAt(c.m.responseCurve, spend / c.m.spend) : 0);

  let remaining = budget - ch.reduce((a, c) => a + c.alloc, 0);
  if (remaining < 0) {
    const f = budget / ch.reduce((a, c) => a + c.alloc, 0);
    ch.forEach(c => { c.alloc *= f; });
    remaining = 0;
  }
  const step = budget / 1000;
  let guard = 0;
  while (remaining > budget * 1e-9 && guard++ < 5000) {
    let best = null, bestGain = -Infinity, bestDelta = 0;
    ch.forEach(c => {
      const room = c.hi - c.alloc;
      if (room <= 0) return;
      const delta = Math.min(step, room, remaining);
      const gain = (contribAt(c, c.alloc + delta) - contribAt(c, c.alloc)) / delta;
      if (gain > bestGain) { bestGain = gain; best = c; bestDelta = delta; }
    });
    if (!best) break;
    best.alloc += bestDelta;
    remaining -= bestDelta;
  }

  const scaleCpa = isCpaMode ? 1e6 : 1;
  const optimizedChannels = ch.map(c => {
    const newContrib = contribAt(c, c.alloc);
    const d = Math.max(1, c.m.spend * 0.01);
    const marginal = (contribAt(c, c.alloc + d) - newContrib) / d;
    return {
      channel: c.m.channel,
      originalSpend: c.m.spend,
      optimizedSpend: c.alloc,
      spendChangePercent: c.m.spend > 0 ? ((c.alloc - c.m.spend) / c.m.spend) * 100 : 0,
      originalContrib: c.m.revenueContrib,
      optimizedContrib: newContrib,
      optimizedROAS: c.alloc > 0 ? (newContrib / c.alloc) * scaleCpa : 0,
      mRoas: marginal * scaleCpa
    };
  });

  const predictedTotalKPI = summary.baselineKPI + optimizedChannels.reduce((a, c) => a + c.optimizedContrib, 0);
  return {
    optimizedChannels,
    predictedTotalKPI,
    totalBudget: budget,
    unallocatedBudget: Math.max(0, remaining),
    originalTotalKPI: summary.totalKPI,
    kpiGainPercent: summary.totalKPI > 0 ? ((predictedTotalKPI - summary.totalKPI) / summary.totalKPI) * 100 : 0,
    convergenceReached: remaining <= budget * 1e-6
  };
}
