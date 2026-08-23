import React from 'react';
import { Target, TrendingUp, ShoppingCart, Users, Download, Pointer } from 'lucide-react';

export default function KpiSelectionScreen({ onSelectKpi }) {
  const kpiOptions = [
    {
      id: 'revenue',
      title: '매출액 (Revenue)',
      description: '쇼핑몰, 이커머스 등 실제 거래액 기반의 마케팅 믹스 모델링',
      icon: <TrendingUp className="w-8 h-8 text-emerald-400" />,
      color: 'border-emerald-500/30 hover:border-emerald-500 bg-emerald-500/5',
      glow: 'group-hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]'
    },
    {
      id: 'purchase',
      title: '구매수 (Purchase)',
      description: '단가가 고정되어 있거나 결제 건수 자체가 더 중요한 비즈니스',
      icon: <ShoppingCart className="w-8 h-8 text-blue-400" />,
      color: 'border-blue-500/30 hover:border-blue-500 bg-blue-500/5',
      glow: 'group-hover:shadow-[0_0_20px_rgba(59,130,246,0.3)]'
    },
    {
      id: 'traffic',
      title: '유입수 (Traffic)',
      description: '포털, 콘텐츠 사이트 등 방문자 수 트래픽 극대화 목표',
      icon: <Pointer className="w-8 h-8 text-purple-400" />,
      color: 'border-purple-500/30 hover:border-purple-500 bg-purple-500/5',
      glow: 'group-hover:shadow-[0_0_20px_rgba(168,85,247,0.3)]'
    },
    {
      id: 'install',
      title: '앱설치 (App Installs)',
      description: '모바일 서비스, 게임 등 신규 유저 획득(UAC) 캠페인',
      icon: <Download className="w-8 h-8 text-rose-400" />,
      color: 'border-rose-500/30 hover:border-rose-500 bg-rose-500/5',
      glow: 'group-hover:shadow-[0_0_20px_rgba(244,63,94,0.3)]'
    },
    {
      id: 'lead',
      title: '잠재고객 (Lead Gen)',
      description: 'B2B, 금융, 보험 등 고객 DB 확보 및 회원가입 목표',
      icon: <Users className="w-8 h-8 text-amber-400" />,
      color: 'border-amber-500/30 hover:border-amber-500 bg-amber-500/5',
      glow: 'group-hover:shadow-[0_0_20px_rgba(251,191,36,0.3)]'
    }
  ];

  return (
    <div className="py-8 flex flex-col items-center justify-center">
      {/* Title Section */}
      <div className="text-center mb-12 animate-fadeIn">
        <div className="inline-flex items-center justify-center p-4 bg-blue-500/10 rounded-2xl mb-6 border border-blue-500/20">
          <Target className="w-12 h-12 text-blue-400" />
        </div>
        <h1 className="text-3xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 mb-4 drop-shadow-sm tracking-tight">
          분석 목적을 선택해 주세요
        </h1>
        <p className="text-slate-400 text-sm md:text-base max-w-lg mx-auto leading-relaxed">
          마케팅 믹스 모델링(MMM)을 통해 최적화하고자 하는 핵심 KPI를 선택하세요.
          선택하신 목표에 맞춘 전용 리포트와 분석 지표가 제공됩니다.
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl w-full px-4 animate-slideUp">
        {kpiOptions.map((kpi) => (
          <button
            key={kpi.id}
            onClick={() => onSelectKpi(kpi.id)}
            className={`group text-left p-6 rounded-3xl border ${kpi.color} ${kpi.glow} transition-all duration-300 transform hover:-translate-y-1 backdrop-blur-sm relative overflow-hidden`}
          >
            {/* Background Glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="relative z-10 flex flex-col h-full">
              <div className="mb-4">
                {kpi.icon}
              </div>
              <h3 className="text-xl font-bold text-slate-100 mb-2">
                {kpi.title}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed flex-grow">
                {kpi.description}
              </p>
              
              <div className="mt-6 flex items-center text-xs font-semibold text-slate-500 group-hover:text-white transition-colors">
                선택하고 시작하기 <span className="ml-2">→</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
