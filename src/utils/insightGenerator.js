import { optimizeBudget } from '../engine/bayesMmmEngine.js';

/**
 * 분석 결과(mmmResult)로 '쉬운 말' 인사이트를 만듭니다.
 * 모든 문장은 모델이 계산한 숫자(사후분포 평균·95% 구간·반응곡선)에서만 만들어집니다.
 *
 * 반환: { headline: string, insights: [{ id, icon, tone, title, text, lines: string[], hint }] }
 *   tone: 'good' | 'warn' | 'info'
 */

// ---------- 표기 헬퍼 ----------
const shortName = (ch) => {
  const s = String(ch);
  const m = s.match(/\((.*?)\)/);
  return m ? m[1] : (s.replace(/광고비|비용|spend|cost|_/gi, '').trim() || s);
};

// 한글/영문 단어 끝 받침 여부 (조사 선택용)
const hasBatchim = (word) => {
  const w = String(word).trim();
  const c = w.charCodeAt(w.length - 1);
  if (c >= 0xAC00 && c <= 0xD7A3) return (c - 0xAC00) % 28 !== 0;
  return /(le|l|m|n|k|p|t|b|g|ck)$/i.test(w); // Google, TikTok, Coupang → 받침 / Meta, Naver, Kakao → 없음
};
const eul = (w) => `${w}${hasBatchim(w) ? '을' : '를'}`;
const iga = (w) => `${w}${hasBatchim(w) ? '이' : '가'}`;
const ieyo = (w) => `${w}${hasBatchim(w) ? '이에요' : '예요'}`;

export function formatWonShort(v) {
  const n = Number(v) || 0;
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1e8) return `${sign}${(a / 1e8).toFixed(a >= 1e10 ? 0 : 1)}억 원`;
  if (a >= 1e4) return `${sign}${Math.round(a / 1e4).toLocaleString('ko-KR')}만 원`;
  return `${sign}${Math.round(a).toLocaleString('ko-KR')}원`;
}

const signedPct = (v, d = 0) => `${v >= 0 ? '+' : ''}${(Number(v) || 0).toFixed(d)}%`;
const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

const SEASON_KO = { Spring: '봄', Summer: '여름', Autumn: '가을', Winter: '겨울' };

// ---------- 메인 ----------
export function buildInsights(r) {
  const {
    channelMetrics = [], summary = {}, isCpaMode, kpiTerms = {}, seasonalityEffects = {},
    promoEffects = [], baselineSeries = [], modelInfo = {}
  } = r || {};
  const unit = kpiTerms.unit || '₩';
  const kpiName = kpiTerms.name || '매출액';
  const isRevenue = !isCpaMode;
  const fmtKpi = (v) => (unit === '₩' ? formatWonShort(v) : `${Math.round(Number(v) || 0).toLocaleString('ko-KR')}${unit}`);
  const fmtEff = (v) => (isRevenue ? `${(Number(v) || 0).toFixed(2)}x` : `${(Number(v) || 0).toFixed(1)}${unit}`);

  const totalMedia = summary.totalMediaContrib ?? channelMetrics.reduce((a, c) => a + (c.revenueContrib || 0), 0);
  const mediaShare = summary.totalKPI > 0 ? (totalMedia / summary.totalKPI) * 100 : 0;
  const insights = [];

  // 0) 한 줄 요약
  const headline = isRevenue
    ? `전체 ${kpiName} 중 ${mediaShare.toFixed(0)}%(${fmtKpi(totalMedia)})는 광고 덕분에 생겼고, 나머지 ${(100 - mediaShare).toFixed(0)}%는 광고가 없었어도 생겼을 몫이에요. 광고비 100만 원당 평균 ${formatWonShort((summary.mediaROAS || 0) * 1e6)}의 ${eul(kpiName)} 만들었어요 (ROAS ${(summary.mediaROAS || 0).toFixed(2)}x).`
    : `전체 ${kpiName} 중 ${mediaShare.toFixed(0)}%(${fmtKpi(totalMedia)})는 광고 덕분에 생겼고, 광고비 100만 원당 평균 ${fmtEff(summary.mediaROAS)}${hasBatchim(unit) ? '을' : '를'} 만들었어요.`;

  // 1) 배분만 바꾸면? (mROAS 균등화 최적화)
  if (channelMetrics.length >= 2) {
    try {
      const opt = optimizeBudget(r);
      const gain = opt.predictedTotalKPI - summary.totalKPI;
      const gainPct = opt.kpiGainPercent;
      const fmtMove = (c) => `${shortName(c.channel)}(${signedPct(c.spendChangePercent)})`;
      const ups = opt.optimizedChannels.filter(c => c.spendChangePercent > 5).sort((a, b) => b.spendChangePercent - a.spendChangePercent);
      const downs = opt.optimizedChannels.filter(c => c.spendChangePercent < -5).sort((a, b) => a.spendChangePercent - b.spendChangePercent);
      if (gainPct < 0.3) {
        insights.push({
          id: 'budget', icon: 'budget', tone: 'good', title: '배분만 바꾸면 더 벌 수 있을까?',
          text: `지금 매체별 배분이 이미 최적에 가까워요. 총 광고비를 그대로 두고 배분을 바꿔도 ${kpiName} 증가 폭이 0.3%가 안 돼요.`,
          lines: [],
          hint: '매체별로 지금의 0.5~2배 범위 안에서 계산했어요.'
        });
      } else {
        insights.push({
          id: 'budget', icon: 'budget', tone: 'good', title: '배분만 바꾸면 더 벌 수 있을까?',
          text: `총 광고비는 그대로 두고 매체별 배분만 바꾸면 ${iga(kpiName)} 약 ${fmtKpi(gain)}(${signedPct(gainPct, 1)}) 늘어날 수 있어요.`,
          lines: [
            ups.length ? `늘릴 곳: ${ups.map(fmtMove).join(', ')}` : null,
            downs.length ? `줄일 곳: ${downs.map(fmtMove).join(', ')}` : null
          ].filter(Boolean),
          hint: '분석 기간 전체 기준이고, 매체별로 지금의 0.5~2배 범위 안에서만 계산했어요. 한 번에 바꾸기보다 몇 주에 걸쳐 조금씩 옮기는 걸 권장해요.'
        });
      }
    } catch (e) { /* 최적화 실패 시 생략 */ }
  }

  // 2) 100만 원을 더 쓴다면?
  if (channelMetrics.length) {
    const sorted = [...channelMetrics].sort((a, b) => (b.mRoas || 0) - (a.mRoas || 0));
    insights.push({
      id: 'next', icon: 'next', tone: 'info', title: '광고비 100만 원을 더 쓴다면?',
      text: `지금 수준에서 100만 원을 추가로 쓸 때 늘어날 것으로 예상되는 ${ieyo(kpiName)}. 위에 있을수록 추가 예산을 넣기 좋은 매체예요.`,
      lines: sorted.map(c => `${shortName(c.channel)}: 약 ${isRevenue ? formatWonShort((c.mRoas || 0) * 1e6) : fmtEff(c.mRoas)}`),
      hint: isRevenue
        ? '100만 원보다 작게 나오면, 추가로 쓴 광고비만큼도 매출이 늘지 않는다는 뜻이에요.'
        : '이미 많이 쓰고 있는 매체일수록 추가 100만 원의 효과는 작아져요.'
    });
  }

  // 3) 쓴 돈 대비 일 잘하는 매체
  if (channelMetrics.length >= 2 && totalMedia > 0) {
    const rows = channelMetrics.map(c => ({ c, spendShare: c.shareOfSpend || 0, perfShare: ((c.revenueContrib || 0) / totalMedia) * 100 }));
    rows.forEach(x => { x.gap = x.perfShare - x.spendShare; });
    const best = rows.reduce((a, b) => (b.gap > a.gap ? b : a));
    const worst = rows.reduce((a, b) => (b.gap < a.gap ? b : a));
    insights.push({
      id: 'share', icon: 'share', tone: 'info', title: '쓴 돈에 비해 일을 잘하는 매체는?',
      text: '전체 광고비 중 차지하는 비율과, 광고로 생긴 성과 중 차지하는 비율을 비교했어요.',
      lines: [
        `${shortName(best.c.channel)}: 광고비 ${best.spendShare.toFixed(0)}% 쓰고 성과는 ${best.perfShare.toFixed(0)}% 가져옴 → 몸값보다 일을 잘해요`,
        best !== worst ? `${shortName(worst.c.channel)}: 광고비 ${worst.spendShare.toFixed(0)}% 쓰고 성과는 ${worst.perfShare.toFixed(0)}% 가져옴 → 쓴 만큼 못 가져와요` : null
      ].filter(Boolean),
      hint: '단, 비중이 큰 매체는 이미 포화돼서 효율이 낮아 보일 수 있어요. "광고비 100만 원을 더 쓴다면" 항목과 함께 보세요.'
    });
  }

  // 4) 프로모션 효과
  if (promoEffects.length) {
    insights.push({
      id: 'promo', icon: 'promo', tone: promoEffects.some(p => p.totalEffectCI && p.totalEffectCI[0] > 0) ? 'good' : 'info',
      title: '프로모션은 효과가 있었을까?',
      text: '광고 효과를 뺀 순수 프로모션 효과예요. 프로모션을 진행한 날 하루 기준으로 계산했어요.',
      lines: promoEffects.map(p => {
        const ci = p.totalEffectCI || [0, 0];
        const status = ci[0] > 0 ? '효과 확실' : ci[1] < 0 ? '오히려 감소' : '효과 불확실';
        return `${p.name}: 하루 약 ${fmtKpi(p.coef)} 추가 (${status})`;
      }),
      hint: '"효과 불확실"은 프로모션 날과 아닌 날의 차이가 우연과 구분되지 않을 만큼 작다는 뜻이에요.'
    });
  }

  // 5) 자연 매출(광고·프로모션 제외) 작년 대비 추세
  const T = baselineSeries.length;
  if (T >= 65) {
    const recent = baselineSeries.slice(T - 13);
    const lastYear = baselineSeries.slice(T - 13 - 52, T - 52);
    const change = (avg(recent) / (avg(lastYear) || 1) - 1) * 100;
    insights.push({
      id: 'trend', icon: 'trend', tone: change >= 3 ? 'good' : change <= -3 ? 'warn' : 'info',
      title: `광고 없이도 생기는 ${kpiName}, 늘고 있을까?`,
      text: `광고와 프로모션 효과를 뺀 '자연 ${kpiName}'${hasBatchim(kpiName) ? '이' : '가'} 작년 같은 기간보다 최근 13주에 ${signedPct(change, 1)} ${change >= 0 ? '늘었어요' : '줄었어요'}.`,
      lines: [],
      hint: change >= 3
        ? '광고 없이도 찾아오는 고객이 늘고 있다는 신호예요 (브랜드 인지도·재구매).'
        : change <= -3
          ? '광고 없이 들어오는 고객이 줄고 있어요. 재구매·검색 유입을 점검해 보세요.'
          : '자연 매출은 큰 변화 없이 유지되고 있어요.'
    });
  }

  // 6) 계절 효과
  const sw = seasonalityEffects.seasonWeeks || {};
  const seasons = ['Spring', 'Summer', 'Autumn', 'Winter']
    .filter(s => (sw[s] || 0) > 0)
    .map(s => ({ s, v: Number(seasonalityEffects[`${s.toLowerCase()}EffectRatio`]) || 0 }));
  if ((modelInfo.nWeeks || 0) >= 52 && seasons.length >= 2) {
    const hi = seasons.reduce((a, b) => (b.v > a.v ? b : a));
    const lo = seasons.reduce((a, b) => (b.v < a.v ? b : a));
    insights.push({
      id: 'season', icon: 'season', tone: 'info', title: '계절 덕분인지, 광고 덕분인지',
      text: `광고를 빼고 봐도 ${SEASON_KO[hi.s]}에는 ${iga(kpiName)} 평균보다 ${signedPct(hi.v, 1)}, ${SEASON_KO[lo.s]}에는 ${signedPct(lo.v, 1)}예요.`,
      lines: [],
      hint: '성수기에 광고 성과가 좋아 보이는 건 계절 덕분일 수 있어요. 성수기와 비수기 광고 성과를 단순 비교하지 마세요.'
    });
  }

  // 7) 분석 신뢰도
  {
    const rhat = Number(summary.rhatMax);
    const okRhat = Number.isFinite(rhat) && rhat <= 1.1;
    const short = (modelInfo.nWeeks || summary.sampleSize || 0) < 52;
    const warnCount = (modelInfo.warnings || []).length;
    insights.push({
      id: 'trust', icon: 'trust', tone: okRhat && !short ? 'good' : 'warn',
      title: '이 분석, 얼마나 믿을 만한가요?',
      text: `${summary.sampleSize || 0}주 데이터로 분석했고, 주별 예측이 실제와 평균 ${(Number(summary.mape) || 0).toFixed(1)}% 차이 나요.`,
      lines: [
        Number.isFinite(rhat) ? (okRhat ? `계산이 정상적으로 수렴했어요 (R-hat ${rhat.toFixed(2)})` : `계산이 충분히 수렴하지 않았어요 (R-hat ${rhat.toFixed(2)}) → 참고용으로만 보세요`) : null,
        short ? '1년이 안 되는 데이터라 계절 효과와 광고 효과가 섞였을 수 있어요' : null,
        warnCount ? `상단 주의사항 ${warnCount}건을 함께 확인하세요` : null
      ].filter(Boolean),
      hint: 'MMM은 과거 데이터로 추정한 값이라, 큰 결정 전에는 일부 매체를 잠시 끄거나 늘려보는 테스트로 확인하면 가장 확실해요.'
    });
  }

  return { headline, insights };
}
