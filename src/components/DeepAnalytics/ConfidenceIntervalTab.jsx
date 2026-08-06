import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { ShieldCheck } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
);

export default function ConfidenceIntervalTab({ mmmResult }) {
  if (!mmmResult) return null;

  const { dates, actualKPI, predictedKPI, yUpper95, yLower95, kpiTerms = { name: '매출액', roas: 'ROAS', unit: '₩' } } = mmmResult;

  const data = {
    labels: dates,
    datasets: [
      {
        label: '실제 KPI (Actual)',
        data: actualKPI,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        pointRadius: 1.5,
        fill: false
      },
      {
        label: 'Meridian 추정 평균 (Predicted Mean)',
        data: predictedKPI,
        borderColor: '#a855f7',
        borderDash: [4, 4],
        borderWidth: 2,
        pointRadius: 0,
        fill: false
      },
      {
        label: '95% 상한 신뢰구간 (Upper 95% CI)',
        data: yUpper95,
        borderColor: 'rgba(168, 85, 247, 0.4)',
        borderWidth: 1,
        pointRadius: 0,
        fill: false
      },
      {
        label: '95% 하한 신뢰구간 (Lower 95% CI)',
        data: yLower95,
        borderColor: 'rgba(168, 85, 247, 0.4)',
        borderWidth: 1,
        pointRadius: 0,
        fill: false
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#cbd5e1', font: { size: 11 } } },
      tooltip: {
        callbacks: {
          label: (context) => {
            let val = context.parsed.y;
            return `${context.dataset.label}: ${new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(val)}`;
          }
        }
      }
    },
    scales: {
      x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#64748b', font: { size: 10 } } },
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
          <ShieldCheck className="w-5 h-5 text-purple-400" /> Meridian MAP 추정 95% 베이지안 예측 신뢰구간 (95% CI)
        </h3>
        <p className="text-xs text-slate-400">
          통계적 노이즈 및 비측정 변수를 고려한 **95% 확률 신뢰 상한/하한 구역**입니다. 
          실제 타겟 KPI(Blue Line)가 신뢰구간 범위 내에 잘 포함되어 있는지 모델의 안정성을 검증합니다.
        </p>

        {/* 초보자용 설명 */}
        <div className="mt-3 p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
          <p className="text-[11px] font-semibold text-slate-300 mb-2">📖 신뢰구간 용어 안내</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] text-slate-400">
            <div className="flex items-start gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 mt-1" />
              <span><strong className="text-slate-200">파란 선 (실제 KPI)</strong> : 실제로 발생한 {kpiTerms.name} 데이터</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0 mt-1" />
              <span><strong className="text-slate-200">보라 점선 (예측 평균)</strong> : 모델이 추정한 예측값의 중심선</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-300 shrink-0 mt-1" />
              <span><strong className="text-slate-200">95% 상한/하한</strong> : 모델이 "95% 확률로 이 범위 안에 있을 것"이라고 예측하는 구간</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1" />
              <span><strong className="text-slate-200">모델 안정성</strong> : 파란 선이 상한/하한 안에 많이 들어있을수록 모델이 정확함</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
            💡 <strong className="text-slate-400">쉽게 말하면:</strong> 모델의 예측에는 항상 불확실성이 있습니다. 
            <strong className="text-purple-400">보라색 구간</strong>이 좁을수록 예측이 정확하고, 
            <strong className="text-blue-400">파란 실제값</strong>이 구간 바깥으로 자주 벗어나면 모델 개선이 필요합니다.
          </p>
        </div>
      </div>

      {/* Main Chart */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 shadow-xl">
        <div className="h-80 w-full">
          <Line data={data} options={options} />
        </div>
      </div>

    </div>
  );
}
