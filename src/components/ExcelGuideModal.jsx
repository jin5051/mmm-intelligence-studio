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
            <li><strong>최소 권장 기간:</strong> <strong>최소 1년(52주)</strong> 이상의 일별(Daily) 또는 주별(Weekly) 데이터를 권장합니다.</li>
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
            <Sparkles className="w-4 h-4" /> 3. 자동 추출되는 4대 시즈널리티(Seasonality) 파생 변수
          </h3>
          <p className="text-xs text-slate-300 mb-4 leading-relaxed">
            사용자가 엑셀에 시즈널리티 컬럼을 직접 넣지 않아도, **MMM 엔진이 <code>date</code> 컬럼을 분석하여** 아래의 통계 제어 변수를 회귀 모델에 자동으로 합성합니다:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
              <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white mb-1">📅 월별 시즈널리티 (Month Seasonality)</h4>
                <p className="text-[11px] text-slate-400">1월~12월 계절에 따른 {kpiName} 변동 요인(예: 겨울 12월 크리스마스 효과, 여름 7월 휴가철 효과)을 머신러닝이 자동 분리합니다.</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
              <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white mb-1">🏖️ 계절별 변수 (Spring/Summer/Autumn/Winter)</h4>
                <p className="text-[11px] text-slate-400">봄(3~5월), 여름(6~8월), 가을(9~11월), 겨울(12~2월) 계절적 변동을 모델의 Baseline 변동에 반영하여 순수 광고 성과를 왜곡 없이 추정합니다.</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
              <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white mb-1">🍻 주중 vs 주말 (Weekend Effect)</h4>
                <p className="text-[11px] text-slate-400">토/일요일에 자연 발생하는 {kpiName}을 자동으로 분리하여, 주말 광고 집행 성과가 과대평가되는 것을 방지합니다.</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white mb-1">🗓️ 요일별 및 주말 이월 (Day-of-Week Effect)</h4>
                <p className="text-[11px] text-slate-400">월요일부터 일요일까지 요일별 구매 행동 패턴을 독립 계수로 산출하여 마케터에게 최고의 광고 요일을 안내합니다.</p>
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
