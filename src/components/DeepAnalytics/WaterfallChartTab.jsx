import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { BarChart3 } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function WaterfallChartTab({ mmmResult }) {
  if (!mmmResult) return null;

  const { summary, channelMetrics, seasonalityEffects = {}, kpiTerms = { name: '매출액', roas: 'ROAS', unit: '₩' } } = mmmResult;
  const formatKpi = (val) => {
    if (kpiTerms.unit === '₩') return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(val || 0);
    return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(val || 0) + ' ' + kpiTerms.unit;
  };

  // 1. Calculate the initial baseline without trend, seasonality or promo
  // This is a simplification for visualization purposes. 
  // We'll group baseline into Base, Seasonality/Trend, Promo, and Media.

  // 1. Calculate the initial baseline components
  const totalKPI = summary.totalKPI;
  
  const CHART_COLORS = [
    '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', 
    '#06b6d4', '#ef4444', '#14b8a6', '#f97316', '#6366f1', 
    '#84cc16', '#a855f7', '#fbbf24', '#f43f5e', '#38bdf8', 
    '#c084fc', '#fb923c', '#34d399', '#e879f9', '#818cf8'
  ];

  // Media contributions
  const mediaContribs = channelMetrics.map((m, idx) => ({
    label: m.channel,
    value: m.revenueContrib,
    color: CHART_COLORS[idx % CHART_COLORS.length]
  }));

  // Promo contribution
  const promoValue = (mmmResult.promoEffects || []).reduce((sum, p) => sum + Math.max(0, (p.effectRatio / 100) * totalKPI), 0);
  
  // Baseline (Base + Trend + Seasonality) excluding Promo
  const baselineValue = Math.max(0, summary.baselineKPI - promoValue);
  
  const waterfallData = [
    { label: `자연 발생 ${kpiTerms.name} (Baseline)`, value: baselineValue, color: '#94a3b8' },
    { label: '프로모션 및 이벤트 총 기여', value: promoValue, color: '#ec4899' },
    ...mediaContribs
  ].filter(d => d.value > 0);

  // Calculate Cumulative values for waterfall rendering
  const labels = waterfallData.map(d => d.label);
  labels.push('총 목표 KPI (Total)');

  const minData = [];
  const maxData = [];
  const colors = [];

  let cumulative = 0;
  waterfallData.forEach(d => {
    minData.push(cumulative);
    maxData.push(cumulative + d.value);
    colors.push(d.color);
    cumulative += d.value;
  });

  // Final Total Bar
  minData.push(0);
  maxData.push(cumulative);
  colors.push('#10b981');

  // We use floating bars (min, max arrays)
  const data = {
    labels,
    datasets: [
      {
        label: '기여분',
        data: maxData.map((max, i) => [minData[i], max]),
        backgroundColor: colors,
        borderWidth: 1,
        borderColor: colors.map(c => c),
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => {
            const val = context.raw[1] - context.raw[0];
            return `기여분: ${formatKpi(val)}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#64748b', font: { size: 10 } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: {
          color: '#64748b',
          font: { size: 10 },
          callback: (val) => (val / 10000).toLocaleString() + '만'
        }
      }
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Header Info */}
      <div className="p-5 bg-slate-900/90 rounded-2xl border border-slate-800">
        <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
          <BarChart3 className="w-5 h-5 text-indigo-400" /> 증분 KPI 워터폴 차트 (Incremental KPI Waterfall)
        </h3>
        <p className="text-xs text-slate-400">
          기저(Base) KPI에서 출발하여 계절성, 프로모션/이벤트, 그리고 각 마케팅 매체가 만들어낸 **순증분(Incremental Lift)**을 
          누적하여 최종 KPI에 도달하는 과정을 시각화합니다.
        </p>

        {/* 초보자용 설명 */}
        <div className="mt-3 p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
          <p className="text-[11px] font-semibold text-slate-300 mb-2">📖 워터폴 차트 용어 안내</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] text-slate-400">
            <div className="flex items-start gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0 mt-1" />
              <span><strong className="text-slate-200">자연 발생 {kpiTerms.name} (Baseline)</strong> : 광고를 하지 않아도 자연적으로 발생하는 {kpiTerms.name} (브랜드 인지도, 고정 고객, 계절성 등 포함)</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-pink-400 shrink-0 mt-1" />
              <span><strong className="text-slate-200">프로모션 및 이벤트 효과</strong> : 할인, 이벤트 등 프로모션 활동으로 인한 {kpiTerms.name} 증가분</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 mt-1" />
              <span><strong className="text-slate-200">매체별 증분</strong> : 각 광고 매체(Meta, Google 등)가 순수하게 만들어낸 추가 {kpiTerms.name}</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
            💡 <strong className="text-slate-400">쉽게 말하면:</strong> 광고를 안 해도 생기는 기본 {kpiTerms.name}(Baseline) 위에, 
            프로모션/이벤트 → 각 광고 매체 순서로 <strong className="text-emerald-400">{kpiTerms.name}이 쌓여가는 과정</strong>을 보여줍니다. 
            막대가 큰 매체일수록 {kpiTerms.name}에 더 많이 기여한 것입니다.
          </p>
        </div>
      </div>

      {/* Main Chart */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 shadow-xl">
        <div className="h-80 w-full">
          <Bar data={data} options={options} />
        </div>
      </div>

    </div>
  );
}
