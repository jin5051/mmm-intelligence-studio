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
  const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899'];

  // Prepare Adstock Decay Weight Chart (Lag 0 ~ 8)
  const maxLag = 8;
  const labels = Array.from({ length: maxLag + 1 }, (_, i) => `Lag ${i}`);
  
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
        title: { display: true, text: '지연 기간 (Lags)', color: '#94a3b8', font: { size: 11 } }
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
          <Timer className="w-5 h-5 text-indigo-400" /> Meridian Delayed Adstock Carryover
        </h3>
        <p className="text-xs text-slate-400">
          단순 지수 감쇠(Geometric Decay)를 넘어, 광고 효과의 최대점(Peak)이 즉각(Lag 0) 나타나지 않고 지연(Delayed)되어 나타나는 현상을 모델링합니다. 
          Peak Lag와 Decay 비율에 따른 시간 가중치 곡선을 보여줍니다.
        </p>

        {/* 초보자용 Lag 설명 */}
        <div className="mt-3 p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
          <p className="text-[11px] font-semibold text-slate-300 mb-2">📖 Lag(지연 기간) 용어 안내</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-[10px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
              <span><strong className="text-slate-200">Lag 0</strong> : 광고 집행 당일 효과</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
              <span><strong className="text-slate-200">Lag 1</strong> : 1일 후 잔여 효과</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
              <span><strong className="text-slate-200">Lag 2</strong> : 2일 후 잔여 효과</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
              <span><strong className="text-slate-200">Lag 3~4</strong> : 3~4일 후 잔여 효과</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
              <span><strong className="text-slate-200">Lag 5~8</strong> : 5~8일 후 잔여 효과</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
            💡 <strong className="text-slate-400">쉽게 말하면:</strong> 오늘 광고를 집행하면, 효과가 당일에만 끝나는 것이 아니라 며칠에 걸쳐 이월(Carryover)됩니다. 
            가중치가 높은 Lag 지점이 해당 매체의 <strong className="text-slate-300">효과 최대 시점</strong>이며, 
            Lag 0이 가장 크면 <strong className="text-blue-400">즉각 효과형</strong>(검색 광고 등), 
            Lag 1~2가 크면 <strong className="text-emerald-400">지연 효과형</strong>(브랜드/영상 광고 등)입니다.
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
          const peakLag = item.params?.peakLag || 0;
          const isDelayed = peakLag > 0;

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
                    Peak Lag = {peakLag}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 pl-2">
                <Activity className="w-4 h-4 shrink-0 text-slate-400 mt-0.5" />
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  이 매체는 광고 집행 후 
                  {isDelayed 
                    ? <span className="text-emerald-400 font-semibold"> {peakLag}기간 뒤에 최대 효과(Peak)가 나타나는 지연 효과(Delayed Adstock)</span>
                    : <span className="text-amber-400 font-semibold"> 즉각적인 효과(Lag 0 Peak)</span>}
                  를 보입니다. 
                  초기 효과 대비 {decay.toFixed(2)} 비율로 감쇠하며 이월됩니다.
                </p>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
