import React from 'react';
import { DollarSign, TrendingUp, CheckCircle, PieChart, Calendar } from 'lucide-react';

export default function MetricsOverview({ mmmResult }) {
  if (!mmmResult || !mmmResult.summary) return null;

  const { summary, isCpaMode, kpiTerms = { name: '매출액', roas: 'ROAS', unit: '₩' } } = mmmResult;
  
  // Format based on KPI unit
  const formatKpi = (val) => {
    if (kpiTerms.unit === '₩') {
      return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(val || 0);
    }
    return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(val || 0) + ' ' + kpiTerms.unit;
  };
  
  // Format Spend (Always KRW)
  const formatSpend = (val) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(val || 0);

  const safeNum = (val) => Number(val) || 0;

  const totalROAS = Number(summary.totalROAS) || 0;
  const rSquared = Number(summary.rSquared) || 0;
  const baselineRatio = Number(summary.baselineRatio) || 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
      
      {/* 1. Total KPI */}
      <div className="glass-panel glass-panel-hover rounded-2xl p-5 border border-slate-800 relative overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-slate-400">총 분석 {kpiTerms.name}</span>
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="text-lg md:text-xl font-bold text-white tracking-tight mb-1">
          {formatKpi(summary.totalKPI)}
        </div>
        <p className="text-[11px] text-slate-400">전체 분석 기간 합산 목표 KPI</p>
        <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
      </div>

      {/* 2. Total Spend & ROAS */}
      <div className="glass-panel glass-panel-hover rounded-2xl p-5 border border-slate-800 relative overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold text-slate-400 flex items-center gap-1">
            <TrendingUp className="w-3 h-3"/> 종합 효율 ({isCpaMode ? '100만원당 획득' : 'ROAS'})
          </h4>
          <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="text-lg md:text-xl font-bold text-blue-400 tracking-tight mb-1">
          {isCpaMode 
            ? new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(safeNum(summary.totalROAS)) + ` ${kpiTerms.unit || '건'}`
            : safeNum(summary.totalROAS).toFixed(2) + 'x'
          }
        </div>
        <p className="text-[11px] text-slate-400">총 집행 광고비: {formatSpend(summary.totalSpend)}</p>
        <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-blue-500/5 rounded-full blur-xl pointer-events-none" />
      </div>

      {/* 3. Model Accuracy R-Squared */}
      <div className="glass-panel glass-panel-hover rounded-2xl p-5 border border-slate-800 relative overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-slate-400">MMM 모델 설명력 (R²)</span>
          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
            <CheckCircle className="w-4 h-4" />
          </div>
        </div>
        <div className="text-lg md:text-xl font-bold text-indigo-400 tracking-tight mb-1">
          {(rSquared * 100).toFixed(1)}%
        </div>
        <p className="text-[11px] text-slate-400">회귀 모델의 실제 {kpiTerms.name} 예측 정밀도</p>
        <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-indigo-500/5 rounded-full blur-xl pointer-events-none" />
      </div>

      {/* 4. Baseline Revenue */}
      <div className="glass-panel glass-panel-hover rounded-2xl p-5 border border-slate-800 relative overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-slate-400">자연 발생 {kpiTerms.name} (Baseline)</span>
          <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl">
            <PieChart className="w-4 h-4" />
          </div>
        </div>
        <div className="text-lg md:text-xl font-bold text-purple-400 tracking-tight mb-1">
          {baselineRatio.toFixed(1)}%
        </div>
        <p className="text-[11px] text-slate-400">비광고 시즈널리티/브랜드 자연 발생량</p>
        <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-purple-500/5 rounded-full blur-xl pointer-events-none" />
      </div>

      {/* 5. Analysis Sample Size */}
      <div className="glass-panel glass-panel-hover rounded-2xl p-5 border border-slate-800 relative overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-slate-400">분석 샘플 기간</span>
          <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
            <Calendar className="w-4 h-4" />
          </div>
        </div>
        <div className="text-lg md:text-xl font-bold text-amber-400 tracking-tight mb-1">
          {summary.sampleSize || 0} 일간
        </div>
        <p className="text-[11px] text-slate-400">일별 시분할 회귀 데이터 포인트</p>
        <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
      </div>

    </div>
  );
}
