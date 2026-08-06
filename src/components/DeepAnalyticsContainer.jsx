import React, { useState } from 'react';
import { BarChart2, Clock, TrendingUp, Target, Filter, ShieldCheck, BarChart3, Sparkles } from 'lucide-react';

import AdstockHalfLifeTab from './DeepAnalytics/AdstockHalfLifeTab';
import HillSaturationTab from './DeepAnalytics/HillSaturationTab';
import MarginalRoasTab from './DeepAnalytics/MarginalRoasTab';
import FunnelEfficiencyTab from './DeepAnalytics/FunnelEfficiencyTab';
import ConfidenceIntervalTab from './DeepAnalytics/ConfidenceIntervalTab';
import WaterfallChartTab from './DeepAnalytics/WaterfallChartTab';
import PromoImpactTab from './DeepAnalytics/PromoImpactTab';

export default function DeepAnalyticsContainer({ mmmResult }) {
  const [activeTab, setActiveTab] = useState('adstock');

  if (!mmmResult) return null;

  const isCpaMode = mmmResult.isCpaMode;

  const tabs = [
    { id: 'adstock', label: 'Adstock 반감기 분석', icon: Clock },
    { id: 'saturation', label: 'Hill 포화 응답 곡선', icon: TrendingUp },
    { id: 'marginal', label: isCpaMode ? `100만원당 획득 ${mmmResult.kpiTerms.name} & 4분면` : 'Marginal ROAS & 4분면', icon: Target },
    { id: 'funnel', label: '퍼널별 상관계수 (노출, 클릭, CTR)', icon: Filter },
    { id: 'waterfall', label: '증분 KPI 워터폴', icon: BarChart3 },
    { id: 'promo', label: '프로모션 기여도', icon: Sparkles },
    { id: 'ci95', label: '95% 베이지안 신뢰구간', icon: ShieldCheck }
  ];

  return (
    <div className="mb-10">
      
      {/* Tab Navigation Header */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 border-b border-slate-800">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-2 flex items-center gap-1.5">
          <BarChart2 className="w-4 h-4 text-blue-400" /> Deep Meridian Analytics:
        </span>

        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-xs font-semibold rounded-xl transition flex items-center gap-2 shrink-0 ${
                isActive 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 border border-blue-500/50 glow-blue'
                  : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content Display */}
      <div>
        {activeTab === 'adstock' && <AdstockHalfLifeTab mmmResult={mmmResult} />}
        {activeTab === 'saturation' && <HillSaturationTab mmmResult={mmmResult} />}
        {activeTab === 'marginal' && <MarginalRoasTab mmmResult={mmmResult} />}
        {activeTab === 'funnel' && <FunnelEfficiencyTab mmmResult={mmmResult} />}
        {activeTab === 'waterfall' && <WaterfallChartTab mmmResult={mmmResult} />}
        { activeTab === 'promo' && <PromoImpactTab mmmResult={mmmResult} /> }
        {activeTab === 'ci95' && <ConfidenceIntervalTab mmmResult={mmmResult} />}
      </div>

    </div>
  );
}
