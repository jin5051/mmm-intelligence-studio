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
import { Sparkles } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function PromoImpactTab({ mmmResult }) {
  if (!mmmResult || !mmmResult.promoEffects || mmmResult.promoEffects.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-900/50 rounded-xl border border-slate-800">
        <Sparkles className="w-8 h-8 text-slate-600 mx-auto mb-3" />
        <h4 className="text-slate-400 font-semibold mb-1">분석된 프로모션 데이터가 없습니다</h4>
        <p className="text-xs text-slate-500">데이터 업로드 시 프로모션/이벤트 컬럼을 매핑하시면 상세 성과를 확인할 수 있습니다.</p>
      </div>
    );
  }

  const { promoEffects, summary, kpiTerms = { name: '매출액', roas: 'ROAS', unit: '₩' } } = mmmResult;
  const totalKPI = summary.totalKPI;
  
  const formatKpi = (val) => {
    if (kpiTerms.unit === '₩') return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(val || 0);
    return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(val || 0) + ' ' + kpiTerms.unit;
  };

  const labels = promoEffects.map(p => p.name);
  const liftData = promoEffects.map(p => Math.max(0, p.effectRatio));
  const absData = promoEffects.map(p => Math.max(0, (p.effectRatio / 100) * totalKPI));

  const data = {
    labels,
    datasets: [
      {
        label: `프로모션 ${kpiTerms.name} 기여액`,
        data: absData,
        backgroundColor: 'rgba(245, 158, 11, 0.2)', // amber-500/20
        borderColor: 'rgba(245, 158, 11, 1)',
        borderWidth: 1,
        borderRadius: 4,
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
            const idx = context.dataIndex;
            const lift = liftData[idx].toFixed(1);
            return `기여액: ${formatKpi(context.raw)} (+${lift}% Lift)`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#94a3b8', font: { size: 11 } }
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: {
          color: '#94a3b8',
          font: { size: 11 },
          callback: (value) => new Intl.NumberFormat('ko-KR', { notation: 'compact' }).format(value)
        }
      }
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400" /> 프로모션 기여도 (Promotion Impact)
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {promoEffects.map(p => (
          <div key={p.name} className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 flex flex-col justify-between">
            <span className="text-xs text-slate-400 mb-1">{p.name}</span>
            <div className="flex items-end justify-between">
              <span className="text-slate-300 text-xs">Lift 효과</span>
              <span className="text-lg font-bold text-amber-400">+{Math.max(0, p.effectRatio).toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>

      <div className="p-5 bg-slate-900/90 rounded-xl border border-slate-800">
        <div className="h-64">
          <Bar data={data} options={options} />
        </div>
      </div>
    </div>
  );
}
