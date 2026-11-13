import React from 'react';
import { Sparkles, Sun, Calendar, Flame, Waves } from 'lucide-react';

export default function SeasonalityChart({ mmmResult }) {
  if (!mmmResult) return null;

  const { seasonalityEffects, kpiTerms = { name: '매출액', roas: 'ROAS', unit: '₩' } } = mmmResult;
  const {
    weekendEffectRatio = 0,
    springEffectRatio = 0,
    summerEffectRatio = 0,
    autumnEffectRatio = 0,
    winterEffectRatio = 0,
    earlyMonthEffectRatio = 0,
    lateMonthEffectRatio = 0,
    friSunEffectRatio = 0
  } = seasonalityEffects || {};

  const safeNum = (val) => Number(val) || 0;

  return (
    <div className="glass-panel rounded-2xl p-6 border border-slate-800 shadow-xl mb-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-6 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" /> 자동 피처 엔지니어링: 시즈널리티 (Seasonality) 변수 분해 분석
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            계절(봄·여름·가을·겨울)은 모델이 추정한 기저선(광고 제외)에서, 주말·월초·월말은 업로드한 일 데이터의 요일·날짜별 패턴에서 계산했습니다.
          </p>
        </div>
        <span className="text-[11px] font-semibold text-purple-300 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">
          {seasonalityEffects?.hasDailyPatterns ? '주말·월초·월말 = 일 데이터 참고 지표' : '주 단위 입력: 주말·월초·월말 계산 불가'}
        </span>
      </div>

      {/* Grid of Seasonality Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        
        {/* 1. Weekend vs Weekday */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-amber-400" /> 주말 (Weekend) 효과
            </span>
            <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded font-mono">
              토/일요일
            </span>
          </div>
          <div className="text-xl font-extrabold text-amber-400 mb-1">
            {safeNum(weekendEffectRatio) >= 0 ? `+${safeNum(weekendEffectRatio).toFixed(1)}%` : `${safeNum(weekendEffectRatio).toFixed(1)}%`}
          </div>
          <p className="text-[11px] text-slate-400">평일 대비 주말의 일평균 {kpiTerms.name} 차이 (전체 KPI 기준)</p>
        </div>

        {/* 2. Weekday Effect */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-400" /> 주중 (Weekday) 효과
            </span>
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-mono">
              월~금요일
            </span>
          </div>
          <div className="text-xl font-extrabold text-emerald-400 mb-1">
            {(-safeNum(weekendEffectRatio)) >= 0 ? `+${(-safeNum(weekendEffectRatio)).toFixed(1)}%` : `${(-safeNum(weekendEffectRatio)).toFixed(1)}%`}
          </div>
          <p className="text-[11px] text-slate-400">주말 대비 평일의 상대적 {kpiTerms.name} 변동률</p>
        </div>

        {/* 7. Early Month */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo-400" /> 월초 (Early Month) 효과
            </span>
            <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded font-mono">
              1~5일
            </span>
          </div>
          <div className="text-xl font-extrabold text-indigo-400 mb-1">
            {safeNum(earlyMonthEffectRatio) >= 0 ? `+${safeNum(earlyMonthEffectRatio).toFixed(1)}%` : `${safeNum(earlyMonthEffectRatio).toFixed(1)}%`}
          </div>
          <p className="text-[11px] text-slate-400">월 중순 대비 월초 일평균 차이 (요일 효과 제거)</p>
        </div>

        {/* 8. Late Month */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-purple-400" /> 월말 (Late Month) 효과
            </span>
            <span className="text-[10px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded font-mono">
              말일 5일전~말일
            </span>
          </div>
          <div className="text-xl font-extrabold text-purple-400 mb-1">
            {safeNum(lateMonthEffectRatio) >= 0 ? `+${safeNum(lateMonthEffectRatio).toFixed(1)}%` : `${safeNum(lateMonthEffectRatio).toFixed(1)}%`}
          </div>
          <p className="text-[11px] text-slate-400">월 중순 대비 월말 일평균 차이 (요일 효과 제거)</p>
        </div>

        {/* 3. Spring Season */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-pink-400" /> 봄 (Spring) 계절성
            </span>
            <span className="text-[10px] text-pink-400 bg-pink-500/10 px-1.5 py-0.5 rounded font-mono">
              3~5월
            </span>
          </div>
          <div className="text-xl font-extrabold text-pink-400 mb-1">
            {safeNum(springEffectRatio) >= 0 ? `+${safeNum(springEffectRatio).toFixed(1)}%` : `${safeNum(springEffectRatio).toFixed(1)}%`}
          </div>
          <p className="text-[11px] text-slate-400">봄철 기저선 수준 (전체 평균 대비)</p>
        </div>

        {/* 4. Summer Season */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Sun className="w-4 h-4 text-emerald-400" /> 여름 (Summer) 계절성
            </span>
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-mono">
              6~8월
            </span>
          </div>
          <div className="text-xl font-extrabold text-emerald-400 mb-1">
            {safeNum(summerEffectRatio) >= 0 ? `+${safeNum(summerEffectRatio).toFixed(1)}%` : `${safeNum(summerEffectRatio).toFixed(1)}%`}
          </div>
          <p className="text-[11px] text-slate-400">여름철 기저선 수준 (전체 평균 대비)</p>
        </div>

        {/* 5. Autumn Season */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Waves className="w-4 h-4 text-blue-400" /> 가을 (Autumn) 계절성
            </span>
            <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded font-mono">
              9~11월
            </span>
          </div>
          <div className="text-xl font-extrabold text-blue-400 mb-1">
            {safeNum(autumnEffectRatio) >= 0 ? `+${safeNum(autumnEffectRatio).toFixed(1)}%` : `${safeNum(autumnEffectRatio).toFixed(1)}%`}
          </div>
          <p className="text-[11px] text-slate-400">가을철 기저선 수준 (전체 평균 대비)</p>
        </div>

        {/* 6. Winter Season */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-cyan-400" /> 겨울 (Winter) 계절성
            </span>
            <span className="text-[10px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded font-mono">
              12~2월
            </span>
          </div>
          <div className="text-xl font-extrabold text-cyan-400 mb-1">
            {safeNum(winterEffectRatio) >= 0 ? `+${safeNum(winterEffectRatio).toFixed(1)}%` : `${safeNum(winterEffectRatio).toFixed(1)}%`}
          </div>
          <p className="text-[11px] text-slate-400">겨울철 기저선 수준 (전체 평균 대비)</p>
        </div>

        </div>

      {/* Analyst Seasonality Insight */}
      <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-200 leading-relaxed">
        <span className="font-bold text-purple-300">💡 마케터 시즈널리티 가이드:</span> 주말(토/일) {kpiTerms.name}이 평일보다 <span className="font-bold text-white">{safeNum(weekendEffectRatio) >= 0 ? '+' : ''}{safeNum(weekendEffectRatio).toFixed(1)}%</span> 다릅니다. 모델은 주 단위라 요일별 광고 효과 차이는 추정하지 않으므로, 요일별 예산 배분은 광고 플랫폼의 요일 리포트와 함께 판단하세요.
      </div>

    </div>
  );
}
