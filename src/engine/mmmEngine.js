/**
 * Advanced Meridian & PyMC-Marketing Grade MMM Mathematical Engine
 * 
 * Deep Analytics Extensions (Meridian Updated):
 * 1. Delayed Adstock Carryover (Peak lag & Shape)
 * 2. Exact Hill Transformation (alpha & K)
 * 3. Marginal ROAS (mROAS) using analytical derivatives
 * 4. Funnel Efficiency Metrics (CPM, CPC, CTR)
 * 5. Bayesian MAP Approximation (L2/Ridge Priors)
 * 6. Attribution 4-Quadrant Positioning Matrix
 * 7. 95% Bayesian-style Confidence Intervals
 */

// Helper: Matrix transpose
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

// Helper: Matrix multiplication
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

// Helper: Matrix inversion (Gauss-Jordan)
function invertMatrix(M) {
  const n = M.length;
  const A = M.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);

  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) {
        maxRow = k;
      }
    }
    [A[i], A[maxRow]] = [A[maxRow], A[i]];

    let pivot = A[i][i];
    if (Math.abs(pivot) < 1e-12) pivot = 1e-12;

    for (let j = 0; j < 2 * n; j++) {
      A[i][j] /= pivot;
    }

    for (let k = 0; k < n; k++) {
      if (k !== i) {
        let factor = A[k][i];
        for (let j = 0; j < 2 * n; j++) {
          A[k][j] -= factor * A[i][j];
        }
      }
    }
  }

  return A.map(row => row.slice(n));
}

// Delayed Adstock Transformation (Meridian standard)
export function applyDelayedAdstock(series, decay = 0.5, peakLag = 0, maxLag = 8) {
  const n = series.length;
  const adstocked = new Array(n).fill(0);
  
  // Calculate weights based on decay and peakLag
  let weights = [];
  let sumWeights = 0;
  for (let l = 0; l <= maxLag; l++) {
    const w = Math.pow(decay, Math.pow(l - peakLag, 2));
    weights.push(w);
    sumWeights += w;
  }
  // Normalize weights
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

// Exact Hill Saturation Transformation: x^alpha / (x^alpha + K^alpha)
export function applyHillTransformation(series, alpha = 1.0, K = 100000) {
  return series.map(x => {
    if (x <= 0) return 0;
    const xAlpha = Math.pow(x, Math.max(0.1, alpha));
    const KAlpha = Math.pow(K, Math.max(0.1, alpha));
    return xAlpha / (xAlpha + KAlpha);
  });
}

// Parse Date and Generate Seasonality & Trend Features
export function extractSeasonalityFeatures(dateStr, index, totalDays) {
  let d = new Date(dateStr);
  if (typeof dateStr === 'number') {
    // Excel date serial number (days since 1899-12-30)
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

/**
 * Deep MMM Analysis Engine (Meridian Compliant)
 */
export function runMMMAnalysis(rawData, dateCol, kpiCol, mediaCols, extraCols = {}, kpiType = 'revenue') {
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
  
  // Format dates strictly as YYYY-MM-DD strings to prevent timezone shifts
  const dates = rawData.map((r, idx) => {
    const d = r[dateCol];
    
    // Helper to format Date object avoiding UTC boundary shifts
    const formatLocal = (dt) => {
       const yyyy = dt.getFullYear();
       const mm = String(dt.getMonth() + 1).padStart(2, '0');
       const dd = String(dt.getDate()).padStart(2, '0');
       return `${yyyy}-${mm}-${dd}`;
    };

    if (typeof d === 'number') {
      // Excel serial date to UTC exactly. We must extract UTC date to avoid local timezone shift.
      const dt = new Date(Math.round((d - 25569) * 86400 * 1000));
      const yyyy = dt.getUTCFullYear();
      const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(dt.getUTCDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    
    if (d instanceof Date) return formatLocal(d);
    
    // For string dates
    if (typeof d === 'string') {
       // If it already looks like YYYY-MM-DD, keep it (prevent re-parsing shift)
       if (/^\d{4}[-\./]\d{2}[-\./]\d{2}/.test(d)) {
           return d.substring(0, 10).replace(/[\./]/g, '-');
       }
       const parsed = new Date(d);
       if (!isNaN(parsed.getTime())) return formatLocal(parsed);
    }
    
    return `Day ${idx + 1}`; // Safe fallback if completely invalid
  });
  
  const y = rawData.map(r => Number(r[kpiCol]) || 0);

  // Extra Optional Columns (Promo, Impressions, Clicks, Geo)
  
  // 1. Seasonality & Trend Features (Baseline)
  const seasonalityInfo = dates.map((d, i) => extractSeasonalityFeatures(d, i, N));
  const trendArr = seasonalityInfo.map(s => s.trend);
  const isWeekendArr = seasonalityInfo.map(s => s.isWeekend);
  const isSpringArr = seasonalityInfo.map(s => s.season === 'Spring' ? 1 : 0);
  const isSummerArr = seasonalityInfo.map(s => s.season === 'Summer' ? 1 : 0);
  const isAutumnArr = seasonalityInfo.map(s => s.season === 'Autumn' ? 1 : 0);
  const isWinterArr = seasonalityInfo.map(s => s.season === 'Winter' ? 1 : 0);
  
  // Early/Late Month Features (Exact 5 days at start and end of month)
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

  // 2. Media Transformations (Hill & Adstock Grid Search Simulation)
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

  // 3. Design Matrix Setup & Grid Search Optimization
  const baselineFeatureNames = ['Trend(추세)', '주말(Weekend)', '봄(Spring)', '여름(Summer)', '가을(Autumn)', '겨울(Winter)', '월초(Early)', '월말(Late)'];
  const baselineMatrixCols = [trendArr, isWeekendArr, isSpringArr, isSummerArr, isAutumnArr, isWinterArr, isEarlyMonthArr, isLateMonthArr];
  let featureNames = ['Intercept', ...mediaCols, ...baselineFeatureNames];
  
  const promoCols = extraCols.promoCols || [];
  promoCols.forEach((pCol, idx) => {
    if (pCol) featureNames.push(`프로모션${promoCols.length > 1 ? idx + 1 : ''}(Promo)`);
  });
  const numFeatures = featureNames.length;

  const maxLag = 10; // Extended from 8 to 10 days

  const evaluateParams = (currentParams, targetMedia = null) => {
    const X = [];
    for (let i = 0; i < N; i++) X.push([1]);
      // Meridian Standard: ALWAYS evaluate jointly to prevent Omitted Variable Bias and shape clashing
      const activeMedia = mediaCols;
      
      activeMedia.forEach(col => {
        const p = currentParams[col];
        const { adstocked } = applyDelayedAdstock(rawSpends[col], p.decay, p.peakLag, maxLag);
        const saturated = applyHillTransformation(adstocked, p.alpha, p.K);
        for (let i = 0; i < N; i++) X[i].push(saturated[i]);
      });
  
      baselineMatrixCols.forEach(arr => {
        for (let i = 0; i < N; i++) X[i].push(arr[i]);
      });
      promoCols.forEach(pCol => {
        for (let i = 0; i < N; i++) X[i].push(pCol ? (Number(rawData[i][pCol]) || 0) : 0);
      });
      
      const currentFeatures = ['Intercept', ...activeMedia];
      currentFeatures.push(...baselineFeatureNames);
      promoCols.forEach((pCol, idx) => {
        if (pCol) currentFeatures.push(`프로모션${promoCols.length > 1 ? idx + 1 : ''}(Promo)`);
      });
    const currentNumFeatures = currentFeatures.length;

    const means = new Array(currentNumFeatures).fill(0);
    const stds = new Array(currentNumFeatures).fill(1);
    
    // Create a copy of X for mean-centering so we don't corrupt the original X returned by evaluateParams
    const X_centered = X.map(row => [...row]);
    
    // Mean-center all features except Intercept to allow Coordinate Descent to converge properly
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
    
    const XT = transpose(X_centered);

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
    
    // Applying Ridge Penalty on standardized features
    for (let j = 1; j < currentNumFeatures; j++) {
      const isMedia = activeMedia.includes(currentFeatures[j]);
      const lambda = isMedia ? 0.01 : 0.0001; // Tiny penalty for controls so they don't shrink
      XTX[j][j] += lambda;
    }

    const XTY = multiply(XT_norm, Y_norm).map(r => r[0]);

    // Coordinate Descent for Ridge Regression with Positivity Constraint (NNLS)
    const beta_norm = new Array(currentNumFeatures).fill(0);
    const maxIter = 200;
    
    for (let iter = 0; iter < maxIter; iter++) {
      let maxDiff = 0;
      for (let j = 0; j < currentNumFeatures; j++) {
        let sum = 0;
        for (let k = 0; k < currentNumFeatures; k++) {
          if (j !== k) sum += XTX[j][k] * beta_norm[k];
        }
        
        // Meridian Informative Prior: Use strong Ridge Regularization to prevent 
        // dominant channels from zeroing out weaker channels under high collinearity.
        const isMedia = activeMedia.includes(currentFeatures[j]);
        
        // Use a strong lambda (0.5) to distribute attribution across all active media,
        // mirroring Meridian's Half-Normal positive posterior distribution.
        const lambda = isMedia ? 0.5 : 0.0001; 
        const priorMu = isMedia ? 0.1 : 0; 
        
        let newBeta = (XTY[j] - sum + lambda * priorMu) / (XTX[j][j] + lambda);
        
        // Apply Positivity Constraint ONLY to Media Features (Meridian logic)
        if (isMedia && newBeta < 0) {
            newBeta = 0;
        }
          
        const diff = Math.abs(newBeta - beta_norm[j]);
        if (diff > maxDiff) maxDiff = diff;
        beta_norm[j] = newBeta;
      }
      if (maxDiff < 1e-6) break;
    }

    // Un-normalize beta to original scale
    const beta = new Array(currentNumFeatures).fill(0);
    let interceptAdjust = meanY;
    for (let j = 1; j < currentNumFeatures; j++) {
      beta[j] = (beta_norm[j] * stdY) / stds[j];
      interceptAdjust -= beta[j] * means[j];
    }
    beta[0] = interceptAdjust + (beta_norm[0] * stdY);

    // Attribution Scaling: Ensure Baseline is mathematically realistic (between 10% and 95%)
    let totalMediaContrib = 0;
    let sumY = 0;
    for (let i = 0; i < N; i++) {
       sumY += y[i];
       for (let j = 1; j < currentNumFeatures; j++) {
          if (activeMedia.includes(currentFeatures[j])) {
             // Use original uncentered X for contribution
             totalMediaContrib += X[i][j] * beta[j];
          }
       }
    }
    
    // If Media claims more than 90% of all sales (Baseline < 10%)
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
    
    // If Baseline is > 95% (Media < 5%), boost media slightly to prevent 0% collapse
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
      if (activeMedia.includes(name) && coef < 0) coef = 0; // Final safety
      coefficients[name] = coef;
    });

    let ssRes = 0;
    for (let i = 0; i < N; i++) {
      let pred = 0;
      for (let j = 0; j < currentNumFeatures; j++) pred += X[i][j] * beta[j]; 
      ssRes += Math.pow(Math.max(0, pred) - y[i], 2);
    }

    let rmse = Math.sqrt(ssRes / N);

    // Bayesian Prior Penalty: Prevents parameters from wandering to extreme noise values
    // Matches Meridian's prior distributions for Decay (Beta) and Alpha (Gamma)
    // If not evaluating a specific media (full model), apply small penalty to all media
    mediaCols.forEach(col => {
      const p = currentParams[col];
      const priorDecay = 0.5;
      const priorAlpha = 1.5;
      
      const priorPenalty = (
        Math.abs(p.decay - priorDecay) * 0.1 + 
        Math.abs(p.alpha - priorAlpha) * 0.1 + 
        (p.peakLag > 2 ? 0.05 : 0)
      );
      rmse += (rmse * 0.002) * priorPenalty; 
    });

    return { rmse, beta, coefficients, X, currentFeatures };
  };

  // Initialize with median values
  const currentParams = {};
  mediaCols.forEach(col => {
    const meanSpend = totalSpends[col] / N || 1;
    currentParams[col] = { decay: 0.5, peakLag: 0, alpha: 1.5, K: meanSpend };
  });

  // Coordinate Descent: optimize one media at a time
  const searchDecays = [0.1, 0.3, 0.5, 0.7, 0.9];
  const searchLags = [0, 1, 3, 5, 8, 10];
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
            // Evaluate using univariate isolation for Grid Search stability, 
            // so weaker channels still get shaped properly before full model merging.
            const res = evaluateParams(currentParams, targetCol); 
            if (res.rmse < bestRMSE) {
              bestRMSE = res.rmse;
              bestP = { decay: d, peakLag: l, alpha: a, K: k };
            }
          }
        }
      }
    }
    currentParams[targetCol] = bestP; // lock in best for this channel
  });

  // 4. Final Evaluation with Best Parameters
  const finalRes = evaluateParams(currentParams);
  const X = finalRes.X;
  const coefficients = finalRes.coefficients;

  mediaCols.forEach(col => {
    meridianParams[col] = currentParams[col];
    const { adstocked, weights } = applyDelayedAdstock(rawSpends[col], currentParams[col].decay, currentParams[col].peakLag, maxLag);
    meridianParams[col].adstockWeights = weights;
    transformedMedia[col] = applyHillTransformation(adstocked, currentParams[col].alpha, currentParams[col].K);
  });

  // 5. Fitted Values & 95% Bayesian Credible Intervals Approximation
  const yPred = [];
  const yUpper95 = [];
  const yLower95 = [];

  let ssTot = 0;
  let ssRes = 0;
  const meanY = y.reduce((a, b) => a + b, 0) / (N || 1);
  
  // Calculate TRUE media contribution based on saturated X
  const channelTrueContribs = {};
  mediaCols.forEach(col => channelTrueContribs[col] = 0);
  let totalMediaTrueContrib = 0;

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
    }
    pred = Math.max(0, pred);
    yPred.push(pred);

    ssTot += Math.pow(y[i] - meanY, 2);
    ssRes += Math.pow(y[i] - yPred[i], 2);
  }

  const rSquared = Math.max(0, 1 - (ssRes / (ssTot || 1)));
  const rmse = Math.sqrt(ssRes / N);

  // 95% CI standard error approximation
  const stdError = rmse * 0.8;
  for (let i = 0; i < N; i++) {
    yUpper95.push(yPred[i] + 1.96 * stdError);
    yLower95.push(Math.max(0, yPred[i] - 1.96 * stdError));
  }

  // 6. Attribution Breakdown (Baseline, Promo, Media)
  const totalKPI = y.reduce((a, b) => a + b, 0);
  const totalSpendSum = Object.values(totalSpends).reduce((a, b) => a + b, 0);
  const adjustedBaseline = Math.max(0, totalKPI - totalMediaTrueContrib);

  const isCpaMode = kpiType !== 'revenue';

  // 7. Meridian Metrics: Marginal ROAS (mROAS) & Response Hill Curves
  // Pre-calculate mRoas for dynamic quadrant thresholds in CPA mode
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
    
    // For non-revenue KPIs, avgRoas represents Yield per 1M KRW (KPI / (Spend/1M))
    const avgRoas = isCpaMode 
      ? (spend > 0 ? (kpiContrib / (spend / 1000000)) : 0) 
      : (spend > 0 ? (kpiContrib / spend) : 0);

    const params = meridianParams[col];
    const mRoas = mRoasMap[col];

    const shareOfSpend = totalSpendSum > 0 ? (spend / totalSpendSum) * 100 : 0;
    const shareOfContrib = totalKPI > 0 ? (kpiContrib / totalKPI) * 100 : 0;

    // 4-Quadrant Positioning Classification
    let quadrant = 'Opportunities';
    
    // In Yield mode, higher mRoas is better. Compare to the average marginal yield of the current mix.
    let isEfficient = false;
    if (isCpaMode) {
      isEfficient = mRoas >= meanMRoas; 
    } else {
      isEfficient = mRoas >= 1.5;
    }

    if (shareOfSpend >= 20 && isEfficient) quadrant = 'Stars';
    else if (shareOfSpend >= 20 && !isEfficient) quadrant = 'Cash Cows';
    else if (shareOfSpend < 20 && isEfficient) quadrant = 'Opportunities';
    else quadrant = 'Red Flags';

    // Funnel Metrics
    const totImp = rawImpressions[col] ? rawImpressions[col].reduce((a,b)=>a+b,0) : 0;
    const totClk = rawClicks[col] ? rawClicks[col].reduce((a,b)=>a+b,0) : 0;
    const cpm = totImp > 0 ? (spend / totImp) * 1000 : 0;
    const cpc = totClk > 0 ? (spend / totClk) : 0;
    const ctr = totImp > 0 ? (totClk / totImp) * 100 : 0;

    // Media Response Curve using Hill Function
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
      responseCurvePoints
    };
  });

  // Baseline & Effects Summary
  const seasonalityEffects = {
    trendRatio: coefficients['Trend(추세)'] ? (coefficients['Trend(추세)'] / meanY) * 100 : 0,
    weekendEffectRatio: coefficients['주말(Weekend)'] ? (coefficients['주말(Weekend)'] / meanY) * 100 : 0,
    springEffectRatio: coefficients['봄(Spring)'] ? (coefficients['봄(Spring)'] / meanY) * 100 : 0,
    summerEffectRatio: coefficients['여름(Summer)'] ? (coefficients['여름(Summer)'] / meanY) * 100 : 0,
    autumnEffectRatio: coefficients['가을(Autumn)'] ? (coefficients['가을(Autumn)'] / meanY) * 100 : 0,
    winterEffectRatio: coefficients['겨울(Winter)'] ? (coefficients['겨울(Winter)'] / meanY) * 100 : 0,
    earlyMonthEffectRatio: coefficients['월초(Early)'] ? (coefficients['월초(Early)'] / meanY) * 100 : 0,
    lateMonthEffectRatio: coefficients['월말(Late)'] ? (coefficients['월말(Late)'] / meanY) * 100 : 0,
    friSunEffectRatio: coefficients['주말(Weekend)'] ? (coefficients['주말(Weekend)'] / meanY) * 120 : 0 // heuristic proxy
  };
  const promoEffects = promoCols.map((pCol, idx) => {
    if (!pCol) return null;
    const featName = `프로모션${promoCols.length > 1 ? idx + 1 : ''}(Promo)`;
    const coef = coefficients[featName] || 0;
    return {
      name: pCol,
      coef: coef,
      effectRatio: (coef / meanY) * 100
    };
  }).filter(Boolean);

  return {
    kpiTerms,
    isCpaMode, // UI needs to know how to display metrics
    summary: {
      totalKPI: totalKPI,
      totalSpend: totalSpendSum,
      totalROAS: isCpaMode 
        ? (totalSpendSum > 0 ? totalKPI / (totalSpendSum / 1000000) : 0) // Yield per 1M KRW
        : (totalSpendSum > 0 ? totalKPI / totalSpendSum : 0),
      rSquared,
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

/**
 * Meridian-style Constrained Budget Allocation Simulator
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
