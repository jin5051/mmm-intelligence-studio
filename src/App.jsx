import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import ExcelGuideModal from './components/ExcelGuideModal';
import FileUpload from './components/FileUpload';
import MetricsOverview from './components/MetricsOverview';
import ModelFitChart from './components/Charts/ModelFitChart';
import DeepAnalyticsContainer from './components/DeepAnalyticsContainer';
import ContributionChart from './components/Charts/ContributionChart';
import SeasonalityChart from './components/Charts/SeasonalityChart';
import BudgetSimulator from './components/BudgetSimulator';
import AnalystReport from './components/AnalystReport';
import ErrorBoundary from './components/ErrorBoundary';
import KpiSelectionScreen from './components/KpiSelectionScreen';

import { runMMMAnalysis } from './engine/mmmEngine';
import { generateSampleMMMData } from './utils/sampleDataGenerator';

const VALID_KPIS = ['revenue', 'purchase', 'traffic', 'install', 'lead'];

const getInitialKpiFromUrl = () => {
  try {
    // 1. Check clean path URL (e.g. /revenue or /kpi/revenue)
    const path = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    if (VALID_KPIS.includes(path)) return path;
    if (path.startsWith('kpi/')) {
      const sub = path.split('/')[1];
      if (VALID_KPIS.includes(sub)) return sub;
    }
    // 2. Fallback to query parameter (e.g. ?kpi=revenue)
    const params = new URLSearchParams(window.location.search);
    const kpiParam = params.get('kpi');
    if (kpiParam && VALID_KPIS.includes(kpiParam.toLowerCase())) {
      return kpiParam.toLowerCase();
    }
  } catch (e) {
    console.error("URL parsing error:", e);
  }
  return null;
};

export default function App() {
  const [isExcelGuideOpen, setIsExcelGuideOpen] = useState(false);
  const [mmmResult, setMmmResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const [selectedKpi, setSelectedKpi] = useState(getInitialKpiFromUrl);

  const updateUrlKpi = (kpiType) => {
    try {
      const newPath = kpiType ? `/${kpiType}` : '/';
      window.history.pushState({ kpi: kpiType }, '', newPath);
    } catch (e) {
      console.error("URL update error:", e);
    }
  };

  const handleSelectKpi = (kpiType) => {
    setSelectedKpi(kpiType);
    updateUrlKpi(kpiType);
  };

  const handleResetKpi = () => {
    setSelectedKpi(null);
    setMmmResult(null);
    updateUrlKpi(null);
  };

  useEffect(() => {
    const handlePopState = () => {
      const initialKpi = getInitialKpiFromUrl();
      setSelectedKpi(initialKpi);
      if (!initialKpi) {
        setMmmResult(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const runDemoAnalysis = () => {
    setIsLoading(true);
    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          const sampleData = generateSampleMMMData(selectedKpi);
          const kpiColName = getKpiColName(selectedKpi);
          
          const res = runMMMAnalysis(
            sampleData, 
            '일자', 
            kpiColName, 
            ['(Meta) 광고비', '(Google) 광고비', '(Naver) 광고비', '(Kakao) 광고비'],
            {
              promoCols: ['프로모션A (여름)', '프로모션B (할인)', '프로모션C (연말)'],
              '(Meta) 광고비_impressions': '(Meta) 노출수',
              '(Meta) 광고비_clicks': '(Meta) 클릭수',
              '(Google) 광고비_impressions': '(Google) 노출수',
              '(Google) 광고비_clicks': '(Google) 클릭수',
              '(Naver) 광고비_impressions': '(Naver) 노출수',
              '(Naver) 광고비_clicks': '(Naver) 클릭수',
              '(Kakao) 광고비_impressions': '(Kakao) 노출수',
              '(Kakao) 광고비_clicks': '(Kakao) 클릭수'
            },
            selectedKpi
          );
          setMmmResult(res);
        } catch (err) {
          console.error("Demo analysis error:", err);
        } finally {
          setIsLoading(false);
        }
      }, 100);
    });
  };

  const handleCustomAnalysis = (parsedData, dateCol, kpiCol, selectedMediaCols, extraCols = {}, kpiType = 'revenue', mediaPriorConfig = {}) => {
    setIsLoading(true);
    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          const res = runMMMAnalysis(parsedData, dateCol, kpiCol, selectedMediaCols, extraCols, kpiType, mediaPriorConfig);
          setMmmResult(res);
        } catch (err) {
          console.error("Analysis Error:", err);
          alert('분석 중 오류가 발생했습니다: ' + err.message);
        } finally {
          setIsLoading(false);
        }
      }, 100);
    });
  };

  const getKpiColName = (type) => {
    switch (type) {
      case 'purchase': return '구매수';
      case 'traffic': return '유입수';
      case 'install': return '앱설치수';
      case 'lead': return '잠재고객수';
      case 'revenue':
      default: return '매출액';
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col justify-between">
        <div>
          {/* Unified Header (Hides quick action buttons on KPI Selection Screen) */}
          <Header 
            onOpenExcelGuide={() => setIsExcelGuideOpen(true)}
            onRunDemo={runDemoAnalysis}
            onResetKpi={handleResetKpi}
            hideActions={!selectedKpi}
          />

          {/* Main Container */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6">
            {!selectedKpi ? (
              <KpiSelectionScreen onSelectKpi={handleSelectKpi} />
            ) : (
              <>
                {/* File Upload Section */}
                <div className="animate-fadeIn mb-8">
                  <FileUpload 
                    onAnalysisComplete={handleCustomAnalysis} 
                    onOpenExcelGuide={() => setIsExcelGuideOpen(true)}
                    onLoadDemo={runDemoAnalysis}
                    selectedKpiType={selectedKpi}
                  />
                </div>

                {/* Loading Spinner Indicator */}
                {isLoading && (
                  <div className="glass-panel rounded-2xl p-12 mb-8 border border-slate-800 text-center flex flex-col items-center justify-center animate-pulse">
                    <div className="w-12 h-12 rounded-full border-4 border-blue-500 border-t-transparent animate-spin mb-4" />
                    <p className="text-sm font-bold text-white">Meridian 베이지안 회귀 엔진 구동 중...</p>
                    <p className="text-xs text-slate-400 mt-1">Adstock 반감기 수명, Hill 포화 곡선, mROAS 및 95% 베이지안 신뢰구간을 산출하고 있습니다.</p>
                  </div>
                )}

                {/* Analysis Dashboard Results */}
                {!isLoading && mmmResult && (
                  <div className="animate-fadeIn space-y-2">
                    {/* Top KPI Metrics Overview */}
                    <MetricsOverview mmmResult={mmmResult} />

                    {/* Time Series Model Fit Chart */}
                    <ModelFitChart mmmResult={mmmResult} />

                    {/* Meridian Grade Deep Analytics 5-Tab System */}
                    <DeepAnalyticsContainer mmmResult={mmmResult} />

                    {/* Contribution & Channel ROAS Breakdown */}
                    <ContributionChart mmmResult={mmmResult} />

                    {/* User Requested Seasonality Breakdown Chart */}
                    <SeasonalityChart mmmResult={mmmResult} />

                    {/* Budget Optimization Simulator */}
                    <BudgetSimulator mmmResult={mmmResult} />

                    {/* Automated Marketing Analyst Report */}
                    <AnalystReport mmmResult={mmmResult} />
                  </div>
                )}
              </>
            )}
          </main>
        </div>

        {/* Recommended Excel Guide Modal */}
        <ExcelGuideModal 
          isOpen={isExcelGuideOpen}
          onClose={() => setIsExcelGuideOpen(false)}
          selectedKpiType={selectedKpi || 'revenue'}
        />

        {/* Unified Footer (Pushed to bottom cleanly with mt-auto) */}
        <footer className="text-center text-xs text-slate-500 py-6 border-t border-slate-900 mt-auto">
          MMM Intelligence Studio &copy; {new Date().getFullYear()} — Powered by Google Meridian Analytics Engine
        </footer>

      </div>
    </ErrorBoundary>
  );
}
