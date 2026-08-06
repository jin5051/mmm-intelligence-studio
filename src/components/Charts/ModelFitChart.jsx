import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { LineChart as LineIcon } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function ModelFitChart({ mmmResult }) {
  if (!mmmResult) return null;

  const { dates, actualKPI, predictedKPI } = mmmResult;

  const data = {
    labels: dates,
    datasets: [
      {
        label: '실제 KPI (Actual)',
        data: actualKPI,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.08)',
        borderWidth: 2,
        pointRadius: 1.5,
        tension: 0.35,
        fill: true
      },
      {
        label: 'Meridian 모델 예측 KPI (Predicted)',
        data: predictedKPI,
        borderColor: '#a855f7',
        borderDash: [4, 4],
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.35,
        fill: false
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#cbd5e1',
          font: { size: 12, family: 'Inter' },
          usePointStyle: true
        }
      },
      tooltip: {
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        borderWidth: 1,
        titleColor: '#f8fafc',
        bodyColor: '#cbd5e1',
        padding: 12,
        callbacks: {
          label: (context) => {
            let label = context.dataset.label || '';
            if (label) label += ': ';
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(context.parsed.y);
            }
            return label;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#64748b', font: { size: 10 }, maxTicksLimit: 12 }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: {
          color: '#64748b',
          font: { size: 10 },
          callback: (value) => (value / 10000).toLocaleString() + '만'
        }
      }
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-6 border border-slate-800 shadow-xl mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <LineIcon className="w-5 h-5 text-blue-400" /> 실제 KPI vs Meridian 모델 예측 시계열 비교
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Hill 포화 변환 + Delayed Adstock + 시즈널리티 MAP 추정치가 반영된 모델 피팅 그래프입니다.</p>
        </div>
      </div>
      <div className="h-72 w-full">
        <Line data={data} options={options} />
      </div>
    </div>
  );
}
