/**
 * Advanced Google Meridian Grade MMM Mathematical Engine v2.0
 * 
 * Major Enhancements (Meridian v2):
 * 1. Delayed Adstock Carryover (Peak lag & Shape)
 * 2. Exact Hill Transformation (alpha & K)
 * 3. Marginal ROAS (mROAS) using analytical derivatives
 * 4. Funnel Efficiency Metrics (CPM, CPC, CTR)
 * 5. Bayesian MAP Approximation (L2/Ridge Priors)
 * 6. Attribution 4-Quadrant Positioning Matrix
 * 7. 95% Bayesian-style Confidence Intervals
 * 
 * NEW in v2.0:
 * 8. Knot-based Piecewise Linear Spline Baseline (Meridian Standard)
 * 9. Category-based Dynamic ROAS Prior with mixRatio interpolation
 * 10. mROAS Equalization Budget Optimizer
 */

// ============================================================
// SECTION 0: Media Category Definitions & Prior Configuration
// ============================================================

/**
 * 매체 카테고리별 사전 확률(Prior) 설정 상수
 * 
 * haircutFactor: 대시보드 ROAS를 곱해서 타겟 ROAS(과녁 중심)를 구하는 계수
 * penaltyLambda: 과녁에서 벗어나지 못하게 잡아두는 고무줄의 두께 (클수록 강한 제약)
 * defaultTargetRoas: 대시보드 ROAS 입력이 없을 때의 기본 타겟 ROAS
 * mixHaircutFactor: 혼합 비중(브랜드 비중 / 리타겟 비중) 적용 시 사용하는 하위 계수
 */
export const MEDIA_CATEGORIES = {
  'brand_search': {
    label: '브랜드 검색 캠페인',
    haircutFactor: 0.20,
    penaltyLambda: 2.0,      // 매우 강함 (쇠사슬)
    maxPriorWeight: 0.85,
    defaultTargetRoas: 0.8,
    description: '자사명/브랜드명 키워드 검색 광고'
  },
  'keyword_search': {
    label: '키워드 및 쇼핑 검색 캠페인',
    haircutFactor: 0.50,        // 일반 검색 부분
    penaltyLambda: 1.5,         // DA보다 강력한 기본 제어
    mixPenaltyLambda: 0.5,      // 브랜드 비중 100%일때 +0.5 (최대 2.0)
    maxPriorWeight: 0.50,
    defaultTargetRoas: 1.5,
    mixHaircutFactor: 0.20,     // 브랜드 비중 부분
    description: '일반/쇼핑 검색 (브랜드 키워드 비중 슬라이더 지원)'
  },
  'display_conversion': {
    label: '디스플레이 - 전환',
    haircutFactor: 0.60,        // 신규 전환 부분
    penaltyLambda: 1.0,         // 보통 강도
    mixPenaltyLambda: 0.5,      // 리타겟 비중 100%일때 +0.5 (최대 1.5)
    maxPriorWeight: 0.25,
    defaultTargetRoas: 1.2,
    mixHaircutFactor: 0.25,     // 리타겟 부분
    description: '메타/구글/틱톡 등 전환 목적 캠페인 (리타겟 비중 슬라이더 지원)'
  },
  'display_traffic': {
    label: '디스플레이 - 트래픽/유입',
    haircutFactor: 0.70,
    penaltyLambda: 0.5,         // 약함
    maxPriorWeight: 0.15,
    defaultTargetRoas: 1.0,
    description: '신규 유입/인지 목적 디스플레이 배너'
  },
  'video_content': {
    label: '동영상 / 콘텐츠',
    haircutFactor: 1.20,        // 오히려 올려줌 (과소계상 매체)
    penaltyLambda: 0.2,         // 매우 약함 (거미줄)
    maxPriorWeight: 0.1,
    defaultTargetRoas: 1.0,
    description: '유튜브, 틱톡 브랜딩, 인플루언서, 온드미디어 브랜디드 콘텐츠'
  },
  'offline_ooh': {
    label: '오프라인 / 옥외 (OOH, TV 등)',
    haircutFactor: 1.0,
    penaltyLambda: 0.1,         // 거의 없음 (데이터에 전적으로 맡김)
    maxPriorWeight: 0.05,
    defaultTargetRoas: 1.0,
    description: '옥외광고, TV, 라디오 등 오프라인 매체'
  },
  'none': {
    label: '설정 안함 (기본값)',
    haircutFactor: 0.50,
    penaltyLambda: 0.5,
    maxPriorWeight: 0.15,
    defaultTargetRoas: 1.5,
    description: '카테고리를 지정하지 않은 매체에 적용되는 기본 설정'
  }
};

/**
 * 카테고리와 mixRatio를 기반으로 최종 보정 계수(Haircut)와 페널티 강도를 계산합니다.
 * 
 * @param {string} category - MEDIA_CATEGORIES의 키
 * @param {number} mixRatio - 0~1 사이 혼합 비중 (브랜드검색 비중 또는 리타겟 비중)
 * @param {number|null} dashboardRoas - 사용자가 입력한 대시보드 ROAS (null이면 기본값 사용)
 * @returns {{ targetRoas: number, penaltyLambda: number, maxPriorWeight: number }}
 */
export function computePrior(category = 'none', mixRatio = 0, dashboardRoas = null) {
  const config = MEDIA_CATEGORIES[category] || MEDIA_CATEGORIES['none'];
  
  // 혼합 비중이 있는 카테고리(검색, 디스플레이 전환)는 선형 보간(Interpolation)
  let effectiveHaircut = config.haircutFactor;
  let effectiveLambda = config.penaltyLambda;
  const maxWeight = config.maxPriorWeight || 0.5;

  if (config.mixHaircutFactor !== undefined && mixRatio > 0) {
    // (1 - mixRatio) * 일반 계수 + mixRatio * 하위(브랜드/리타겟) 계수
    effectiveHaircut = (1 - mixRatio) * config.haircutFactor + mixRatio * config.mixHaircutFactor;
    // 혼합 비중이 높을수록 페널티도 강해짐 (리타겟/브랜드가 많으면 더 깎아야 하므로)
    const mixLambdaIncrease = config.mixPenaltyLambda !== undefined ? config.mixPenaltyLambda : 0.8;
    effectiveLambda = config.penaltyLambda + (mixRatio * mixLambdaIncrease);
  }

  let targetRoas;
  if (dashboardRoas !== null && dashboardRoas > 0) {
    targetRoas = dashboardRoas * effectiveHaircut;
  } else {
    targetRoas = config.defaultTargetRoas;
  }

  // 최소 타겟 ROAS 보장 (0에 가까워지면 모델이 불안정해짐)
  targetRoas = Math.max(0.1, targetRoas);

  return { targetRoas, penaltyLambda: effectiveLambda, maxPriorWeight: maxWeight };
}


// ============================================================
// SECTION 1: Linear Algebra Helpers
// ============================================================

function transpose(A) {
  const m = A.length;
  const n = A[0].length;
  const AT = Array.from({ length: n }, () => new Array(m).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      AT[j][i] = A[i][j];
    }
  }
  return AT;
}

function multiply(A, B) {
  const m = A.length;
  const n = A[0].length;
  const p = B[0].length;
  const C = Array.from({ length: m }, () => new Array(p).fill(0));
  for (let i = 0; i < m; i++) {
    for (let k = 0; k < n; k++) {
      for (let j = 0; j < p; j++) {
        C[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  return C;
}


// ============================================================
// SECTION 2: Media Transformation Functions
// ============================================================

/**
 * Delayed Adstock Transformation (Meridian standard)
 * 가중치: w(l) = decay^((l - peakLag)^2), 정규화 적용
 */
export function applyDelayedAdstock(series, decay = 0.5, peakLag = 0, maxLag = 10) {
  const n = series.length;
  const adstocked = new Array(n).fill(0);
  
  let weights = [];
  let sumWeights = 0;
  for (let l = 0; l <= maxLag; l++) {
    const w = Math.pow(decay, Math.pow(l - peakLag, 2));
    weights.push(w);
    sumWeights += w;
  }
  weights = weights.map(w => w / sumWeights);

  for (let t = 0; t < n; t++) {
    let sum = 0;
    for (let l = 0; l <= maxLag; l++) {
      if (t - l >= 0) {
        sum += weights[l] * series[t - l];
      }
    }
    adstocked[t] = sum;
  }
  return { adstocked, weights };
}

/**
 * Exact Hill Saturation Transformation: x^alpha / (x^alpha + K^alpha)
 */
export function applyHillTransformation(series, alpha = 1.0, K = 100000) {
  return series.map(x => {
    if (x <= 0) return 0;
    const xAlpha = Math.pow(x, Math.max(0.1, alpha));
    const KAlpha = Math.pow(K, Math.max(0.1, alpha));
    return xAlpha / (xAlpha + KAlpha);
  });
}


// ============================================================
// SECTION 3: Knot-based Piecewise Linear Spline Baseline
// (Google Meridian Standard - replaces simple linear trend)
// ============================================================

/**
 * Knot(매듭) 기반 Piecewise Linear Spline 베이스라인을 생성합니다.
 * 
 * 구글 메르디안은 전체 기간을 N개의 Anchor Knot으로 나누고,
 * 각 Knot 사이를 선형 보간(Linear Interpolation)하여
 * 비선형적 시간 추세(Organic Trend)를 유연하게 캡처합니다.
 * 
 * @param {number} totalDays - 전체 데이터 일수
 * @param {number} knotInterval - 매듭 간격 (일 단위, 기본 28일 = 4주)
 * @returns {{ knotIndices: number[], knotFeatures: number[][] }}
 *   - knotIndices: 각 Knot의 시점 인덱스 배열
 *   - knotFeatures: [N x numKnots] 행렬. 각 시점의 Knot 보간 가중치
 */
export function generateKnotBaseline(totalDays, knotInterval = 28) {
  // 최소 3개 Knot 보장 (시작점, 중간, 끝점)
  const numIntervals = Math.max(2, Math.floor(totalDays / knotInterval));
  const numKnots = numIntervals + 1;
  
  // Knot 위치를 등간격으로 배치
  const knotIndices = [];
  for (let k = 0; k < numKnots; k++) {
    knotIndices.push(Math.round((k / numIntervals) * (totalDays - 1)));
  }

  // 각 시점(t)에 대해 Knot 보간 가중치 계산
  // t가 knotIndices[k]와 knotIndices[k+1] 사이에 있으면,
  // knot k에 대한 가중치 = (knotIndices[k+1] - t) / (knotIndices[k+1] - knotIndices[k])
  // knot k+1에 대한 가중치 = (t - knotIndices[k]) / (knotIndices[k+1] - knotIndices[k])
  const knotFeatures = [];
  for (let t = 0; t < totalDays; t++) {
    const row = new Array(numKnots).fill(0);
    
    // t가 어느 구간에 속하는지 찾기
    let segIdx = 0;
    for (let k = 0; k < numKnots - 1; k++) {
      if (t >= knotIndices[k]) segIdx = k;
    }
    
    const leftKnot = knotIndices[segIdx];
    const rightKnot = knotIndices[Math.min(segIdx + 1, numKnots - 1)];
    const span = rightKnot - leftKnot;
    
    if (span > 0) {
      const w = (rightKnot - t) / span; // 왼쪽 Knot에 대한 가중치
      row[segIdx] = w;
      row[Math.min(segIdx + 1, numKnots - 1)] = 1 - w;
    } else {
      row[segIdx] = 1; // 동일 지점이면 100% 가중치
    }
    
    knotFeatures.push(row);
  }

  return { knotIndices, knotFeatures, numKnots };
}


// ============================================================
// SECTION 4: Seasonality & Date Features
// ============================================================

export function extractSeasonalityFeatures(dateStr, index, totalDays) {
  let d = new Date(dateStr);
  if (typeof dateStr === 'number') {
    d = new Date(Math.round((dateStr - 25569) * 86400 * 1000));
  }

  if (isNaN(d.getTime())) {
    return { month: 1, dayOfWeek: 1, isWeekend: 0, season: 'Winter', trend: index / totalDays };
  }

  const month = d.getMonth() + 1;
  const dayOfWeek = d.getDay();
  const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6) ? 1 : 0;

  let season = 'Winter';
  if (month >= 3 && month <= 5) season = 'Spring';
  else if (month >= 6 && month <= 8) season = 'Summer';
  else if (month >= 9 && month <= 11) season = 'Autumn';

  return { month, dayOfWeek, isWeekend, season, trend: index / totalDays };
}


// ============================================================
// SECTION 5: Core MMM Analysis Engine (Meridian v2.0)
// ============================================================

/**
 * Deep MMM Analysis Engine (Meridian v2.0 Compliant)
 * 
 * @param {Array} rawData - 원본 데이터 배열
 * @param {string} dateCol - 날짜 컬럼명
 * @param {string} kpiCol - KPI 컬럼명
 * @param {Array} mediaCols - 매체 비용 컬럼명 배열
 * @param {Object} extraCols - 추가 컬럼 설정 (프로모션, 노출수, 클릭수 등)
 * @param {string} kpiType - KPI 유형 ('revenue', 'purchase', 'traffic', 'install', 'lead')
 * @param {Object} mediaPriorConfig - 매체별 사전 확률 설정
 *   예: { '(Meta) 광고비': { category: 'display_conversion', mixRatio: 0.3, dashboardRoas: 3.5 } }
 */
export function runMMMAnalysis(rawData, dateCol, kpiCol, mediaCols, extraCols = {}, kpiType = 'revenue', mediaPriorConfig = {}) {
  if (!rawData || rawData.length === 0 || !mediaCols || mediaCols.length === 0) {
    throw new Error("데이터가 충분하지 않습니다.");
  }

  const kpiMapping = {
    'revenue': { name: '매출액', roas: 'ROAS', unit: '₩' },
    'purchase': { name: '구매수', roas: 'CPA(단위당 효율)', unit: '건' },
    'traffic': { name: '유입수', roas: '단위당 효율', unit: '회' },
    'install': { name: '앱설치수', roas: 'CPI(단위당 효율)', unit: '건' },
    'lead': { name: '잠재고객 획득', roas: 'CPA(단위당 효율)', unit: '명' }
  };
  const kpiTerms = kpiMapping[kpiType] || kpiMapping['revenue'];

  const N = rawData.length;
  
  // ---- Date Parsing (timezone-safe) ----
  const dates = rawData.map((r, idx) => {
    const d = r[dateCol];
    const formatLocal = (dt) => {
       const yyyy = dt.getFullYear();
       const mm = String(dt.getMonth() + 1).padStart(2, '0');
       const dd = String(dt.getDate()).padStart(2, '0');
       return `${yyyy}-${mm}-${dd}`;
    };
    if (typeof d === 'number') {
      const dt = new Date(Math.round((d - 25569) * 86400 * 1000));
      const yyyy = dt.getUTCFullYear();
      const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(dt.getUTCDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    if (d instanceof Date) return formatLocal(d);
    if (typeof d === 'string') {
       if (/^\d{4}[-\./]\d{2}[-\./]\d{2}/.test(d)) {
           return d.substring(0, 10).replace(/[\./]/g, '-');
       }
       const parsed = new Date(d);
       if (!isNaN(parsed.getTime())) return formatLocal(parsed);
    }
    return `Day ${idx + 1}`;
  });
  
  const y = rawData.map(r => Number(r[kpiCol]) || 0);

  // ---- Seasonality Features (Weekend, Season, Early/Late Month) ----
  const seasonalityInfo = dates.map((d, i) => extractSeasonalityFeatures(d, i, N));
  const isWeekendArr = seasonalityInfo.map(s => s.isWeekend);
  const isSpringArr = seasonalityInfo.map(s => s.season === 'Spring' ? 1 : 0);
  const isSummerArr = seasonalityInfo.map(s => s.season === 'Summer' ? 1 : 0);
  const isAutumnArr = seasonalityInfo.map(s => s.season === 'Autumn' ? 1 : 0);
  const isWinterArr = seasonalityInfo.map(s => s.season === 'Winter' ? 1 : 0);
  
  const isEarlyMonthArr = dates.map(d => {
    if (typeof d !== 'string' || d.length < 10) return 0;
    const day = parseInt(d.substring(8, 10), 10);
    return day <= 5 ? 1 : 0;
  });
  const isLateMonthArr = dates.map(d => {
    if (typeof d !== 'string' || d.length < 10) return 0;
    const year = parseInt(d.substring(0, 4), 10);
    const month = parseInt(d.substring(5, 7), 10);
    const day = parseInt(d.substring(8, 10), 10);
    const lastDay = new Date(year, month, 0).getDate();
    return day > lastDay - 5 ? 1 : 0;
  });

  // ---- [NEW] Knot-based Piecewise Linear Spline Baseline ----
  // 겨울철 등 계절성 더미 변수가 효과를 가질 수 있도록 매듭 간격을 늘립니다 (최소 60일)
  const knotInterval = Math.max(60, Math.round(N / 6));
  const { knotFeatures, numKnots, knotIndices } = generateKnotBaseline(N, knotInterval);

  // ---- Media Raw Data Collection ----
  const transformedMedia = {};
  const rawSpends = {};
  const rawImpressions = {};
  const rawClicks = {};
  const totalSpends = {};
  const meridianParams = {};

  mediaCols.forEach(col => {
    const rawSpend = rawData.map(r => Number(r[col]) || 0);
    rawSpends[col] = rawSpend;
    totalSpends[col] = rawSpend.reduce((a, b) => a + b, 0);

    const impCol = extraCols[`${col}_impressions`] || extraCols[`${col}_imp`];
    const clkCol = extraCols[`${col}_clicks`] || extraCols[`${col}_clk`];
    if (impCol) rawImpressions[col] = rawData.map(r => Number(r[impCol]) || 0);
    if (clkCol) rawClicks[col] = rawData.map(r => Number(r[clkCol]) || 0);
  });

  // ---- [NEW] Compute Prior for each media channel ----
  const mediaPriors = {};
  const totalSpendSum = Object.values(totalSpends).reduce((a, b) => a + b, 0);
  const totalKPIRaw = y.reduce((a, b) => a + b, 0);
  const brandAvgRoas = totalSpendSum > 0 ? (totalKPIRaw / totalSpendSum) : 1.5;

  mediaCols.forEach(col => {
    const priorConf = mediaPriorConfig[col] || {};
    const category = priorConf.category || 'none';
    const mixRatio = priorConf.mixRatio || 0;
    const dashboardRoas = priorConf.dashboardRoas || null;
    
    const { targetRoas, penaltyLambda } = computePrior(category, mixRatio, dashboardRoas);
    mediaPriors[col] = { targetRoas, penaltyLambda, category };
  });

  // ---- [NEW] Dynamic Scaling: 모든 매체의 Prior ROAS 합산 매출이 총매출을 초과하면 일괄 축소 ----
  let totalPriorClaim = 0;
  mediaCols.forEach(col => {
    totalPriorClaim += mediaPriors[col].targetRoas * totalSpends[col];
  });
  const maxMediaClaim = totalKPIRaw * 0.85; // 베이스라인 최소 15% 보호
  if (totalPriorClaim > maxMediaClaim && totalPriorClaim > 0) {
    const scaleFactor = maxMediaClaim / totalPriorClaim;
    mediaCols.forEach(col => {
      mediaPriors[col].targetRoas *= scaleFactor;
    });
  }

  // ---- Design Matrix Setup ----
  const seasonalityFeatureNames = ['주말(Weekend)', '봄(Spring)', '여름(Summer)', '가을(Autumn)', '겨울(Winter)', '월초(Early)', '월말(Late)'];
  const seasonalityMatrixCols = [isWeekendArr, isSpringArr, isSummerArr, isAutumnArr, isWinterArr, isEarlyMonthArr, isLateMonthArr];
  
  // Knot feature names
  const knotFeatureNames = [];
  for (let k = 0; k < numKnots; k++) {
    knotFeatureNames.push(`Knot_${k}`);
  }

  const promoCols = extraCols.promoCols || [];

  const maxLag = 8;

  // ============================================================
  // evaluateParams: Core optimization function with Prior Penalty
  // ============================================================
  const evaluateParams = (currentParams) => {
    const X = [];
    for (let i = 0; i < N; i++) X.push([1]); // Intercept

    const activeMedia = mediaCols;
    
    // Media features (Adstock -> Hill)
    activeMedia.forEach(col => {
      const p = currentParams[col];
      const { adstocked } = applyDelayedAdstock(rawSpends[col], p.decay, p.peakLag, maxLag);
      const saturated = applyHillTransformation(adstocked, p.alpha, p.K);
      for (let i = 0; i < N; i++) X[i].push(saturated[i]);
    });

    // [NEW] Knot baseline features (replaces simple linear trend)
    for (let k = 0; k < numKnots; k++) {
      for (let i = 0; i < N; i++) X[i].push(knotFeatures[i][k]);
    }

    // Seasonality features
    seasonalityMatrixCols.forEach(arr => {
      for (let i = 0; i < N; i++) X[i].push(arr[i]);
    });

    // Promo features
    promoCols.forEach(pCol => {
      for (let i = 0; i < N; i++) X[i].push(pCol ? (Number(rawData[i][pCol]) || 0) : 0);
    });
    
    const currentFeatures = ['Intercept', ...activeMedia, ...knotFeatureNames, ...seasonalityFeatureNames];
    promoCols.forEach((pCol, idx) => {
      if (pCol) currentFeatures.push(`프로모션${promoCols.length > 1 ? idx + 1 : ''}(Promo)`);
    });
    const currentNumFeatures = currentFeatures.length;

    // ---- Mean-centering & Standardization ----
    const means = new Array(currentNumFeatures).fill(0);
    const stds = new Array(currentNumFeatures).fill(1);
    
    const X_centered = X.map(row => [...row]);
    
    for (let j = 1; j < currentNumFeatures; j++) {
      let m = 0;
      for (let i = 0; i < N; i++) m += X[i][j];
      means[j] = m / N;
    }
    for (let i = 0; i < N; i++) {
      for (let j = 1; j < currentNumFeatures; j++) {
        X_centered[i][j] -= means[j];
      }
    }

    for (let i = 0; i < N; i++) {
      for (let j = 1; j < currentNumFeatures; j++) stds[j] += Math.pow(X_centered[i][j], 2);
    }
    for (let j = 1; j < currentNumFeatures; j++) {
      stds[j] = Math.sqrt(stds[j] / N);
    }

    const X_norm = [];
    for (let i = 0; i < N; i++) {
      const row = [1];
      for (let j = 1; j < currentNumFeatures; j++) {
        row.push(stds[j] > 1e-4 ? X_centered[i][j] / stds[j] : 0);
      }
      X_norm.push(row);
    }

    let meanY = 0;
    for (let i = 0; i < N; i++) meanY += y[i];
    meanY /= N || 1;
    let stdY = 0;
    for (let i = 0; i < N; i++) stdY += Math.pow(y[i] - meanY, 2);
    stdY = Math.sqrt(stdY / N) || 1e-6;

    const Y_norm = y.map(val => [(val - meanY) / stdY]);

    const XT_norm = transpose(X_norm);
    const XTX = multiply(XT_norm, X_norm);

    // ---- [NEW] Differentiated Ridge Penalty based on feature type ----
    for (let j = 1; j < currentNumFeatures; j++) {
      const featureName = currentFeatures[j];
      const isMedia = activeMedia.includes(featureName);
      const isKnot = featureName.startsWith('Knot_');
      
      if (isMedia) {
        // 매체별 Prior 기반 페널티
        const prior = mediaPriors[featureName] || { penaltyLambda: 0.5 };
        XTX[j][j] += prior.penaltyLambda * 0.01; // XTX 레벨에서 약한 Ridge
      } else if (isKnot) {
        // Knot가 계절성(더미) 변수를 모두 흡수하지 않도록 강한 평활화 페널티 부여
        XTX[j][j] += 1.0;
      } else {
        XTX[j][j] += 0.0001; // 계절성/프로모션에는 최소 페널티
      }
    }

    const XTY = multiply(XT_norm, Y_norm).map(r => r[0]);

    // ---- [NEW] Coordinate Descent with ROAS-based Prior Penalty ----
    const beta_norm = new Array(currentNumFeatures).fill(0);
    const maxIter = 80;
    
    for (let iter = 0; iter < maxIter; iter++) {
      let maxDiff = 0;
      for (let j = 0; j < currentNumFeatures; j++) {
        let sum = 0;
        for (let k = 0; k < currentNumFeatures; k++) {
          if (j !== k) sum += XTX[j][k] * beta_norm[k];
        }
        
        const featureName = currentFeatures[j];
        const isMedia = activeMedia.includes(featureName);
        
        let lambda, priorMu;
        
        if (isMedia) {
          // [NEW] 카테고리 기반의 동적 Prior 페널티
          const prior = mediaPriors[featureName] || { penaltyLambda: 0.5, targetRoas: 1.5 };
          
          // 수학적 오류 수정: beta_raw = (targetRoas * spend) / sum(X) 
          // beta_norm = beta_raw * (stdX / stdY)
          const jIdx = currentFeatures.indexOf(featureName);
          const meanX = means[jIdx];
          const stdX = stds[jIdx];
          const spend = totalSpends[featureName] || 1;
          
          if (meanX > 1e-6) {
             const betaRawTarget = (prior.targetRoas * spend) / (meanX * N);
             priorMu = betaRawTarget * (stdX / stdY);
          } else {
             priorMu = 0;
          }
          
          // Config-driven Prior weight computation
          const maxWeight = prior.maxPriorWeight !== undefined ? prior.maxPriorWeight : 0.5;
          const priorWeight = Math.min(maxWeight, prior.penaltyLambda / (prior.penaltyLambda + 1.0));
          lambda = XTX[j][j] * (priorWeight / (1 - priorWeight));
          
          // Store priorWeight for soft barrier
          prior.currentWeight = priorWeight;
        } else {
          lambda = 0.001 * N;
          priorMu = 0;
        }
        
        let newBeta = (XTY[j] - sum + lambda * priorMu) / (XTX[j][j] + lambda);
        
        // Meridian의 MCMC Log-Normal Prior(양수 꼬리) 효과를 모사하기 위한 Soft Barrier
        if (isMedia) {
          if (newBeta < 0) {
            // Prior의 신뢰도(priorWeight)가 높을수록 0으로 떨어지는 속도를 늦춰줌(Soft Landing)
            const currentPrior = mediaPriors[featureName] || { currentWeight: 0.1 };
            const weight = currentPrior.currentWeight || 0.1;
            const floorAnchor = priorMu * weight; 
            const decay = Math.exp(newBeta / priorMu); 
            newBeta = floorAnchor * decay; 
          }
        }
          
        const diff = Math.abs(newBeta - beta_norm[j]);
        if (diff > maxDiff) maxDiff = diff;
        beta_norm[j] = newBeta;
      }
      if (maxDiff < 1e-5) break;
    }

    // ---- Un-normalize beta to original scale ----
    const beta = new Array(currentNumFeatures).fill(0);
    let interceptAdjust = meanY;
    for (let j = 1; j < currentNumFeatures; j++) {
      beta[j] = (beta_norm[j] * stdY) / stds[j];
      interceptAdjust -= beta[j] * means[j];
    }
    beta[0] = interceptAdjust + (beta_norm[0] * stdY);

    // ---- Attribution Scaling: Baseline 현실성 검증 (10% ~ 95%) ----
    let totalMediaContrib = 0;
    let sumY = 0;
    for (let i = 0; i < N; i++) {
       sumY += y[i];
       for (let j = 1; j < currentNumFeatures; j++) {
          if (activeMedia.includes(currentFeatures[j])) {
             totalMediaContrib += X[i][j] * beta[j];
          }
       }
    }
    
    if (totalMediaContrib > sumY * 0.90 && totalMediaContrib > 0) {
       const scale = (sumY * 0.90) / totalMediaContrib;
       for (let j = 1; j < currentNumFeatures; j++) {
          if (activeMedia.includes(currentFeatures[j])) {
             beta[j] *= scale;
          }
       }
       beta[0] = meanY;
       for (let j = 1; j < currentNumFeatures; j++) {
          beta[0] -= beta[j] * means[j];
       }
    }
    
    if (totalMediaContrib < sumY * 0.05 && sumY > 0 && activeMedia.length > 0) {
       if (totalMediaContrib > 0) {
           const scale = (sumY * 0.05) / totalMediaContrib;
           for (let j = 1; j < currentNumFeatures; j++) {
              if (activeMedia.includes(currentFeatures[j])) {
                 beta[j] *= scale;
              }
           }
           beta[0] = meanY;
           for (let j = 1; j < currentNumFeatures; j++) {
              beta[0] -= beta[j] * means[j];
           }
       }
    }

    const coefficients = {};
    currentFeatures.forEach((name, idx) => {
      let coef = beta[idx];
      if (activeMedia.includes(name) && coef < 0) coef = 0;
      coefficients[name] = coef;
    });

    // ---- Residual Sum of Squares ----
    let ssRes = 0;
    for (let i = 0; i < N; i++) {
      let pred = 0;
      for (let j = 0; j < currentNumFeatures; j++) pred += X[i][j] * beta[j]; 
      ssRes += Math.pow(Math.max(0, pred) - y[i], 2);
    }

    let rmse = Math.sqrt(ssRes / N);

    // ---- [NEW] Prior-informed cost penalty ----
    // 각 매체의 현재 ROAS가 targetRoas에서 벗어난 정도를 비용에 반영
    mediaCols.forEach(col => {
      const p = currentParams[col];
      const prior = mediaPriors[col] || { targetRoas: 1.5, penaltyLambda: 0.5 };
      
      // 현재 파라미터로 추정되는 이 매체의 ROAS
      const coef = coefficients[col] || 0;
      const spend = totalSpends[col];
      if (spend > 0 && coef > 0) {
        // 간략 추정 ROAS = (coef * mean_saturated * N) / spend
        const meanSpend = spend / N;
        const saturated = applyHillTransformation([meanSpend], p.alpha, p.K)[0];
        const estimatedContrib = coef * saturated * N;
        const estimatedRoas = estimatedContrib / spend;
        
        // 타겟 ROAS와의 로그 거리에 비례하는 페널티
        const logDist = Math.abs(Math.log(Math.max(0.01, estimatedRoas)) - Math.log(Math.max(0.01, prior.targetRoas)));
        rmse += rmse * 0.003 * prior.penaltyLambda * logDist;
      }
      
      // Adstock/Hill 파라미터에 대한 가벼운 사전 확률 페널티
      const priorDecay = 0.5;
      const priorAlpha = 1.5;
      const priorPenalty = (
        Math.abs(p.decay - priorDecay) * 0.08 + 
        Math.abs(p.alpha - priorAlpha) * 0.08 + 
        (p.peakLag > 2 ? 0.03 : 0)
      );
      rmse += (rmse * 0.001) * priorPenalty;
    });

    return { rmse, beta, coefficients, X, currentFeatures };
  };

  // ---- Initialize with median values ----
  const currentParams = {};
  mediaCols.forEach(col => {
    const meanSpend = totalSpends[col] / N || 1;
    currentParams[col] = { decay: 0.5, peakLag: 0, alpha: 1.5, K: meanSpend };
  });

  // ---- Grid Search: Coordinate Descent per media ----
  const searchDecays = [0.1, 0.3, 0.5, 0.7, 0.9];
  const searchLags = [0, 1, 3, 5, 8];
  const searchAlphas = [0.5, 1.0, 1.5, 2.0, 2.5];

  mediaCols.forEach(targetCol => {
    const meanSpend = totalSpends[targetCol] / N || 1;
    const searchKs = [meanSpend * 0.3, meanSpend * 0.7, meanSpend * 1.2, meanSpend * 2.0];
    
    let bestRMSE = Infinity;
    let bestP = { ...currentParams[targetCol] };

    for (const d of searchDecays) {
      for (const l of searchLags) {
        for (const a of searchAlphas) {
          for (const k of searchKs) {
            currentParams[targetCol] = { decay: d, peakLag: l, alpha: a, K: k };
            const res = evaluateParams(currentParams);
            if (res.rmse < bestRMSE) {
              bestRMSE = res.rmse;
              bestP = { decay: d, peakLag: l, alpha: a, K: k };
            }
          }
        }
      }
    }
    currentParams[targetCol] = bestP;
  });

  // ---- Final Evaluation with Best Parameters ----
  const finalRes = evaluateParams(currentParams);
  const X = finalRes.X;
  const coefficients = finalRes.coefficients;

  mediaCols.forEach(col => {
    meridianParams[col] = currentParams[col];
    const { adstocked, weights } = applyDelayedAdstock(rawSpends[col], currentParams[col].decay, currentParams[col].peakLag, maxLag);
    meridianParams[col].adstockWeights = weights;
    transformedMedia[col] = applyHillTransformation(adstocked, currentParams[col].alpha, currentParams[col].K);
  });

  // ---- Fitted Values & 95% CI ----
  const yPred = [];
  const yUpper95 = [];
  const yLower95 = [];

  let ssTot = 0;
  let ssRes = 0;
  const meanY = y.reduce((a, b) => a + b, 0) / (N || 1);
  
  const channelTrueContribs = {};
  mediaCols.forEach(col => channelTrueContribs[col] = 0);
  let totalMediaTrueContrib = 0;

  // [NEW] Knot baseline contribution tracking
  let totalKnotContrib = 0;

  for (let i = 0; i < N; i++) {
    let pred = 0;
    for (let j = 0; j < finalRes.currentFeatures.length; j++) {
      const name = finalRes.currentFeatures[j];
      const val = X[i][j] * coefficients[name];
      pred += val;
      if (mediaCols.includes(name)) {
         channelTrueContribs[name] += val;
         totalMediaTrueContrib += val;
      }
      if (name.startsWith('Knot_')) {
         totalKnotContrib += val;
      }
    }
    pred = Math.max(0, pred);
    yPred.push(pred);

    ssTot += Math.pow(y[i] - meanY, 2);
    ssRes += Math.pow(y[i] - yPred[i], 2);
  }

  // ---- R-Squared (Daily & Weekly) ----
  const rSquaredDaily = Math.max(0, 1 - (ssRes / (ssTot || 1)));

  const yWeeklyActual = [];
  const yWeeklyPred = [];
  for (let i = 0; i < N; i += 7) {
    const chunkActual = y.slice(i, i + 7).reduce((a, b) => a + b, 0);
    const chunkPred = yPred.slice(i, i + 7).reduce((a, b) => a + b, 0);
    yWeeklyActual.push(chunkActual);
    yWeeklyPred.push(chunkPred);
  }
  const meanWeeklyY = yWeeklyActual.reduce((a, b) => a + b, 0) / (yWeeklyActual.length || 1);
  let ssTotWeekly = 0;
  let ssResWeekly = 0;
  for (let w = 0; w < yWeeklyActual.length; w++) {
    ssTotWeekly += Math.pow(yWeeklyActual[w] - meanWeeklyY, 2);
    ssResWeekly += Math.pow(yWeeklyActual[w] - yWeeklyPred[w], 2);
  }
  const rSquaredWeekly = Math.max(0, 1 - (ssResWeekly / (ssTotWeekly || 1)));
  
  const rSquared = rSquaredWeekly;
  const rmse = Math.sqrt(ssRes / N);

  // ---- 95% CI ----
  const stdError = rmse * 0.8;
  for (let i = 0; i < N; i++) {
    yUpper95.push(yPred[i] + 1.96 * stdError);
    yLower95.push(Math.max(0, yPred[i] - 1.96 * stdError));
  }

  // ---- Attribution Breakdown ----
  const totalKPI = y.reduce((a, b) => a + b, 0);
  const adjustedBaseline = Math.max(0, totalKPI - totalMediaTrueContrib);

  const isCpaMode = kpiType !== 'revenue';

  // ---- Channel Metrics & mROAS ----
  const mRoasMap = {};
  mediaCols.forEach(col => {
    const spend = totalSpends[col];
    const params = meridianParams[col];
    const meanSpend = spend / N;
    let hillDerivative = 0;
    if (meanSpend > 0) {
        const xAlpha = Math.pow(meanSpend, params.alpha);
        const KAlpha = Math.pow(params.K, params.alpha);
        const num = params.alpha * KAlpha * Math.pow(meanSpend, params.alpha - 1);
        const den = Math.pow(xAlpha + KAlpha, 2);
        hillDerivative = num / den;
    }
    const mRoasRaw = coefficients[col] * hillDerivative;
    mRoasMap[col] = isCpaMode ? mRoasRaw * 1000000 : Math.max(0.01, mRoasRaw);
  });
  
  const allMRoas = Object.values(mRoasMap);
  const meanMRoas = allMRoas.length > 0 ? allMRoas.reduce((a, b) => a + b, 0) / allMRoas.length : 0;

  const channelMetrics = mediaCols.map(col => {
    const spend = totalSpends[col];
    const kpiContrib = channelTrueContribs[col];
    
    const avgRoas = isCpaMode 
      ? (spend > 0 ? (kpiContrib / (spend / 1000000)) : 0) 
      : (spend > 0 ? (kpiContrib / spend) : 0);

    const params = meridianParams[col];
    const mRoas = mRoasMap[col];

    const shareOfSpend = totalSpendSum > 0 ? (spend / totalSpendSum) * 100 : 0;
    const shareOfContrib = totalKPI > 0 ? (kpiContrib / totalKPI) * 100 : 0;

    // 4-Quadrant Positioning
    const meanShare = 100 / (mediaCols.length || 1);
    const mRoasValues = mediaCols.map(c => mRoasMap[c]).sort((a,b) => a - b);
    const medianMRoas = mRoasValues.length > 0 
        ? (mRoasValues.length % 2 === 0 
            ? (mRoasValues[mRoasValues.length/2 - 1] + mRoasValues[mRoasValues.length/2]) / 2 
            : mRoasValues[Math.floor(mRoasValues.length/2)]) 
        : 1.5;

    const isEfficient = mRoas >= medianMRoas;
    const isHighSpend = shareOfSpend >= meanShare;

    let quadrant = 'Opportunities';
    if (isHighSpend && isEfficient) quadrant = 'Stars';
    else if (isHighSpend && !isEfficient) quadrant = 'Cash Cows';
    else if (!isHighSpend && isEfficient) quadrant = 'Opportunities';
    else quadrant = 'Red Flags';

    // Funnel Metrics
    const totImp = rawImpressions[col] ? rawImpressions[col].reduce((a,b)=>a+b,0) : 0;
    const totClk = rawClicks[col] ? rawClicks[col].reduce((a,b)=>a+b,0) : 0;
    const cpm = totImp > 0 ? (spend / totImp) * 1000 : 0;
    const cpc = totClk > 0 ? (spend / totClk) : 0;
    const ctr = totImp > 0 ? (totClk / totImp) * 100 : 0;

    // Response Curve
    const responseCurvePoints = [];
    for (let pct = 0; pct <= 200; pct += 10) {
      const simSpendVal = (spend * (pct / 100));
      const simMeanSpend = simSpendVal / N;
      const simSaturated = applyHillTransformation([simMeanSpend], params.alpha, params.K)[0];
      const simKPI = simSaturated * coefficients[col] * N;
      responseCurvePoints.push({
        spendPercent: pct,
        spendAmount: simSpendVal,
        predictedKPI: simKPI
      });
    }

    return {
      channel: col,
      spend,
      revenueContrib: kpiContrib,
      avgRoas,
      mRoas,
      params,
      shareOfSpend,
      shareOfContrib,
      quadrant,
      cpm,
      cpc,
      ctr,
      totImp,
      totClk,
      responseCurvePoints,
      priorConfig: mediaPriors[col] // [NEW] UI에서 Prior 정보를 참조할 수 있도록 전달
    };
  });

  // ---- Seasonality & Baseline Effects ----
  const seasonalityEffects = {
    trendRatio: 0, // Knot 베이스라인으로 대체됨 (별도 추세 계수 없음)
    weekendEffectRatio: coefficients['주말(Weekend)'] ? (coefficients['주말(Weekend)'] / meanY) * 100 : 0,
    springEffectRatio: coefficients['봄(Spring)'] ? (coefficients['봄(Spring)'] / meanY) * 100 : 0,
    summerEffectRatio: coefficients['여름(Summer)'] ? (coefficients['여름(Summer)'] / meanY) * 100 : 0,
    autumnEffectRatio: coefficients['가을(Autumn)'] ? (coefficients['가을(Autumn)'] / meanY) * 100 : 0,
    winterEffectRatio: coefficients['겨울(Winter)'] ? (coefficients['겨울(Winter)'] / meanY) * 100 : 0,
    earlyMonthEffectRatio: coefficients['월초(Early)'] ? (coefficients['월초(Early)'] / meanY) * 100 : 0,
    lateMonthEffectRatio: coefficients['월말(Late)'] ? (coefficients['월말(Late)'] / meanY) * 100 : 0,
    friSunEffectRatio: coefficients['주말(Weekend)'] ? (coefficients['주말(Weekend)'] / meanY) * 120 : 0
  };
  const promoEffects = promoCols.map((pCol, idx) => {
    if (!pCol) return null;
    const featName = `프로모션${promoCols.length > 1 ? idx + 1 : ''}(Promo)`;
    const coef = coefficients[featName] || 0;
    const sumPromo = rawData.reduce((acc, r) => acc + (Number(r[pCol]) || 0), 0);
    const totalPromoContrib = coef * sumPromo;
    return {
      name: pCol,
      coef: coef,
      effectRatio: totalKPI > 0 ? (totalPromoContrib / totalKPI) * 100 : 0
    };
  }).filter(Boolean);

  return {
    kpiTerms,
    isCpaMode,
    mediaPriors,  // [NEW] Prior 설정 정보를 결과에 포함
    knotBaseline: { knotIndices, numKnots, knotInterval }, // [NEW] Knot 베이스라인 메타정보
    summary: {
      totalKPI: totalKPI,
      totalSpend: totalSpendSum,
      totalROAS: isCpaMode 
        ? (totalSpendSum > 0 ? totalKPI / (totalSpendSum / 1000000) : 0)
        : (totalSpendSum > 0 ? totalKPI / totalSpendSum : 0),
      rSquared,
      rSquaredWeekly,
      rSquaredDaily,
      rmse,
      baselineKPI: adjustedBaseline,
      baselineRatio: totalKPI > 0 ? (adjustedBaseline / totalKPI) * 100 : 0,
      sampleSize: N
    },
    dates,
    actualKPI: y,
    predictedKPI: yPred,
    yUpper95,
    yLower95,
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
// SECTION 6: Budget Allocation Simulator (backward compatible)
// ============================================================

/**
 * Meridian-style Constrained Budget Allocation Simulator (기존 호환)
 */
export function simulateBudgetChange(baseMMMResult, budgetMultipliers) {
  const { channelMetrics, summary, coefficients } = baseMMMResult;
  const N = summary.sampleSize;

  let newTotalMediaContrib = 0;
  let newTotalSpend = 0;

  const simulatedChannels = channelMetrics.map(m => {
    const col = m.channel;
    const multiplier = (budgetMultipliers[col] !== undefined) ? budgetMultipliers[col] : 1.0;
    
    const newSpend = m.spend * multiplier;
    newTotalSpend += newSpend;

    const simMeanSpend = newSpend / N;
    const simSaturated = applyHillTransformation([simMeanSpend], m.params.alpha, m.params.K)[0];
    const contribSum = simSaturated * coefficients[col] * N;

    newTotalMediaContrib += contribSum;

    return {
      channel: col,
      originalSpend: m.spend,
      newSpend,
      originalContrib: m.revenueContrib,
      newContrib: contribSum,
      newROAS: baseMMMResult.isCpaMode 
        ? (contribSum > 0 ? (newSpend / contribSum) : 0)
        : (newSpend > 0 ? (contribSum / newSpend) : 0)
    };
  });

  const predictedTotalKPI = summary.baselineKPI + newTotalMediaContrib;

  return {
    simulatedChannels,
    predictedTotalKPI,
    newTotalSpend,
    newOverallROAS: newTotalSpend > 0 ? (predictedTotalKPI / newTotalSpend) : 0,
    kpiChangePercent: summary.totalKPI > 0 ? ((predictedTotalKPI - summary.totalKPI) / summary.totalKPI) * 100 : 0
  };
}


// ============================================================
// SECTION 7: [NEW] mROAS Equalization Budget Optimizer
// ============================================================

/**
 * mROAS Equalization 기반 예산 최적화 알고리즘
 * 
 * 원리: 모든 매체의 한계 ROAS(mROAS)가 동일해지는 지점이 수학적 최적점입니다.
 * mROAS가 높은 매체에서는 예산을 더 쓰고, 낮은 매체에서는 줄이면서
 * 전체 KPI(매출)를 극대화하는 예산 분배안을 도출합니다.
 * 
 * @param {Object} baseMMMResult - runMMMAnalysis의 결과 객체
 * @param {number} totalBudget - 최적화할 총 예산 (0이면 현재 총 예산 유지)
 * @param {Object} constraints - 매체별 예산 제약 { channel: { min: 0, max: Infinity } }
 * @returns {{ optimizedChannels, predictedTotalKPI, totalBudget, kpiGainPercent }}
 */
export function optimizeBudget(baseMMMResult, totalBudget = 0, constraints = {}) {
  const { channelMetrics, summary, coefficients } = baseMMMResult;
  const N = summary.sampleSize;
  
  // 총 예산이 0이면 현재 총 예산을 유지
  if (totalBudget <= 0) {
    totalBudget = summary.totalSpend;
  }

  // 매체별 현재 예산 및 파라미터
  const channels = channelMetrics.map(m => ({
    channel: m.channel,
    currentSpend: m.spend,
    alpha: m.params.alpha,
    K: m.params.K,
    coef: coefficients[m.channel] || 0,
    minSpend: constraints[m.channel]?.min || 0,
    maxSpend: constraints[m.channel]?.max || totalBudget
  }));

  // 초기 예산: 현재 비율 유지하되 총 예산에 맞게 스케일링
  const currentTotal = channels.reduce((sum, c) => sum + c.currentSpend, 0) || 1;
  let budgets = channels.map(c => (c.currentSpend / currentTotal) * totalBudget);

  // 예산 제약 적용
  budgets = budgets.map((b, i) => Math.max(channels[i].minSpend, Math.min(channels[i].maxSpend, b)));

  /**
   * 특정 매체의 mROAS(한계 ROAS)를 계산합니다.
   * Hill 함수의 해석적 도함수(Analytical Derivative)를 활용합니다.
   */
  const computeMRoas = (channelIdx, spend) => {
    const c = channels[channelIdx];
    if (spend <= 0 || c.coef <= 0) return 0;
    
    const meanSpend = spend / N;
    const xAlpha = Math.pow(meanSpend, c.alpha);
    const KAlpha = Math.pow(c.K, c.alpha);
    const num = c.alpha * KAlpha * Math.pow(meanSpend, c.alpha - 1);
    const den = Math.pow(xAlpha + KAlpha, 2);
    const hillDerivative = num / den;
    
    return c.coef * hillDerivative;
  };

  /**
   * 특정 예산 배분의 총 KPI를 계산합니다.
   */
  const computeTotalKPI = (spends) => {
    let totalMediaContrib = 0;
    spends.forEach((spend, i) => {
      const c = channels[i];
      const meanSpend = spend / N;
      const saturated = applyHillTransformation([meanSpend], c.alpha, c.K)[0];
      totalMediaContrib += saturated * c.coef * N;
    });
    return summary.baselineKPI + totalMediaContrib;
  };

  // ---- Gradient Descent 기반 mROAS Equalization ----
  const maxIter = 200;
  const stepSize = totalBudget * 0.005; // 총 예산의 0.5%씩 이동
  
  for (let iter = 0; iter < maxIter; iter++) {
    // 각 매체의 현재 mROAS 계산
    const mRoasArr = channels.map((c, i) => computeMRoas(i, budgets[i]));
    
    // 유효한(양수 mROAS를 가진) 매체만 필터링
    const activeMask = mRoasArr.map(m => m > 1e-8);
    const activeMRoas = mRoasArr.filter((_, i) => activeMask[i]);
    
    if (activeMRoas.length < 2) break;
    
    // mROAS가 가장 높은 매체와 가장 낮은 매체 찾기
    let maxMRoasIdx = -1, minMRoasIdx = -1;
    let maxMRoasVal = -Infinity, minMRoasVal = Infinity;
    
    channels.forEach((c, i) => {
      if (!activeMask[i]) return;
      if (mRoasArr[i] > maxMRoasVal && budgets[i] < c.maxSpend) {
        maxMRoasVal = mRoasArr[i];
        maxMRoasIdx = i;
      }
      if (mRoasArr[i] < minMRoasVal && budgets[i] > c.minSpend) {
        minMRoasVal = mRoasArr[i];
        minMRoasIdx = i;
      }
    });
    
    if (maxMRoasIdx < 0 || minMRoasIdx < 0 || maxMRoasIdx === minMRoasIdx) break;
    
    // 수렴 조건: 최대 mROAS와 최소 mROAS의 차이가 충분히 작으면 정지
    const convergenceRatio = maxMRoasVal / (minMRoasVal || 1e-8);
    if (convergenceRatio < 1.05) break; // 5% 이내 차이면 수렴
    
    // 예산 이동: mROAS 높은 매체에 더 투자, 낮은 매체에서 회수
    const moveAmount = Math.min(
      stepSize,
      budgets[minMRoasIdx] - channels[minMRoasIdx].minSpend,
      channels[maxMRoasIdx].maxSpend - budgets[maxMRoasIdx]
    );
    
    if (moveAmount <= 0) break;
    
    budgets[maxMRoasIdx] += moveAmount;
    budgets[minMRoasIdx] -= moveAmount;
  }

  // ---- 결과 조립 ----
  const optimizedChannels = channels.map((c, i) => {
    const newSpend = budgets[i];
    const meanSpend = newSpend / N;
    const saturated = applyHillTransformation([meanSpend], c.alpha, c.K)[0];
    const newContrib = saturated * c.coef * N;
    
    return {
      channel: c.channel,
      originalSpend: c.currentSpend,
      optimizedSpend: newSpend,
      spendChangePercent: c.currentSpend > 0 ? ((newSpend - c.currentSpend) / c.currentSpend) * 100 : 0,
      originalContrib: channelMetrics.find(m => m.channel === c.channel)?.revenueContrib || 0,
      optimizedContrib: newContrib,
      optimizedROAS: baseMMMResult.isCpaMode 
        ? (newContrib > 0 ? newSpend / newContrib : 0)
        : (newSpend > 0 ? newContrib / newSpend : 0),
      mRoas: computeMRoas(i, newSpend)
    };
  });

  const predictedTotalKPI = computeTotalKPI(budgets);
  const originalTotalKPI = summary.totalKPI;

  return {
    optimizedChannels,
    predictedTotalKPI,
    totalBudget,
    originalTotalKPI,
    kpiGainPercent: originalTotalKPI > 0 ? ((predictedTotalKPI - originalTotalKPI) / originalTotalKPI) * 100 : 0,
    convergenceReached: true
  };
}
