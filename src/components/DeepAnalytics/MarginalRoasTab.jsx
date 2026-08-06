import React from 'react';
import { Target, Layers, Star, DollarSign, HelpCircle, AlertOctagon } from 'lucide-react';

export default function MarginalRoasTab({ mmmResult }) {
  if (!mmmResult || !mmmResult.channelMetrics) return null;

  const { channelMetrics, isCpaMode, kpiTerms = { name: '매출액', roas: 'ROAS', unit: '₩' } } = mmmResult;
  const safeNum = (val) => Number(val) || 0;
  
  const formatRoas = (val) => {
    if (isCpaMode) {
      return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(val) + ' ' + (kpiTerms.unit || '건');
    }
    return val.toFixed(2) + 'x';
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Header Info */}
      <div className="p-5 bg-slate-900/90 rounded-2xl border border-slate-800">
        <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
          <Target className="w-5 h-5 text-emerald-400" /> {isCpaMode ? `100만원당 획득 ${kpiTerms.name}` : `한계 ${kpiTerms.roas} (Marginal ${kpiTerms.roas})`} vs 평균 획득 효율 & 4분면 전략 포지셔닝
        </h3>
        <p className="text-xs text-slate-400">
          마케터는 과거의 단순 평균 획득량이 아닌, **예산을 100만 원 추가 투입했을 때 확보 가능한 한계 획득량({isCpaMode ? `증분 획득 ${kpiTerms.name}` : 'mROAS'})**을 기준으로 예산을 배분해야 총 {kpiTerms.name}이 극대화됩니다.
        </p>

        {/* 초보자용 설명 */}
        <div className="mt-3 p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
          <p className="text-[11px] font-semibold text-slate-300 mb-2">📖 {kpiTerms.roas} & 4분면 용어 안내</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] text-slate-400">
            <div className="flex items-start gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 mt-1" />
              <span><strong className="text-slate-200">평균 {kpiTerms.roas}</strong> : 총 {kpiTerms.name} ÷ 총 광고비. 과거 전체 기간의 평균 효율 (이미 일어난 결과)</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1" />
              <span><strong className="text-slate-200">{isCpaMode ? `증분 획득 ${kpiTerms.name}` : '한계 mROAS'}</strong> : 지금 비용을 더 투입했을 때 단위 비용(100만원) 당 추가 획득하는 {kpiTerms.name}. 미래 예산 의사결정의 핵심 지표</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-1" />
              <span><strong className="text-slate-200">⭐ Stars</strong> : 비중도 크고 효율도 좋은 매체 → 주력 유지·확장</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 mt-1" />
              <span><strong className="text-slate-200">❓ Opportunities</strong> : 비중은 작지만 효율 좋음 → 예산 증액 최우선 대상</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0 mt-1" />
              <span><strong className="text-slate-200">💰 Cash Cows</strong> : 비중 크지만 이미 포화 → 현재 수준 유지</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0 mt-1" />
              <span><strong className="text-slate-200">⚠️ Red Flags</strong> : 비중도 작고 효율도 낮음 → 예산 감축 검토</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
            💡 <strong className="text-slate-400">쉽게 말하면:</strong> 평균 성과가 우수해도 이미 포화된 매체는 추가 투자 효과가 낮습니다. 
            <strong className="text-emerald-400">{isCpaMode ? `비용 100만 원당 가장 많은 ${kpiTerms.name}을 획득할 수 있는 매체` : 'mROAS가 높은 매체'}</strong>에 예산을 더 넣는 것이 전체 {kpiTerms.name} 극대화의 핵심입니다.
          </p>
        </div>
      </div>

      {/* Avg ROAS vs mROAS Comparison Bar Grid */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 shadow-xl">
        <h4 className="text-sm font-bold text-white mb-4">매체별 {isCpaMode ? `평균 vs 증분 획득 ${kpiTerms.name} (100만원 당)` : `평균 ${kpiTerms.roas} vs 한계 mROAS`} 비교</h4>

        <div className="space-y-5">
          {channelMetrics.map(item => {
            const avgRoasVal = safeNum(item.avgRoas ?? item.roas);
            const mRoasVal = safeNum(item.mRoas);

            return (
              <div key={item.channel} className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white font-sans">{item.channel}</span>
                  <span className="font-mono text-slate-300">
                    {isCpaMode ? '평균 획득' : `평균 ${kpiTerms.roas}`}: <strong className="text-blue-400">{formatRoas(avgRoasVal)}</strong> | 
                    {isCpaMode ? '증분 획득' : '한계 mROAS'}: <strong className="text-emerald-400">{formatRoas(mRoasVal)}</strong>
                  </span>
                </div>

                {/* Progress Bars */}
                <div className="space-y-1">
                  <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden flex">
                    <div className="bg-blue-500 h-full" style={{ width: `${Math.min(100, (avgRoasVal / (isCpaMode ? avgRoasVal*2 : 6)) * 100)}%` }} title="Avg Yield" />
                  </div>
                  <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden flex">
                    <div className="bg-emerald-400 h-full" style={{ width: `${Math.min(100, (mRoasVal / (isCpaMode ? avgRoasVal*2 : 6)) * 100)}%` }} title="Marginal Yield" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4-Quadrant Strategic Positioning Matrix */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800">
        <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
          <Layers className="w-4 h-4 text-purple-400" /> 매체 4분면 전략 포지셔닝 매트릭스 (4-Quadrant Matrix)
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Quadrant 1: Stars */}
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs mb-2">
              <Star className="w-4 h-4" /> ⭐ Stars (고비중 & 고효율 {isCpaMode ? '증분 획득량' : `한계 ${kpiTerms.roas}`} — 주력 확장 매체)
            </div>
            <div className="flex wrap gap-2">
              {channelMetrics.filter(m => m.quadrant === 'Stars').map(m => (
                <span key={m.channel} className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-bold rounded-lg border border-emerald-500/30">
                  {m.channel} ({isCpaMode ? '증분' : 'mROAS'}: {formatRoas(safeNum(m.mRoas))})
                </span>
              ))}
              {channelMetrics.filter(m => m.quadrant === 'Stars').length === 0 && (
                <span className="text-xs text-slate-500">해당 매체 없음</span>
              )}
            </div>
          </div>

          {/* Quadrant 2: Opportunities */}
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
            <div className="flex items-center gap-2 text-blue-400 font-bold text-xs mb-2">
              <HelpCircle className="w-4 h-4" /> ❓ Opportunities (저비중 & 고효율 {isCpaMode ? '증분 획득량' : `한계 ${kpiTerms.roas}`} — 예산 증액 최우선)
            </div>
            <div className="flex wrap gap-2">
              {channelMetrics.filter(m => m.quadrant === 'Opportunities').map(m => (
                <span key={m.channel} className="px-2.5 py-1 bg-blue-500/20 text-blue-300 text-xs font-bold rounded-lg border border-blue-500/30">
                  {m.channel} ({isCpaMode ? '증분' : 'mROAS'}: {formatRoas(safeNum(m.mRoas))})
                </span>
              ))}
              {channelMetrics.filter(m => m.quadrant === 'Opportunities').length === 0 && (
                <span className="text-xs text-slate-500">해당 매체 없음</span>
              )}
            </div>
          </div>

          {/* Quadrant 3: Cash Cows */}
          <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
            <div className="flex items-center gap-2 text-purple-400 font-bold text-xs mb-2">
              <DollarSign className="w-4 h-4" /> 💰 Cash Cows (고비중 & 포화상태 — 현재 유지)
            </div>
            <div className="flex wrap gap-2">
              {channelMetrics.filter(m => m.quadrant === 'Cash Cows').map(m => (
                <span key={m.channel} className="px-2.5 py-1 bg-purple-500/20 text-purple-300 text-xs font-bold rounded-lg border border-purple-500/30">
                  {m.channel} ({isCpaMode ? '증분' : 'mROAS'}: {formatRoas(safeNum(m.mRoas))})
                </span>
              ))}
              {channelMetrics.filter(m => m.quadrant === 'Cash Cows').length === 0 && (
                <span className="text-xs text-slate-500">해당 매체 없음</span>
              )}
            </div>
          </div>

          {/* Quadrant 4: Red Flags */}
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-xs mb-2">
              <AlertOctagon className="w-4 h-4" /> ⚠️ Red Flags (비효율/과다포화 — 예산 감축 대상)
            </div>
            <div className="flex wrap gap-2">
              {channelMetrics.filter(m => m.quadrant === 'Red Flags').map(m => (
                <span key={m.channel} className="px-2.5 py-1 bg-rose-500/20 text-rose-300 text-xs font-bold rounded-lg border border-rose-500/30">
                  {m.channel} ({isCpaMode ? '증분' : 'mROAS'}: {formatRoas(safeNum(m.mRoas))})
                </span>
              ))}
              {channelMetrics.filter(m => m.quadrant === 'Red Flags').length === 0 && (
                <span className="text-xs text-slate-500">해당 매체 없음</span>
              )}
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
