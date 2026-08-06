import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { Filter, Info, BarChart3, MessageCircle } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend);

// Pearson Correlation helper
function pearsonCorrelation(xArr, yArr) {
  const n = xArr.length;
  if (n < 3) return 0;

  const meanX = xArr.reduce((a, b) => a + b, 0) / n;
  const meanY = yArr.reduce((a, b) => a + b, 0) / n;

  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xArr[i] - meanX;
    const dy = yArr[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
}

function getCorrelationLabel(r) {
  const abs = Math.abs(r);
  if (abs >= 0.7) return '강한 상관';
  if (abs >= 0.4) return '보통 상관';
  if (abs >= 0.2) return '약한 상관';
  return '무상관';
}

function getCorrelationColor(r) {
  const abs = Math.abs(r);
  if (abs >= 0.7) return r > 0 ? 'text-emerald-400' : 'text-rose-400';
  if (abs >= 0.4) return r > 0 ? 'text-blue-400' : 'text-amber-400';
  return 'text-slate-400';
}

function getCorrelationBgColor(r) {
  const abs = Math.abs(r);
  if (abs >= 0.7) return r > 0 ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-rose-500/20 border-rose-500/30';
  if (abs >= 0.4) return r > 0 ? 'bg-blue-500/20 border-blue-500/30' : 'bg-amber-500/20 border-amber-500/30';
  return 'bg-slate-800/50 border-slate-700/50';
}

export default function FunnelEfficiencyTab({ mmmResult }) {
  if (!mmmResult) return null;

  const { channelMetrics, rawSpends, rawImpressions, rawClicks, transformedMedia, coefficients, kpiTerms = { name: '매출액', roas: 'ROAS', unit: '₩' } } = mmmResult;
  const hasFunnelData = channelMetrics.some(m => m.totImp > 0 || m.totClk > 0);
  const formatKrw = (val) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(val);

  // Compute daily-level funnel metrics & correlations per channel
  const correlationData = useMemo(() => {
    if (!hasFunnelData) return [];

    return channelMetrics.map(m => {
      const col = m.channel;
      const dailyImp = rawImpressions?.[col] || [];
      const dailyClk = rawClicks?.[col] || [];
      const dailyTransformed = transformedMedia?.[col] || [];
      const coef = coefficients?.[col] || 0;

      const n = dailyImp.length;
      
      // Compute daily impressions, clicks, CTR, and daily media contribution
      const dailyCTR = [];
      const dailyContrib = [];

      for (let i = 0; i < n; i++) {
        const imp = dailyImp[i] || 0;
        const clk = dailyClk[i] || 0;
        const contrib = (dailyTransformed[i] || 0) * coef;

        dailyCTR.push(imp > 0 ? (clk / imp) * 100 : 0);
        dailyContrib.push(contrib);
      }

      // Filter out zero rows for valid correlation
      const validIdxImp = dailyImp.map((v, i) => i).filter(i => dailyImp[i] > 0 && dailyContrib[i] > 0);
      const validIdxClk = dailyClk.map((v, i) => i).filter(i => dailyClk[i] > 0 && dailyContrib[i] > 0);
      const validIdxCTR = dailyCTR.map((v, i) => i).filter(i => dailyCTR[i] > 0 && dailyContrib[i] > 0);

      const rImp = pearsonCorrelation(
        validIdxImp.map(i => dailyImp[i]),
        validIdxImp.map(i => dailyContrib[i])
      );
      const rClk = pearsonCorrelation(
        validIdxClk.map(i => dailyClk[i]),
        validIdxClk.map(i => dailyContrib[i])
      );
      const rCTR = pearsonCorrelation(
        validIdxCTR.map(i => dailyCTR[i]),
        validIdxCTR.map(i => dailyContrib[i])
      );

      // Find strongest correlation
      const correlations = [
        { metric: '노출수', key: 'imp', r: rImp },
        { metric: '클릭수', key: 'clk', r: rClk },
        { metric: 'CTR', key: 'ctr', r: rCTR }
      ];
      const strongest = correlations.reduce((a, b) => Math.abs(a.r) > Math.abs(b.r) ? a : b);

      return {
        channel: col,
        mRoas: m.mRoas,
        rImp, rClk, rCTR,
        strongest,
        totImp: m.totImp, totClk: m.totClk, spend: m.spend,
        avgCTR: m.ctr
      };
    });
  }, [mmmResult]);

  // Colors for channels
  const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899'];

  // Correlation Heatmap Bar Data
  const heatmapData = {
    labels: correlationData.map(d => d.channel),
    datasets: [
      {
        label: '노출수 ↔ 기여도',
        data: correlationData.map(d => d.rImp),
        backgroundColor: '#3b82f680',
        borderColor: '#3b82f6',
        borderWidth: 1,
        borderRadius: 4
      },
      {
        label: '클릭수 ↔ 기여도',
        data: correlationData.map(d => d.rClk),
        backgroundColor: '#8b5cf680',
        borderColor: '#8b5cf6',
        borderWidth: 1,
        borderRadius: 4
      },
      {
        label: 'CTR ↔ 기여도',
        data: correlationData.map(d => d.rCTR),
        backgroundColor: '#10b98180',
        borderColor: '#10b981',
        borderWidth: 1,
        borderRadius: 4
      }
    ]
  };

  const heatmapOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: { labels: { color: '#cbd5e1', font: { size: 11 } } },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: r = ${ctx.parsed.x.toFixed(3)} (${getCorrelationLabel(ctx.parsed.x)})`
        }
      }
    },
    scales: {
      x: {
        min: -1, max: 1,
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#64748b', font: { size: 10 } },
        title: { display: true, text: 'Pearson 상관계수 (r)', color: '#94a3b8', font: { size: 11 } }
      },
      y: {
        grid: { display: false },
        ticks: { color: '#94a3b8', font: { size: 11 } }
      }
    }
  };

  // Generate interpretation text per channel
  function getInterpretation(item) {
    const { strongest, channel } = item;
    const absR = Math.abs(strongest.r);
    const strength = getCorrelationLabel(strongest.r);

    if (strongest.key === 'imp') {
      return {
        finding: `${channel}은 노출수(Impressions)와 ${kpiTerms.name} 기여도의 상관이 가장 높습니다 (r = ${strongest.r.toFixed(3)}, ${strength}).`,
        meaning: `노출이 많은 날일수록 ${kpiTerms.name} 기여도가 높아지는 패턴으로, 이 매체는 사용자에게 광고를 보여주는 것 자체가 ${kpiTerms.name} 향상에 기여하고 있습니다.`,
        strategy: absR >= 0.4
          ? '영상 조회수 극대화, 브랜디드 컨텐츠 노출 확대, 디스플레이 도달(Reach) 캠페인 등 노출 볼륨을 늘릴 수 있는 운영 전략이 필요합니다. CPM 효율적인 지면을 확보하여 동일 예산 대비 더 많은 노출을 확보하세요.'
          : '노출과의 상관이 약하므로, 단순 노출 확대보다는 타겟팅 정밀도를 높이는 방향이 효율적입니다.'
      };
    } else if (strongest.key === 'clk') {
      return {
        finding: `${channel}은 클릭수(Clicks)와 ${kpiTerms.name} 기여도의 상관이 가장 높습니다 (r = ${strongest.r.toFixed(3)}, ${strength}).`,
        meaning: `클릭이 많은 날일수록 ${kpiTerms.name} 기여도가 높아지는 패턴으로, 이 매체는 사용자를 사이트/앱으로 유입시키는 것이 ${kpiTerms.name}의 핵심 동인입니다.`,
        strategy: absR >= 0.4
          ? '유입(Traffic)을 극대화할 수 있는 전략이 필요합니다. 클릭 유도형 CTA 강화, 검색 광고 키워드 확장, 리타겟팅 캠페인 강화, 랜딩 페이지 최적화 등을 통해 클릭 볼륨을 높이세요.'
          : '클릭과의 상관이 약하므로, 클릭 수 자체보다는 클릭 품질(전환율) 관리에 집중하는 것이 효과적입니다.'
      };
    } else {
      return {
        finding: `${channel}은 CTR(클릭률)과 ${kpiTerms.name} 기여도의 상관이 가장 높습니다 (r = ${strongest.r.toFixed(3)}, ${strength}).`,
        meaning: `CTR이 높은 날일수록 ${kpiTerms.name} 기여도가 높아지는 패턴으로, 이 매체는 노출 대비 클릭 효율(소재 품질)이 ${kpiTerms.name}을 좌우합니다.`,
        strategy: absR >= 0.4
          ? '클릭률(CTR)을 높일 수 있는 전략이 필요합니다. A/B 테스트를 통한 광고 소재 최적화, 타겟 오디언스 정교화, 광고 문구/이미지/영상 크리에이티브 개선, 관련성 높은 키워드 집중 등으로 CTR을 향상시키세요.'
          : 'CTR과의 상관이 약하므로, 소재 최적화보다는 노출량이나 유입 볼륨 자체를 늘리는 전략이 더 유효할 수 있습니다.'
      };
    }
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Header Info */}
      <div className="p-5 bg-slate-900/90 rounded-2xl border border-slate-800">
        <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
          <Filter className="w-5 h-5 text-amber-400" /> 퍼널 지표 × {kpiTerms.name} 기여도 상관관계 분석
        </h3>
        <p className="text-xs text-slate-400">
          매체별 퍼널 지표(노출수, 클릭수, CTR)와 Meridian 일별 {kpiTerms.name} 기여도 간 Pearson 상관계수를 산출하여, 
          어떤 퍼널 단계가 실제 {kpiTerms.name} 기여와 가장 밀접한지 분석하고 운영 전략을 제안합니다.
        </p>

        {/* 초보자용 설명 */}
        <div className="mt-3 p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
          <p className="text-[11px] font-semibold text-slate-300 mb-2">📖 퍼널 지표 & 상관관계 용어 안내</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] text-slate-400">
            <div className="flex items-start gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 mt-1" />
              <span><strong className="text-slate-200">노출수 (Impressions)</strong> : 광고가 사용자에게 보여진 횟수. 브랜드 인지, 영상 조회 등 상단 퍼널과 연관</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 mt-1" />
              <span><strong className="text-slate-200">클릭수 (Clicks)</strong> : 사용자가 광고를 클릭하여 사이트/앱으로 유입된 횟수. 중단 퍼널과 연관</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1" />
              <span><strong className="text-slate-200">CTR (클릭률)</strong> : 노출 대비 클릭 비율(%). 광고 소재 품질과 타겟팅 정확도를 반영</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-1" />
              <span><strong className="text-slate-200">상관계수 (r)</strong> : -1 ~ +1 범위. |r| ≥ 0.7 강한 상관, ≥ 0.4 보통, &lt; 0.2 무상관</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
            💡 <strong className="text-slate-400">쉽게 말하면:</strong> 노출이 많은 날 {kpiTerms.name}도 높았다면 → 노출 확대 전략, 
            클릭이 많은 날 {kpiTerms.name}도 높았다면 → 유입 극대화 전략, 
            CTR이 높은 날 {kpiTerms.name}도 높았다면 → 소재/타겟팅 최적화 전략이 필요합니다.
          </p>
        </div>
      </div>

      {/* Correlation Heatmap Bar Chart */}
      {hasFunnelData && correlationData.length > 0 && (
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 shadow-xl">
          <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-blue-400" /> 매체별 퍼널 지표 ↔ 일별 {kpiTerms.name} 기여도 상관계수 (Pearson r)
          </h4>
          <div className="h-52 w-full">
            <Bar data={heatmapData} options={heatmapOptions} />
          </div>
          <p className="text-[10px] text-slate-500 mt-3">
            ※ 양(+) 방향: 해당 지표가 높은 날 기여도도 높음 | 음(-) 방향: 반비례 | |r| ≥ 0.7: 강한 상관 | |r| ≥ 0.4: 보통 상관
          </p>
        </div>
      )}

      {/* Per-Channel Funnel Metrics Summary Table */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 shadow-xl">
        <h4 className="text-sm font-bold text-white mb-4">매체별 퍼널 지표 요약</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">광고 매체</th>
                <th className="px-4 py-3">총 노출수</th>
                <th className="px-4 py-3">총 클릭수</th>
                <th className="px-4 py-3">평균 CTR</th>
                <th className="px-4 py-3">mROAS</th>
                <th className="px-4 py-3">핵심 상관 지표</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200 font-mono">
              {correlationData.map((item, idx) => (
                <tr key={item.channel} className="hover:bg-slate-800/40 transition">
                  <td className="px-4 py-3 font-sans font-bold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colors[idx % colors.length] }} />
                    {item.channel}
                  </td>
                  <td className="px-4 py-3 text-blue-400">{item.totImp > 0 ? item.totImp.toLocaleString() : '미입력'}</td>
                  <td className="px-4 py-3 text-indigo-400">{item.totClk > 0 ? item.totClk.toLocaleString() : '미입력'}</td>
                  <td className="px-4 py-3 text-emerald-400 font-bold">{item.avgCTR > 0 ? `${item.avgCTR.toFixed(2)}%` : '-'}</td>
                  <td className="px-4 py-3 text-amber-400 font-bold">{item.mRoas?.toFixed(2)}x</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getCorrelationBgColor(item.strongest.r)}`}>
                      {item.strongest.metric} (r={item.strongest.r.toFixed(2)})
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-Channel Correlation Interpretation & Strategy */}
      {hasFunnelData && correlationData.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-emerald-400" /> 매체별 퍼널 상관관계 해석 & 운영 전략 제안
          </h4>

          {correlationData.map((item, idx) => {
            const interp = getInterpretation(item);

            return (
              <div key={item.channel} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: colors[idx % colors.length] }} />
                
                <div className="pl-3">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-sm font-bold text-white">{item.channel}</h5>
                    <div className="flex gap-3 text-[10px] font-mono">
                      <span className={getCorrelationColor(item.rImp)}>노출 r={item.rImp.toFixed(2)}</span>
                      <span className={getCorrelationColor(item.rClk)}>클릭 r={item.rClk.toFixed(2)}</span>
                      <span className={getCorrelationColor(item.rCTR)}>CTR r={item.rCTR.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {/* Finding */}
                    <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        📊 <strong className="text-white">분석 결과:</strong> {interp.finding}
                      </p>
                    </div>

                    {/* Meaning */}
                    <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700/30">
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        🔍 <strong className="text-slate-300">해석:</strong> {interp.meaning}
                      </p>
                    </div>

                    {/* Strategy */}
                    <div className={`p-3 rounded-lg border ${getCorrelationBgColor(item.strongest.r)}`}>
                      <p className="text-[11px] text-emerald-300 leading-relaxed">
                        💡 <strong className="text-white">운영 전략 제안:</strong> {interp.strategy}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!hasFunnelData && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-amber-300">💡 데이터 안내:</strong> 엑셀에 <code>meta_impressions</code>, <code>meta_clicks</code>와 같은 노출/클릭 컬럼을 추가하시면 퍼널 × {kpiTerms.name} 기여도 상관관계 분석이 자동으로 완성됩니다.
          </div>
        </div>
      )}

    </div>
  );
}
