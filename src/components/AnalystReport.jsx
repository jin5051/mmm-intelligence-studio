import React from 'react';
import { FileText, CheckCircle2, AlertTriangle, Lightbulb, Sparkles, Shuffle, Coins, Scale, Gift, Sprout, Sun, ShieldCheck, Quote } from 'lucide-react';
import { buildInsights } from '../utils/insightGenerator';

const INSIGHT_ICONS = {
  budget: Shuffle, next: Coins, share: Scale,
  promo: Gift, trend: Sprout, season: Sun, trust: ShieldCheck
};

const TONE_STYLES = {
  good: { box: 'bg-emerald-500/5 border-emerald-500/20', icon: 'text-emerald-400 bg-emerald-500/10' },
  warn: { box: 'bg-amber-500/5 border-amber-500/20', icon: 'text-amber-400 bg-amber-500/10' },
  info: { box: 'bg-slate-900/70 border-slate-800', icon: 'text-blue-400 bg-blue-500/10' }
};

export default function AnalystReport({ mmmResult }) {
  if (!mmmResult || !mmmResult.channelMetrics || mmmResult.channelMetrics.length === 0) return null;

  const { channelMetrics, summary, seasonalityEffects, promoEffects, kpiTerms = { name: '매출액', roas: 'ROAS', unit: '₩' } } = mmmResult;
  
  const formatKpi = (val) => {
    if (kpiTerms.unit === '₩') return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(val || 0);
    return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(val || 0) + ' ' + kpiTerms.unit;
  };

  const formatSpend = (val) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(val || 0);

  const formatRoas = (val) => {
    if (mmmResult.isCpaMode) {
      return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(val);
    }
    return Number(val).toFixed(2) + 'x';
  };

  const safeNum = (val) => Number(val) || 0;

  const sortedChannels = [...channelMetrics].sort((a, b) => {
    return safeNum(b.mRoas) - safeNum(a.mRoas);
  });
  const bestChannel = sortedChannels[0] || {};
  const worstChannel = sortedChannels[sortedChannels.length - 1] || {};

  const weekendEffect = Number(seasonalityEffects?.weekendEffectRatio) || 0;

  const rSquaredWeekly = Number(summary?.rSquaredWeekly ?? summary?.rSquared) || 0;
  const rhatMax = Number(summary?.rhatMax);

  // 쉽게 보는 인사이트 (모델 숫자에서만 자동 생성)
  let easy = { headline: '', insights: [] };
  try { easy = buildInsights(mmmResult); } catch (e) { console.error('Insight error:', e); }

  // Adstock 반감기(주) 요약
  const halfLives = channelMetrics.map(m => ({ channel: m.channel, hl: Number(m.params?.halfLifeWeeks) || 0 }));
  const longest = halfLives.reduce((a, b) => (b.hl > a.hl ? b : a), halfLives[0] || { channel: '-', hl: 0 });
  const shortest = halfLives.reduce((a, b) => (b.hl < a.hl ? b : a), halfLives[0] || { channel: '-', hl: 0 });

  return (
    <div className="glass-panel rounded-2xl p-6 md:p-8 border border-slate-800 shadow-2xl mb-12">
      
      {/* Report Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-xl shadow-lg glow-blue">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">마케팅 애널리스트 자동 진단 & 인사이트 리포트</h2>
            <p className="text-xs text-slate-400">주 단위 베이지안 MMM(Meridian 방식) 사후분포에서 도출한 데이터 기반 전략 보고서</p>
          </div>
        </div>

        <span className="text-xs font-mono bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700">
          설명력: <strong className="text-indigo-400">{(rSquaredWeekly * 100).toFixed(1)}%</strong> (주단위 R²){Number.isFinite(rhatMax) && <span className="text-slate-400"> / R-hat {rhatMax.toFixed(2)}</span>}
        </span>
      </div>

      {/* 한 줄 요약 */}
      {easy.headline && (
        <div className="mb-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex gap-3">
          <Quote className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-sm text-slate-100 leading-relaxed"><strong className="text-blue-300">한 줄 요약</strong> · {easy.headline}</p>
        </div>
      )}

      {/* Report Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        
        {/* 1. Top Performing Media Card */}
        <div className="p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4" /> ⭐ 최고 성과 광고 매체 (Top Performer)
            </div>
            <h4 className="text-xl font-bold text-white mb-2">{bestChannel.channel || 'N/A'}</h4>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              {mmmResult.isCpaMode 
                ? `가장 적은 비용으로 가장 많은 성과를 견인하고 있습니다. 즉, 비용을 100만 원 추가 투입했을 때 가장 높은 추가 획득량(${formatRoas(safeNum(bestChannel.mRoas))})을 달성할 수 있어 예산 증액 시 1순위로 고려해야 합니다.`
                : `투자 대비 효율이 가장 우수합니다. 즉, 광고비를 추가 투입했을 때 가장 높은 한계 수익률(Marginal ROAS: ${formatRoas(safeNum(bestChannel.mRoas))})을 달성할 수 있어 예산 증액 시 1순위로 고려해야 합니다.`
              }
            </p>
          </div>
          <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800/80 text-xs text-slate-300 font-mono flex justify-between">
            <span>집행 광고비: {formatSpend(bestChannel.spend)}</span>
            <span className="text-emerald-400 font-bold">기여 {kpiTerms.name}: {formatKpi(bestChannel.revenueContrib)}</span>
          </div>
        </div>

        {/* 2. Low Performing / Saturation Media Card */}
        <div className="p-5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4" /> ⚠️ 한계 수확 점감 주의 매체 (Requires Optimization)
            </div>
            <h4 className="text-xl font-bold text-white mb-2">{worstChannel.channel || 'N/A'}</h4>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
            {mmmResult.isCpaMode
              ? `현재 100만원 투입 시 기대되는 획득량이 ${formatRoas(safeNum(worstChannel.mRoas))}에 불과하여 한계 효용 포화가 시작된 것으로 진단됩니다.`
              : `현재 투자 대비 한계 수익률이 가장 낮습니다. 추가 투입 시 기대되는 mROAS가 ${formatRoas(safeNum(worstChannel.mRoas))}에 불과하여 한계 효용 포화가 시작된 것으로 진단됩니다.`
            }
            </p>
          </div>
          <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800/80 text-xs text-slate-300 font-mono flex justify-between">
            <span>집행 광고비: {formatSpend(worstChannel.spend)}</span>
            <span className="text-amber-400 font-bold">기여 {kpiTerms.name}: {formatKpi(worstChannel.revenueContrib)}</span>
          </div>
        </div>

      </div>

      {/* 쉽게 보는 핵심 인사이트 */}
      {easy.insights.length > 0 && (
        <div className="mb-8">
          <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-amber-400" /> 쉽게 보는 핵심 인사이트
          </h4>
          <p className="text-[11px] text-slate-400 mb-4">분석 결과 숫자를 그대로 풀어 쓴 문장이에요. 초록은 좋은 신호, 주황은 확인이 필요한 부분입니다.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {easy.insights.map(item => {
              const Icon = INSIGHT_ICONS[item.icon] || Lightbulb;
              const tone = TONE_STYLES[item.tone] || TONE_STYLES.info;
              return (
                <div key={item.id} className={`p-4 rounded-xl border ${tone.box}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`p-1.5 rounded-lg ${tone.icon}`}><Icon className="w-3.5 h-3.5" /></span>
                    <h5 className="text-xs font-bold text-white">{item.title}</h5>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">{item.text}</p>
                  {item.lines.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {item.lines.map((line, i) => (
                        <li key={i} className="text-[11px] text-slate-300 font-mono leading-relaxed">· {line}</li>
                      ))}
                    </ul>
                  )}
                  {item.hint && <p className="mt-2 text-[10px] text-slate-500 leading-relaxed">💡 {item.hint}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Actionable Strategic Recommendations */}
      <div className="p-6 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4">
        <h4 className="text-sm font-bold text-blue-400 flex items-center gap-2 mb-2">
          <Lightbulb className="w-4 h-4" /> 마케팅 애널리스트 3대 핵심 실행 권고사항 (Action Items)
        </h4>

        <div className="space-y-3">
          
          <div className="flex items-start gap-3 p-3.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
            <span className="flex shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold text-xs items-center justify-center border border-blue-500/30">1</span>
            <div>
              <h5 className="text-xs font-bold text-white mb-0.5">예산 재배치 전략 (Budget Reallocation)</h5>
              <p className="text-xs text-slate-300 leading-relaxed">
                한계 효율이 좋은 <strong className="text-blue-400">{bestChannel.channel}</strong> 예산을 +15~25% 증액하고, 한계 효용 감소가 우려되는 <strong className="text-amber-400">{worstChannel.channel}</strong> 예산의 일부를 재배치하여 전체 {kpiTerms.roas} 최적화를 도모하세요.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
            <span className="flex shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 font-bold text-xs items-center justify-center border border-purple-500/30">2</span>
            <div>
              <h5 className="text-xs font-bold text-white mb-0.5">시즈널리티 타이밍 마케팅 (Seasonality Execution)</h5>
              <p className="text-xs text-slate-300 leading-relaxed">
                일 데이터 기준 주말 {kpiTerms.name}이 평일보다 <strong className="text-purple-300">{weekendEffect >= 0 ? '+' : ''}{weekendEffect.toFixed(1)}%</strong> 다릅니다. 모델은 주 단위라 요일별 광고 효율까지는 추정하지 않으므로, 주말 집중 집행은 플랫폼 요일 리포트로 효율을 함께 확인한 뒤 결정하세요.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
            <span className="flex shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs items-center justify-center border border-emerald-500/30">3</span>
            <div>
              <h5 className="text-xs font-bold text-white mb-0.5">Adstock 이월 잔존 효과 관리 (Retention Decay Management)</h5>
              <p className="text-xs text-slate-300 leading-relaxed">
                효과 반감기가 가장 긴 매체는 <strong className="text-emerald-300">{longest.channel}</strong>({longest.hl.toFixed(1)}주), 가장 짧은 매체는 <strong className="text-emerald-300">{shortest.channel}</strong>({shortest.hl.toFixed(1)}주)입니다. 반감기가 1주 이상인 매체는 집행을 멈춘 뒤에도 효과가 이어지므로 단기 성과만 보고 끄지 말고, 반감기가 짧은 매체는 성수기 주에 맞춰 집중 집행하는 편이 유리합니다.
              </p>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
