import React from 'react';
import { X, Download, CheckCircle2, Calendar, Layers, Table, Sparkles } from 'lucide-react';
import { downloadSampleExcel } from '../utils/sampleDataGenerator';

export default function ExcelGuideModal({ isOpen, onClose, selectedKpiType = 'revenue' }) {
  if (!isOpen) return null;

  const getKpiName = (type) => {
    switch (type) {
      case 'purchase': return '구매수';
      case 'traffic': return '유입수';
      case 'install': return '앱설치수';
      case 'lead': return '잠재고객수';
      case 'revenue':
      default: return '매출액';
    }
  };
  const kpiName = getKpiName(selectedKpiType);
  const getSampleVal = (base) => {
    switch (selectedKpiType) {
      case 'purchase': return (base / 180000).toLocaleString();
      case 'traffic': return (base / 3600).toLocaleString();
      case 'install': return (base / 60000).toLocaleString();
      case 'lead': return (base / 360000).toLocaleString();
      case 'revenue':
      default: return base.toLocaleString();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="glass-panel w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 p-6 md:p-8 text-slate-100 shadow-2xl relative">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
          <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
            <Table className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">데이터 업로드 가이드 & 시즈널리티 자동 파생 안내</h2>
            <p className="text-xs text-slate-400">성공적인 MMM 분석을 위한 데이터 준비 가이드</p>
          </div>
        </div>

        {/* Section 0: Data Requirements */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-rose-400 flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4" /> 1. 필수 데이터 요구사항 (최소 기간)
          </h3>
          <p className="text-xs text-slate-300 mb-2 leading-relaxed">
            원활하고 신뢰성 있는 MMM 회귀 분석을 위해서는 <strong>충분한 시계열 데이터</strong>가 필요합니다.
          </p>
          <ul className="list-disc list-inside text-xs text-slate-400 space-y-1 ml-2">
            <li><strong>최소 권장 기간:</strong> <strong>최소 1년(52주)</strong> 이상을 권장합니다. 8주 미만은 분석할 수 없습니다.</li>
            <li><strong>입력 단위:</strong> <strong>일 단위(하루 1행)</strong>로 올리면 분석할 때 자동으로 <strong>주 단위(월~일)</strong>로 합산합니다. 첫 주·마지막 주가 7일이 안 되면 제외하고, 같은 날짜가 여러 행이면 합산합니다. 이미 주 단위로 만든 파일도 그대로 올리면 됩니다.</li>
            <li><strong>광고비 변화:</strong> 주마다 광고비가 거의 같으면 효과를 구분하기 어렵습니다. 증액·감액·중단한 주가 섞여 있을수록 결과가 정확해집니다.</li>
            <li><strong>이유:</strong> 시즈널리티(계절성) 및 매체별 이월 효과(Adstock)를 통계적으로 유의미하게 파악하려면 사계절을 모두 포함하는 데이터가 있어야 합니다.</li>
            <li>데이터 기간이 짧을 경우(예: 3~6개월), 모델의 신뢰구간(95% CI)이 넓어지고 한계 기여도 예측의 오차가 커질 수 있습니다.</li>
          </ul>
        </div>

        {/* Section 1: Recommended Excel Structure */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-blue-400 flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4" /> 2. 엑셀 파일 헤더 구성 및 매체 자동 그룹핑(Mapping) 팁
          </h3>
          <p className="text-xs text-slate-300 mb-4 leading-relaxed">
            필수 컬럼은 **일자**, **{kpiName}**, **매체별 광고비**입니다. 
            추가로 **노출수/클릭수**를 분석하려면 매체명을 괄호 <code>( )</code>로 묶어주시면 시스템이 동일 매체로 **자동 식별**합니다. (예: <code>(Meta)광고비</code>, <code>(Meta)노출수</code>, <code>(Meta)클릭수</code>) <br/>
            또한, 서로 다른 성격의 프로모션이나 이벤트가 있다면 **최대 3개의 프로모션 컬럼**을 만들어 별도로 분석할 수 있습니다.
          </p>

          <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-900/80 p-1 mb-4">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-800 text-slate-200 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="px-2 py-3 border-r border-slate-700">일자</th>
                  <th className="px-2 py-3 border-r border-slate-700">{kpiName}</th>
                  <th className="px-2 py-3 border-r border-slate-700 text-amber-300">프로모션A (여름)</th>
                  <th className="px-2 py-3 border-r border-slate-700 text-amber-300">프로모션B (할인)</th>
                  <th className="px-2 py-3 border-r border-slate-700 text-blue-300">(Meta) 비용</th>
                  <th className="px-2 py-3 border-r border-slate-700 text-blue-300">(Meta) 노출수</th>
                  <th className="px-2 py-3 border-r border-slate-700 text-emerald-300">(Google) 비용</th>
                  <th className="px-2 py-3 text-emerald-300">(Google) 클릭수</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300 font-mono text-[10px]">
                <tr>
                  <td className="px-2 py-2 border-r border-slate-800">2024-05-01</td>
                  <td className="px-2 py-2 border-r border-slate-800 text-emerald-400">{getSampleVal(18500000)}</td>
                  <td className="px-2 py-2 border-r border-slate-800 text-center">0</td>
                  <td className="px-2 py-2 border-r border-slate-800 text-center">1</td>
                  <td className="px-2 py-2 border-r border-slate-800">1,500,000</td>
                  <td className="px-2 py-2 border-r border-slate-800">150,000</td>
                  <td className="px-2 py-2 border-r border-slate-800">2,500,000</td>
                  <td className="px-2 py-2">25,000</td>
                </tr>
                <tr className="bg-slate-800/30">
                  <td className="px-2 py-2 border-r border-slate-800">2024-05-02</td>
                  <td className="px-2 py-2 border-r border-slate-800 text-emerald-400">{getSampleVal(17800000)}</td>
                  <td className="px-2 py-2 border-r border-slate-800 text-center">0</td>
                  <td className="px-2 py-2 border-r border-slate-800 text-center">1</td>
                  <td className="px-2 py-2 border-r border-slate-800">1,400,000</td>
                  <td className="px-2 py-2 border-r border-slate-800">140,000</td>
                  <td className="px-2 py-2 border-r border-slate-800">2,400,000</td>
                  <td className="px-2 py-2">24,000</td>
                </tr>
                <tr>
                  <td className="px-2 py-2 border-r border-slate-800">2024-05-03</td>
                  <td className="px-2 py-2 border-r border-slate-800 text-emerald-400">{getSampleVal(19200000)}</td>
                  <td className="px-2 py-2 border-r border-slate-800 text-center">0</td>
                  <td className="px-2 py-2 border-r border-slate-800 text-center">1</td>
                  <td className="px-2 py-2 border-r border-slate-800">1,600,000</td>
                  <td className="px-2 py-2 border-r border-slate-800">160,000</td>
                  <td className="px-2 py-2 border-r border-slate-800">2,600,000</td>
                  <td className="px-2 py-2">26,000</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => downloadSampleExcel(selectedKpiType)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow hover:shadow-emerald-500/20 transition"
            >
              <Download className="w-4 h-4" />
              추천 포맷 엑셀 샘플 파일 다운로드 (.xlsx)
            </button>
          </div>
        </div>

        {/* Section 2: Seasonality Auto Feature Engineering */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-purple-400 flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4" /> 3. 날짜만 있으면 자동으로 처리되는 항목
          </h3>
          <p className="text-xs text-slate-300 mb-4 leading-relaxed">
            계절성 컬럼을 따로 넣지 않아도 엔진이 날짜를 이용해 아래를 처리합니다:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
              <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white mb-1">📈 기저 추세 (Knots)</h4>
                <p className="text-[11px] text-slate-400">약 12주 간격의 매듭(knot)을 선으로 잇는 기저선으로 성장 추세와 계절 변동을 흡수해, 성수기 매출이 광고 효과로 잘못 잡히는 것을 줄입니다 (Meridian 방식).</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
              <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white mb-1">🏖️ 계절별 기저선 비교 (봄/여름/가을/겨울)</h4>
                <p className="text-[11px] text-slate-400">모델이 추정한 기저선(광고 제외)을 봄(3~5월)·여름(6~8월)·가을(9~11월)·겨울(12~2월)별로 평균 내 계절별 자연 발생 수준을 보여줍니다.</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
              <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white mb-1">🍻 주말·월초·월말 패턴 (참고 지표)</h4>
                <p className="text-[11px] text-slate-400">일 데이터에서 요일별·날짜별 {kpiName} 패턴을 따로 계산합니다. 주 단위 합계에서는 요일 차이가 상쇄되므로 모델 계산에는 들어가지 않는 참고 지표입니다.</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white mb-1">🗓️ 프로모션 주간 환산</h4>
                <p className="text-[11px] text-slate-400">일별 프로모션 표시(0/1)는 주마다 진행한 일수(0~7일)로 바꿔 모델에 넣고, 프로모션 1일당 효과와 전체 기여를 추정합니다.</p>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg transition"
          >
            확인했습니다 (닫기)
          </button>
        </div>

      </div>
    </div>
  );
}
