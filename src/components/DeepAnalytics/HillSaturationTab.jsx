import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { TrendingUp, AlertCircle, Info } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
);

export default function HillSaturationTab({ mmmResult }) {
  if (!mmmResult) return null;

  const { channelMetrics, kpiTerms = { name: '매출액', roas: 'ROAS', unit: '₩' } } = mmmResult;
  const formatKpi = (val) => {
    if (kpiTerms.unit === '₩') return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(val || 0);
    return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(val || 0) + ' ' + kpiTerms.unit;
  };

  // Colors for channels
  const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899'];

  // Prepare Datasets for Chart
  const xLabels = channelMetrics[0]?.responseCurvePoints.map(p => `${p.spendPercent}%`) || [];

  const datasets = channelMetrics.map((item, idx) => ({
    label: `${item.channel} 포화 곡선`,
    data: item.responseCurvePoints.map(p => p.predictedKPI),
    borderColor: colors[idx % colors.length],
    backgroundColor: colors[idx % colors.length],
    borderWidth: 2.5,
    tension: 0.4,
    pointRadius: 2,
    pointHoverRadius: 6
  }));

  const data = {
    labels: xLabels,
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
          label: (context) => `${context.dataset.label}: ${formatKpi(context.parsed.y)}`
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#64748b', font: { size: 10 } },
        title: { display: true, text: '현재 예산 대비 비율 (100% = 현재 지출액)', color: '#94a3b8', font: { size: 11 } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: {
          color: '#64748b',
          font: { size: 10 },
          callback: (val) => (val / 10000).toLocaleString() + '만'
        },
        title: { display: true, text: `예상 기여 ${kpiTerms.name}`, color: '#94a3b8', font: { size: 11 } }
      }
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Header Info */}
      <div className="p-5 bg-slate-900/90 rounded-2xl border border-slate-800">
        <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
          <TrendingUp className="w-5 h-5 text-indigo-400" /> Meridian Exact Hill 포화 곡선
        </h3>
        <p className="text-xs text-slate-400">
          Meridian의 <span className="font-mono text-blue-400">x^α / (x^α + K^α)</span> 수식을 통해 매체별 한계효용을 정확히 모델링합니다. 
          α는 형태(Shape), K는 반포화 지점(EC50)을 의미합니다.
        </p>

        {/* 초보자용 설명 */}
        <div className="mt-3 p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
          <p className="text-[11px] font-semibold text-slate-300 mb-2">📖 포화 곡선 용어 안내</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] text-slate-400">
            <div className="flex items-start gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 mt-1" />
              <span><strong className="text-slate-200">포화 곡선 (Saturation Curve)</strong> : 광고비를 늘릴수록 효과가 점점 둔화되는 현상을 그래프로 표현한 것</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 mt-1" />
              <span><strong className="text-slate-200">α (알파, Shape)</strong> : 곡선의 모양. α &lt; 1이면 처음부터 빠르게 포화, α &gt; 1이면 초기엔 천천히 오르다 급격히 포화</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0 mt-1" />
              <span><strong className="text-slate-200">K (EC50, 반포화점)</strong> : 최대 효과의 절반(50%)에 도달하는 광고비 금액. K가 크면 아직 여유가 많다는 뜻</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1" />
              <span><strong className="text-slate-200">100% 지점</strong> : 현재 집행 중인 예산 위치. 오른쪽으로 갈수록 예산 증액 시나리오</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
            💡 <strong className="text-slate-400">쉽게 말하면:</strong> 광고비를 계속 올려도 {kpiTerms.name}이 무한히 올라가지 않습니다. 
            곡선이 <strong className="text-amber-400">평평해지는 구간</strong>은 이미 포화 상태이므로 더 투자해도 효과가 적고, 
            곡선이 <strong className="text-emerald-400">아직 가파른 구간</strong>은 예산을 늘리면 효과가 큽니다.
          </p>
        </div>
      </div>

      {/* Main Chart */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 shadow-xl">
        <div className="h-80 w-full">
          <Line data={data} options={options} />
        </div>
      </div>

      {/* Saturation Diagnosis Cards & Params */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {channelMetrics.map((item, idx) => {
          const currentPoint = item.responseCurvePoints.find(p => p.spendPercent === 100);
          const doubledPoint = item.responseCurvePoints.find(p => p.spendPercent === 200);
          const efficiencyRatio = doubledPoint && currentPoint ? (doubledPoint.predictedKPI / (currentPoint.predictedKPI || 1)) : 1;
          const alpha = item.params?.alpha || 1.0;
          const K = item.params?.K || 1;

          return (
            <div key={item.channel} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: colors[idx % colors.length] }} />
              
              <div className="flex justify-between items-start mb-3 pl-2">
                <h4 className="text-sm font-bold text-white">{item.channel}</h4>
                <div className="flex gap-2">
                  <span className="px-2 py-1 bg-slate-800 rounded border border-slate-700 text-[10px] font-mono text-blue-300">
                    α = {alpha.toFixed(2)}
                  </span>
                  <span className="px-2 py-1 bg-slate-800 rounded border border-slate-700 text-[10px] font-mono text-purple-300">
                    K = {formatKpi(K)}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 pl-2">
                <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${efficiencyRatio >= 1.6 ? 'text-emerald-400' : 'text-amber-400'}`} />
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  예산을 2배(+100%) 증액할 시 KPI 기여분은 <strong className="text-white">{(efficiencyRatio * 100 - 100).toFixed(1)}%</strong> 증가합니다. 
                  {efficiencyRatio >= 1.6 
                    ? <span className="text-emerald-400"> (아직 포화 전 단계)</span>
                    : <span className="text-amber-400"> (한계 포화 구간 진입)</span>}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
