import React, { useState, useEffect } from 'react';
import { Sliders, RotateCcw, Sparkles, ArrowUpRight, TrendingUp } from 'lucide-react';
import { simulateBudgetChange } from '../engine/mmmEngine';

export default function BudgetSimulator({ mmmResult }) {
  if (!mmmResult || !mmmResult.channelMetrics) return null;

  const { channelMetrics, kpiTerms = { name: '매출액', roas: 'ROAS', unit: '₩' } } = mmmResult;
  const [multipliers, setMultipliers] = useState({});
  const [simulationResult, setSimulationResult] = useState(null);

  useEffect(() => {
    const initial = {};
    channelMetrics.forEach(m => {
      initial[m.channel] = 1.0;
    });
    setMultipliers(initial);
  }, [mmmResult]);

  useEffect(() => {
    if (Object.keys(multipliers).length > 0) {
      const res = simulateBudgetChange(mmmResult, multipliers);
      setSimulationResult(res);
    }
  }, [multipliers, mmmResult]);

  const handleSliderChange = (channel, val) => {
    setMultipliers(prev => ({
      ...prev,
      [channel]: parseFloat(val)
    }));
  };

  const handleReset = () => {
    const reset = {};
    channelMetrics.forEach(m => {
      reset[m.channel] = 1.0;
    });
    setMultipliers(reset);
  };

  const handleAutoOptimize = () => {
    const optimized = {};
    channelMetrics.forEach(m => {
      const roasVal = Number(m.mRoas ?? m.avgRoas ?? m.roas) || 0;
      if (roasVal >= 2.0) {
        optimized[m.channel] = 1.35;
      } else if (roasVal >= 1.0) {
        optimized[m.channel] = 1.15;
      } else {
        optimized[m.channel] = 0.75;
      }
    });
    setMultipliers(optimized);
  };

  const formatKpi = (val) => {
    if (kpiTerms.unit === '₩') return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(val || 0);
    return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(val || 0) + ' ' + kpiTerms.unit;
  };

  const formatSpend = (val) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(val || 0);

  if (!simulationResult) return null;

  const predictedTotalKPI = Number(simulationResult.predictedTotalKPI) || 0;
  const newTotalSpend = Number(simulationResult.newTotalSpend) || 0;
  const newOverallROAS = Number(simulationResult.newOverallROAS) || 0;
  const kpiChangePercent = Number(simulationResult.kpiChangePercent) || 0;
  const simulatedChannels = simulationResult.simulatedChannels || [];

  return (
    <div className="glass-panel rounded-2xl p-6 border border-slate-800 shadow-xl mb-8">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-400" /> 매체별 예산 재배치 시뮬레이터 (Budget Simulator)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            매체별 예산 슬라이더를 조절하여 한계 수확 점감 곡선(Saturation)에 기반한 예상 {kpiTerms.name} 변화를 시뮬레이션하세요.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleAutoOptimize}
            className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-1.5 transition glow-blue"
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI 최적 예산 배치 추천
          </button>
          
          <button
            onClick={handleReset}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 flex items-center gap-1 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            초기화
          </button>
        </div>
      </div>

      {/* Simulator Metrics KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 bg-slate-900/80 p-4 rounded-xl border border-slate-800">
        
        <div className="flex flex-col">
          <span className="text-xs text-slate-400 mb-1">예상 전체 {kpiTerms.name}</span>
          <div className="text-xl font-extrabold text-white flex items-baseline gap-2">
          {formatKpi(predictedTotalKPI)}
            <span className={`text-xs font-bold ${kpiChangePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              ({kpiChangePercent >= 0 ? `+${kpiChangePercent.toFixed(2)}%` : `${kpiChangePercent.toFixed(2)}%`})
            </span>
          </div>
        </div>

        <div className="flex flex-col">
          <span className="text-xs text-slate-400 mb-1">조정 후 총 예산</span>
          <div className="text-xl font-extrabold text-blue-400">
            {formatSpend(newTotalSpend)}
          </div>
        </div>

        <div className="flex flex-col">
          <span className="text-xs text-slate-400 mb-1">예상 통합 {kpiTerms.roas}</span>
          <div className="text-xl font-extrabold text-purple-400 flex items-center gap-1">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            {newOverallROAS.toFixed(2)}x
          </div>
        </div>

      </div>

      {/* Media Budget Sliders List */}
      <div className="space-y-6">
        {simulatedChannels.map(item => {
          const mult = Number(multipliers[item.channel]) || 1.0;
          const percentChange = ((mult - 1.0) * 100).toFixed(0);

          return (
            <div key={item.channel} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
                
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{item.channel}</span>
                  <span className={`text-xs px-2 py-0.5 rounded font-mono font-semibold ${mult > 1.0 ? 'bg-emerald-500/20 text-emerald-400' : mult < 1.0 ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 text-slate-400'}`}>
                    {mult.toFixed(2)}x ({percentChange >= 0 ? `+${percentChange}%` : `${percentChange}%`})
                  </span>
                </div>

                <div className="text-xs text-slate-300 font-mono flex items-center gap-4">
                  <span>예산: <strong className="text-white">{formatSpend(item.newSpend)}</strong></span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
                  <span>예상 {kpiTerms.name} 기여: <strong className="text-emerald-400">{formatKpi(item.newContrib)}</strong></span>
                </div>

              </div>

              {/* Slider */}
              <div className="flex items-center gap-4">
                <span className="text-[11px] text-slate-500 font-mono">-50%</span>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.05"
                  value={mult}
                  onChange={(e) => handleSliderChange(item.channel, e.target.value)}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <span className="text-[11px] text-slate-500 font-mono">+100%</span>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
