import React from 'react';
import { BarChart3, FileSpreadsheet, Sparkles, CalendarCheck } from 'lucide-react';

export default function Header({ onOpenExcelGuide, onRunDemo, onResetKpi }) {
  return (
    <header className="sticky top-0 z-30 glass-panel border-b border-slate-800 px-6 py-4 mb-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Brand Logo & Title */}
        <div 
          onClick={onResetKpi}
          className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition group"
          title="KPI 선택 화면으로 이동"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg glow-blue group-hover:scale-105 transition-transform">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight group-hover:text-blue-400 transition-colors">MMM Intelligence Studio</h1>
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Auto Seasonality Engine
              </span>
            </div>
            <p className="text-xs text-slate-400">마케팅 믹스 모델링 자동 분석 & 예산 배분 최적화 솔루션</p>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenExcelGuide}
            className="px-4 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition flex items-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            엑셀 포맷 추천 가이드
          </button>
          
          <button
            onClick={onRunDemo}
            className="px-4 py-2 text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg shadow-md transition flex items-center gap-2 glow-blue"
          >
            <CalendarCheck className="w-4 h-4" />
            샘플 데모 데이터 즉시 분석
          </button>
        </div>

      </div>
    </header>
  );
}
