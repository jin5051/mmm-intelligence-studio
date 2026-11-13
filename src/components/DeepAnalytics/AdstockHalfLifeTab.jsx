import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  BarElement
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { Timer, ArrowRight, Activity } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend
);

export default function AdstockHalfLifeTab({ mmmResult }) {
  if (!mmmResult) return null;

  const { channelMetrics } = mmmResult;
  const colors = [
    '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', 
    '#06b6d4', '#ef4444', '#14b8a6', '#f97316', '#6366f1', 
    '#84cc16', '#a855f7', '#fbbf24', '#f43f5e', '#38bdf8', 
    '#c084fc', '#fb923c', '#34d399', '#e879f9', '#818cf8'
  ];

  // Prepare Adstock Decay Weight Chart
  const maxLagLen = channelMetrics.reduce((max, item) => {
    const len = item.params?.adstockWeights ? item.params.adstockWeights.length : 0;
    return Math.max(max, len);
  }, 0);
  // Default to 8 if no data
  const maxLag = maxLagLen > 0 ? maxLagLen - 1 : 8;
  const labels = Array.from({ length: maxLag + 1 }, (_, i) => (i === 0 ? '집행 주' : `${i}주 후`));
  
  const datasets = channelMetrics.map((item, idx) => {
    return {
      label: item.channel,
      data: item.params.adstockWeights || [],
      backgroundColor: colors[idx % colors.length] + '80', // opacity 50%
      borderColor: colors[idx % colors.length],
      borderWidth: 1,
    };
  });

  const data = {
    labels,
    datasets
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { color: '#cbd5e1', font: { size: 11 } }
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.dataset.label} 가중치: ${(context.raw * 100).toFixed(1)}%`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#64748b', font: { size: 10 } },
        title: { display: true, text: '지연 기간 (주)', color: '#94a3b8', font: { size: 11 } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: {
          color: '#64748b',
          font: { size: 10 },
          callback: (val) => `${(val * 100).toFixed(0)}%`
        },
        title: { display: true, text: '이월 효과 가중치 (Weight)', color: '#94a3b8', font: { size: 11 } }
      }
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Header Info */}
      <div className="p-5 bg-slate-900/90 rounded-2xl border border-slate-800">
        <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
          <Timer className="w-5 h-5 text-indigo-400" /> Adstock 이월 효과 (Geometric, 주 단위)
        </h3>
        <p className="text-xs text-slate-400">
          Meridian 기본값과 같은 Geometric Adstock입니다. 이번 주 광고비의 효과가 다음 주부터 감쇠율(Decay)만큼씩 줄어들며 최대 8주까지 이어집니다.
          감쇠율은 MCMC 사후분포의 평균이며, 막대는 각 주에 남는 효과 비중입니다. (집행 주 ~ 8주 후 합계 = 100%)
        </p>

        {/* 초보자용 Lag 설명 */}
        <div className="mb-4 bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 mt-3">
          <p className="text-[11px] font-semibold text-slate-300 mb-2">💡 이월 효과 해석 가이드 (단위: 주)</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-4 text-[10px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <span><strong className="text-slate-200">집행 주</strong> : 광고비를 쓴 그 주의 효과</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              <span><strong className="text-slate-200">1주 후</strong> : 다음 주에 남는 효과</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              <span><strong className="text-slate-200">2주 후</strong> : 2주 뒤에 남는 효과</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span><strong className="text-slate-200">3~4주 후</strong> : 한 달 안팎의 잔존 효과</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
              <span><strong className="text-slate-200">5~8주 후</strong> : 장기 잔존 효과 (브랜딩 매체에서 커짐)</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-3 pt-3 border-t border-slate-700/50">
            <strong className="text-slate-300">반감기</strong>는 효과가 절반으로 줄기까지 걸리는 기간입니다. 
            반감기가 짧으면 <strong className="text-blue-400">즉각 효과형</strong>(검색 광고 등), 
            길면 <strong className="text-emerald-400">이월 효과형</strong>(브랜딩/콘텐츠 등)입니다. 주 단위로 분석하므로 며칠 안에 사라지는 효과는 감쇠율이 0에 가깝게 나옵니다.
          </p>
        </div>
      </div>

      {/* Main Chart */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 shadow-xl">
        <div className="h-80 w-full">
          <Bar data={data} options={options} />
        </div>
      </div>

      {/* Decay Parameters Diagnosis Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {channelMetrics.map((item, idx) => {
          const decay = item.params?.decay || 0;
          const halfLife = item.params?.halfLifeWeeks || 0;
          const decayCI = item.params?.decayCI;
          const isLasting = halfLife >= 1;

          return (
            <div key={item.channel} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: colors[idx % colors.length] }} />
              
              <div className="flex justify-between items-start mb-3 pl-2">
                <h4 className="text-sm font-bold text-white">{item.channel}</h4>
                <div className="flex gap-2">
                  <span className="px-2 py-1 bg-slate-800 rounded border border-slate-700 text-[10px] font-mono text-pink-300">
                    Decay = {decay.toFixed(2)}
                  </span>
                  <span className="px-2 py-1 bg-slate-800 rounded border border-slate-700 text-[10px] font-mono text-emerald-300">
                    반감기 = {halfLife.toFixed(1)}주
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 pl-2">
                <Activity className="w-4 h-4 shrink-0 text-slate-400 mt-0.5" />
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  이 매체는 광고 집행 후 
                  {isLasting 
                    ? <span className="text-emerald-400 font-semibold"> 효과가 1주 이상 이어지는 이월형</span>
                    : <span className="text-amber-400 font-semibold"> 대부분의 효과가 집행 주에 나타나는 즉각형</span>}
                  입니다. 
                  다음 주에는 효과가 {decay.toFixed(2)}배로 줄어들며 이월됩니다.
                  {decayCI && <span className="text-slate-500"> (95% 구간 {decayCI[0].toFixed(2)} ~ {decayCI[1].toFixed(2)})</span>}
                </p>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
