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

  const { dates, actualKPI, predictedKPI, yUpper95, yLower95, channelMetrics = [], summary = {}, modelInfo = {}, isCpaMode, kpiTerms = { name: '매출액', roas: 'ROAS', unit: '₩' } } = mmmResult;
  const fmtEff = (v) => isCpaMode
    ? new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(Number(v) || 0) + ` ${kpiTerms.unit}`
    : (Number(v) || 0).toFixed(2) + 'x';
  const fmtKpi = (v) => kpiTerms.unit === '₩'
    ? new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(v || 0)
    : new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(v || 0) + ' ' + kpiTerms.unit;

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
        label: '사후평균 예측 (Predicted Mean)',
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
          <ShieldCheck className="w-5 h-5 text-purple-400" /> 사후분포 기반 95% 예측 구간 (MCMC)
        </h3>
        <p className="text-xs text-slate-400">
          MCMC 사후표본 {modelInfo.derivedDraws || ''}개로 계산한 주별 95% 예측 구간입니다 (파라미터 불확실성 + 잡음 포함). 
          실제 KPI가 구간 안에 들어온 비율은 <strong className="text-purple-300">{(Number(summary.ciCoverage) || 0).toFixed(0)}%</strong>이며, 95%에 가까울수록 불확실성을 제대로 표현하고 있다는 뜻입니다.
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

      {/* 매체별 ROI 사후분포 */}
      {channelMetrics.length > 0 && (
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 shadow-xl">
          <h4 className="text-sm font-bold text-white mb-1">매체별 {isCpaMode ? `효율(100만원당 ${kpiTerms.name})` : 'ROI(ROAS)'} 95% 신뢰구간</h4>
          <p className="text-[11px] text-slate-400 mb-4">구간이 넓을수록 데이터만으로는 효과를 확신하기 어렵다는 뜻입니다. 사전분포 중앙값은 분석 전에 가정한 값입니다.<br />R-hat은 계산이 한 결과로 제대로 모였는지 보는 수렴 지표로, 1.1 이하면 신뢰할 수 있고, 넘으면(주황색) 결과가 불안정하다는 뜻입니다.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">매체</th>
                  <th className="px-4 py-3">추정값(평균)</th>
                  <th className="px-4 py-3">95% 구간</th>
                  <th className="px-4 py-3">기여 {kpiTerms.name} 95% 구간</th>
                  <th className="px-4 py-3">사전분포 중앙값</th>
                  <th className="px-4 py-3">R-hat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200 font-mono">
                {channelMetrics.map(m => (
                  <tr key={m.channel}>
                    <td className="px-4 py-3 font-sans font-bold">{m.channel}</td>
                    <td className="px-4 py-3 text-emerald-400 font-bold">{fmtEff(m.avgRoas)}</td>
                    <td className="px-4 py-3">{m.avgRoasCI ? `${fmtEff(m.avgRoasCI[0])} ~ ${fmtEff(m.avgRoasCI[1])}` : '-'}</td>
                    <td className="px-4 py-3">{m.contribCI ? `${fmtKpi(m.contribCI[0])} ~ ${fmtKpi(m.contribCI[1])}` : '-'}</td>
                    <td className="px-4 py-3 text-slate-400">{m.priorConfig?.roiMedian != null ? fmtEff(m.priorConfig.roiMedian) : '-'}</td>
                    <td className={`px-4 py-3 ${Number(m.rhat) <= 1.1 ? 'text-slate-300' : 'text-amber-400'}`}>{Number.isFinite(m.rhat) ? m.rhat.toFixed(2) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
