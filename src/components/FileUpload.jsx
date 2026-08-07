import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, Check, Sparkles, AlertCircle, ArrowRight, Info } from 'lucide-react';
import { generateSampleMMMData } from '../utils/sampleDataGenerator';

export default function FileUpload({ onAnalysisComplete, onOpenExcelGuide, onLoadDemo, selectedKpiType }) {
  const [fileName, setFileName] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const [columns, setColumns] = useState([]);
  
  // Column Selection States
  const [dateCol, setDateCol] = useState('');
  const [kpiCol, setKpiCol] = useState('');
  const [selectedMediaCols, setSelectedMediaCols] = useState([]);
  
  // Extra Meridian Columns
  const [promoCols, setPromoCols] = useState([]); // Up to 3
  const [geoCol, setGeoCol] = useState('');
  const [extraMediaCols, setExtraMediaCols] = useState({}); // { meta_spend: { imp: 'meta_imp', clk: 'meta_clk' } }
  
  const [errorMsg, setErrorMsg] = useState('');

  // Handle File Change
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setErrorMsg('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: false });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data = XLSX.utils.sheet_to_json(ws, { defval: 0 });

        if (!data || data.length === 0) {
          setErrorMsg('엑셀 파일에 데이터가 없습니다.');
          return;
        }

        const cols = Object.keys(data[0]);
        setColumns(cols);
        setParsedData(data);

        // Auto-Detect Columns
        autoDetectColumns(cols);
      } catch (err) {
        setErrorMsg('엑셀 파일을 읽는 중 오류가 발생했습니다: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Smart Auto-Detect Column Names & Parenthesis Grouping
  const autoDetectColumns = (cols) => {
    let dCol = cols.find(c => /date|일자|날짜|time/i.test(c)) || cols[0];
    let kCol = cols.find(c => /revenue|매출|sales|총매출|kpi|install|주문/i.test(c)) || cols[1];
    
    let pCols = cols.filter(c => /promo|프로모션|할인|이벤트/i.test(c)).slice(0, 3);
    let gCol = cols.find(c => /geo|지역|지점|region/i.test(c)) || '';

    // First detect media via (mediaName) parenthesis logic
    const mediaGroups = {};
    cols.forEach(c => {
      if (c === dCol || c === kCol || c === gCol || pCols.includes(c)) return;
      
      const match = c.match(/\((.*?)\)/);
      if (match) {
        const mediaName = match[1].toLowerCase();
        if (!mediaGroups[mediaName]) mediaGroups[mediaName] = { spend: '', imp: '', clk: '' };
        
        if (/spend|cost|비용|지출|광고비/i.test(c) || !/imp|click|노출|클릭/i.test(c)) {
          if (!mediaGroups[mediaName].spend) mediaGroups[mediaName].spend = c;
        }
        if (/imp|노출/i.test(c)) mediaGroups[mediaName].imp = c;
        if (/click|클릭/i.test(c)) mediaGroups[mediaName].clk = c;
      }
    });

    let detectedMediaCols = [];
    const extras = {};

    Object.values(mediaGroups).forEach(group => {
      if (group.spend) {
        detectedMediaCols.push(group.spend);
        extras[group.spend] = { impressions: group.imp || '', clicks: group.clk || '' };
      }
    });

    // Fallback detection if no parentheses used
    if (detectedMediaCols.length === 0) {
      detectedMediaCols = cols.filter(c => 
        c !== dCol && c !== kCol && !pCols.includes(c) && c !== gCol &&
        /spend|cost|광고비|비용|meta|google|naver|kakao|fb|ig|yt/i.test(c) && !/imp|click|노출|클릭/i.test(c)
      );

      detectedMediaCols.forEach(mCol => {
        const prefix = mCol.replace(/spend|cost|광고비|비용|_/gi, '').trim();
        const imp = cols.find(c => c.toLowerCase().includes(prefix.toLowerCase()) && /imp|노출/i.test(c));
        const clk = cols.find(c => c.toLowerCase().includes(prefix.toLowerCase()) && /click|클릭/i.test(c));
        
        extras[mCol] = { impressions: imp || '', clicks: clk || '' };
      });
    }

    setDateCol(dCol);
    setKpiCol(kCol);
    setPromoCols(pCols);
    setGeoCol(gCol);
    setExtraMediaCols(extras);
    
    // Fallback: exclude any column that sounds like date or kpi
    const safeFallbackCols = cols.filter(c => 
      c !== dCol && 
      c !== kCol && 
      !/date|일자|날짜|time|주차|월/i.test(c) && 
      !/revenue|매출|sales|총매출|kpi|install|주문|설치|유입|구매|잠재/i.test(c)
    ).slice(0,4);

    setSelectedMediaCols(detectedMediaCols.length > 0 ? detectedMediaCols : safeFallbackCols);
  };

  // Load Sample Instant Demo Data
  const handleLoadDemoData = () => {
    const sampleData = generateSampleMMMData(selectedKpiType);
    const cols = Object.keys(sampleData[0]);
    setFileName('MMM_Meridian_Sample_Data.xlsx (샘플)');
    setColumns(cols);
    setParsedData(sampleData);
    autoDetectColumns(cols);
    setErrorMsg('');
  };

  // Toggle Media Column
  const toggleMediaCol = (col) => {
    if (selectedMediaCols.includes(col)) {
      setSelectedMediaCols(selectedMediaCols.filter(c => c !== col));
    } else {
      setSelectedMediaCols([...selectedMediaCols, col]);
      if (!extraMediaCols[col]) {
        setExtraMediaCols({ ...extraMediaCols, [col]: { impressions: '', clicks: '' } });
      }
    }
  };

  const handlePromoChange = (idx, value) => {
    const newPromos = [...promoCols];
    newPromos[idx] = value;
    setPromoCols(newPromos.filter(Boolean));
  };

  const handleExtraMediaChange = (mediaCol, type, value) => {
    setExtraMediaCols({
      ...extraMediaCols,
      [mediaCol]: {
        ...extraMediaCols[mediaCol],
        [type]: value
      }
    });
  };

  // Execute Analysis
  const handleRunAnalysis = () => {
    if (!parsedData || !dateCol || !kpiCol || selectedMediaCols.length === 0) {
      setErrorMsg('일자, KPI 컬럼 및 1개 이상의 광고 매체 컬럼을 선택해 주세요.');
      return;
    }
    
    // Construct extraCols object
    const extraCols = { promoCols, geoCol };
    selectedMediaCols.forEach(mCol => {
      if (extraMediaCols[mCol]?.impressions) {
        extraCols[`${mCol}_impressions`] = extraMediaCols[mCol].impressions;
      }
      if (extraMediaCols[mCol]?.clicks) {
        extraCols[`${mCol}_clicks`] = extraMediaCols[mCol].clicks;
      }
    });

    onAnalysisComplete(parsedData, dateCol, kpiCol, selectedMediaCols, extraCols, selectedKpiType);
  };

  return (
    <div className="glass-panel rounded-2xl p-6 md:p-8 mb-8 border border-slate-800 shadow-xl">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 border-b border-slate-800/80 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-400" /> 데이터 파일 업로드 & 컬럼 매핑
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            광고 매체별 비용(Spend), KPI(매출/전환) 및 추가 변수(노출/클릭/프로모션) 엑셀을 업로드하세요.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenExcelGuide}
            className="text-xs text-blue-400 hover:text-blue-300 underline font-medium"
          >
            추천 포맷 및 작성 가이드 보기
          </button>
          <button
            onClick={handleLoadDemoData}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            샘플 데모 불러오기
          </button>
        </div>
      </div>

      {/* Quick Data Guide Banner */}
      <div className="mb-6 bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 flex gap-3">
        <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 leading-relaxed">
          <p className="font-semibold text-indigo-300 mb-1">💡 원활한 모델 학습을 위한 엑셀 작성 가이드</p>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>최소 필요 데이터:</strong> 시즈널리티(계절성) 분석을 위해 가급적 <strong>최소 1년(52주) 이상</strong>의 데이터를 권장합니다.</li>
            <li><strong>매체명 자동 묶음:</strong> 매체명은 괄호로 묶어야 합니다. <em>(예: <code>(meta) 광고비</code>, <code>(meta) 노출수</code>, <code>(meta) 클릭수</code>)</em></li>
            <li><strong>빈 셀 자동 처리:</strong> 데이터가 없는 공백이나 Null 값은 시스템이 자동으로 0으로 전처리하므로 신경쓰지 않으셔도 됩니다.</li>
          </ul>
        </div>
      </div>

      {/* Upload Dropzone */}
      <div className="relative group cursor-pointer mb-6">
        <input 
          type="file" 
          accept=".xlsx, .xls, .csv" 
          onChange={handleFileUpload} 
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <div className="p-8 border-2 border-dashed border-slate-700 group-hover:border-blue-500 rounded-xl bg-slate-900/50 group-hover:bg-slate-900/80 transition text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3 group-hover:scale-110 transition">
            <Upload className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-200">
            {fileName ? fileName : '엑셀 또는 CSV 파일을 이곳에 드래그하거나 클릭하세요'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            .xlsx, .xls, .csv 파일 지원 (업로드된 데이터는 외부 서버 전송 없이 브라우저에서 안전하게 처리됩니다)
          </p>
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="p-3 mb-6 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Column Mapping Section */}
      {parsedData && columns.length > 0 && (
        <div className="p-5 bg-slate-900/90 rounded-xl border border-slate-800 animate-fadeIn">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-400" /> 컬럼 매핑 (총 {parsedData.length}행 데이터)
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            
            {/* Target Variable Selection */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  📅 일자(Date) 컬럼 선택
                </label>
                <select
                  value={dateCol}
                  onChange={(e) => setDateCol(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  🎯 분석 목적 KPI (매출액/설치수/주문수 등)
                </label>
                <select
                  value={kpiCol}
                  onChange={(e) => setKpiCol(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-emerald-400 font-semibold focus:outline-none focus:border-emerald-500"
                >
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  🎉 프로모션/이벤트 컬럼 (최대 3개 선택)
                </label>
                <div className="space-y-2">
                  {[0, 1, 2].map(idx => (
                    <select
                      key={idx}
                      value={promoCols[idx] || ''}
                      onChange={(e) => handlePromoChange(idx, e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="">-- 프로모션 {idx + 1} (선택 안함) --</option>
                      {columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  ))}
                </div>
              </div>
            </div>

            {/* Media Spend Columns Checkboxes */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                📢 광고 매체 비용(Spend) 선택 & 노출/클릭 매핑
              </label>
              <div className="max-h-64 overflow-y-auto p-2 bg-slate-800/80 rounded-lg border border-slate-700 space-y-2">
                {columns.filter(c => {
                  // Collect all currently mapped impression and click columns
                  const mappedExtraCols = Object.values(extraMediaCols).flatMap(val => [val?.impressions, val?.clicks]).filter(Boolean);
                  return c !== dateCol && c !== kpiCol && !promoCols.includes(c) && c !== geoCol && !mappedExtraCols.includes(c);
                }).map(col => {
                  const isChecked = selectedMediaCols.includes(col);
                  const mappedExtraCols = Object.values(extraMediaCols).flatMap(val => [val?.impressions, val?.clicks]).filter(Boolean);
                  
                  return (
                    <div key={col} className={`flex flex-col gap-2 p-3 rounded-lg transition ${isChecked ? 'bg-blue-900/20 border border-blue-500/30' : 'hover:bg-slate-700/50 border border-transparent'}`}>
                      <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleMediaCol(col)}
                          className="rounded border-slate-600 text-blue-600 focus:ring-blue-500 bg-slate-900"
                        />
                        <span className="font-mono text-slate-300 font-bold">{col}</span>
                      </label>
                      
                      {isChecked && (
                        <div className="pl-6 grid grid-cols-2 gap-2 mt-1">
                          <select
                            value={extraMediaCols[col]?.impressions || ''}
                            onChange={(e) => handleExtraMediaChange(col, 'impressions', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-[10px] text-slate-300 focus:outline-none"
                          >
                            <option value="">노출수 매핑 안함</option>
                            {columns.filter(c => c !== col && (!mappedExtraCols.includes(c) || c === extraMediaCols[col]?.impressions)).map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <select
                            value={extraMediaCols[col]?.clicks || ''}
                            onChange={(e) => handleExtraMediaChange(col, 'clicks', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-[10px] text-slate-300 focus:outline-none"
                          >
                            <option value="">클릭수 매핑 안함</option>
                            {columns.filter(c => c !== col && (!mappedExtraCols.includes(c) || c === extraMediaCols[col]?.clicks)).map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Execute Button */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleRunAnalysis}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg glow-blue transition flex items-center gap-2"
            >
              Meridian MMM 분석 시작
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
