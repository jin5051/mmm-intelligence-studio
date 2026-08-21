import React from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { PieChart, BarChart2, Award } from 'lucide-react';

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
);

export default function ContributionChart({ mmmResult }) {
  if (!mmmResult || !mmmResult.channelMetrics || !mmmResult.summary) return null;

  const { channelMetrics, summary, isCpaMode, kpiTerms = { name: '매출액', roas: 'ROAS', unit: '₩' } } = mmmResult;
  const formatKpi = (val) => {
    if (kpiTerms.unit === '₩') return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(val || 0);
    return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(val || 0) + ' ' + kpiTerms.unit;
  };
  const formatSpend = (val) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(val || 0);

  const colors = [
    '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', 
    '#06b6d4', '#ef4444', '#14b8a6', '#f97316', '#6366f1', 
    '#84cc16', '#a855f7', '#fbbf24', '#f43f5e', '#38bdf8', 
    '#c084fc', '#fb923c', '#34d399', '#e879f9', '#818cf8'
  ];

  const doughnutLabels = [`자연 발생 ${kpiTerms.name} (Baseline)`, ...channelMetrics.map(m => m.channel)];
  const doughnutDataValues = [summary.baselineKPI || 0, ...channelMetrics.map(m => m.revenueContrib || 0)];
  const doughnutColors = ['#475569', ...channelMetrics.map((_, idx) => colors[idx % colors.length])];

  const doughnutData = {
    labels: doughnutLabels,
    datasets: [
      {
        data: doughnutDataValues,
        backgroundColor: doughnutColors,
        borderWidth: 2,
        borderColor: '#0f172a'
      }
    ]
  };

  const barData = {
    labels: channelMetrics.map(m => m.channel),
    datasets: [
      {
        label: '집행 광고비 (Spend)',
        data: channelMetrics.map(m => m.spend || 0),
        backgroundColor: 'rgba(71, 85, 105, 0.7)',
        borderRadius: 6,
        yAxisID: 'y'
      },
      {
        label: `추정 기여 ${kpiTerms.name} (Contrib)`,
        data: channelMetrics.map(m => m.revenueContrib || 0),
        backgroundColor: channelMetrics.map((_, idx) => colors[idx % colors.length]),
        borderRadius: 6,
        yAxisID: isCpaMode ? 'y1' : 'y'
      }
    ]
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#cbd5e1', font: { size: 11 } } },
      tooltip: {
        callbacks: {
          label: (context) => {
            const val = context.parsed.y;
            if (context.datasetIndex === 0) return `${context.dataset.label}: ${formatSpend(val)}`;
            return `${context.dataset.label}: ${formatKpi(val)}`;
          }
        }
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 11 } } },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: {
          color: '#94a3b8',
          font: { size: 10 },
          callback: (value) => (value / 10000).toLocaleString() + '만'
        }
      },
      ...(isCpaMode ? {
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          grid: { drawOnChartArea: false }, // avoid overlapping grids
          ticks: {
            color: '#94a3b8',
            font: { size: 10 },
            callback: (value) => new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(value)
          }
        }
      } : {})
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      
      {/* 1. Contribution Share Doughnut */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col">
        <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
          <PieChart className="w-5 h-5 text-indigo-400" /> {kpiTerms.name} 발생 기여도 비중 (%)
        </h3>
        <p className="text-xs text-slate-400 mb-4">브랜드 자연 발생 {kpiTerms.name}(Baseline) 및 매체별 기여 비율</p>
        <div className="h-80 w-full relative flex items-center justify-center">
          <Doughnut data={doughnutData} options={{ 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
              legend: { position: 'right', labels: { color: '#cbd5e1', font: { size: 10 } } },
              tooltip: {
                callbacks: {
                  label: (context) => {
                    let label = context.label || '';
                    if (label) label += ': ';
                    const val = context.raw || 0;
                    const total = context.chart._metasets[context.datasetIndex].total;
                    const percentage = total > 0 ? ((val / total) * 100).toFixed(1) + '%' : '0%';
                    
                    if (kpiTerms.unit === '₩') {
                      label += new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(val);
                    } else {
                      label += new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(val) + ' ' + kpiTerms.unit;
                    }
                    label += ` (${percentage})`;
                    return label;
                  }
                }
              }
            } 
          }} />
        </div>
      </div>

      {/* 2. Spend vs Revenue Contribution Bar */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col lg:col-span-2">
        <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
          <BarChart2 className="w-5 h-5 text-emerald-400" /> 매체별 광고 지출액 vs 창출 {kpiTerms.name} 비교
        </h3>
        <p className="text-xs text-slate-400 mb-4">광고 집행 금액 대비 각 매체가 실제로 견인한 {kpiTerms.name} 성과 비교</p>
        <div className="h-80 w-full">
          <Bar data={barData} options={barOptions} />
        </div>
      </div>

      {/* 3. Detailed Channel ROAS Scorecard Table */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 lg:col-span-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
          <Award className="w-4 h-4 text-amber-400" /> 매체별 상세 {kpiTerms.roas} & 기여도 스코어카드
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">광고 매체 (Channel)</th>
                <th className="px-4 py-3">총 집행 광고비 (Spend)</th>
                <th className="px-4 py-3">예상 {kpiTerms.name} 기여분</th>
                <th className="px-4 py-3">매체 추정 {kpiTerms.roas}</th>
                <th className="px-4 py-3">광고비 비중 (SoS)</th>
                <th className="px-4 py-3">{kpiTerms.name} 기여 비중 (SoC)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200 font-mono">
              {channelMetrics.map((item, idx) => {
                const roasVal = Number(item.avgRoas ?? item.roas) || 0;
                const sosVal = Number(item.shareOfSpend) || 0;
                const socVal = Number(item.shareOfContrib) || 0;

                return (
                  <tr key={item.channel} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3 font-sans font-bold flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors[idx % colors.length] }} />
                      {item.channel}
                    </td>
                    <td className="px-4 py-3">{formatSpend(item.spend)}</td>
                    <td className="px-4 py-3 text-emerald-400 font-bold">{formatKpi(item.revenueContrib)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded font-bold ${roasVal >= 3.0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-blue-500/20 text-blue-400'}`}>
                        {isCpaMode ? `${roasVal.toFixed(2)} ${kpiTerms.unit}/100만` : `${roasVal.toFixed(2)}x`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{sosVal.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-indigo-400 font-bold">{socVal.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
