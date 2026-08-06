import React from 'react';
import { FileText, CheckCircle2, AlertTriangle, Lightbulb, Sparkles } from 'lucide-react';

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

  const rSquared = Number(summary?.rSquared) || 0;

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
            <p className="text-xs text-slate-400">Meridian MMM 및 시즈널리티 통제 엔진이 도출한 데이터 기반 전략 보고서</p>
          </div>
        </div>

        <span className="text-xs font-mono bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700">
          신뢰도: {(rSquared * 100).toFixed(1)}% (R²)
        </span>
      </div>

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
                주말(Weekend) 및 쇼핑 피크 구간에서 자연 발생 {kpiTerms.name}이 <strong className="text-purple-300">+{Math.abs(weekendEffect).toFixed(1)}%</strong> 상승하는 트렌드가 입증되었습니다. 목요일~금요일부터 마케팅 캠페인을 집행하는 미디어 스케줄링이 효과적입니다.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
            <span className="flex shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs items-center justify-center border border-emerald-500/30">3</span>
            <div>
              <h5 className="text-xs font-bold text-white mb-0.5">Adstock 이월 잔존 효과 관리 (Retention Decay Management)</h5>
              <p className="text-xs text-slate-300 leading-relaxed">
                광고 집행 후 3~7일간 잔존 {kpiTerms.name} 발생 효과(Adstock)가 유지되므로, 매일 동일 예산을 집행하기보다 시즈널리티 피크 2~3일 전에 예산을 집중 집행하는 파동형(Pulsing) 예산 스케줄링을 권장합니다.
              </p>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
