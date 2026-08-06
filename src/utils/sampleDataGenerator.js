import * as XLSX from 'xlsx';

/**
 * Generate 90-day realistic sample marketing data for Instant Demo & Testing
 * Features embedded: Weekend spikes, seasonality (Summer/Autumn boost), Adstock decay, Diminishing ROAS, Clicks/Impressions
 */
export function generateSampleMMMData(kpiType = 'revenue') {
  const data = [];
  const startDate = new Date('2024-05-01');

  // Ground Truth Media Beta Coefficients & Parameters
  const channels = [
    { key: '(Meta)', baseCost: 1500000, coef: 4.2, decay: 0.4, cpm: 12000, ctr: 0.015 },
    { key: '(Google)', baseCost: 2000000, coef: 3.8, decay: 0.3, cpm: 8000, ctr: 0.025 },
    { key: '(Naver)', baseCost: 2500000, coef: 5.1, decay: 0.2, cpm: 15000, ctr: 0.030 },
    { key: '(Kakao)', baseCost: 800000, coef: 2.9, decay: 0.1, cpm: 6000, ctr: 0.008 }
  ];

  let prevAdstock = { '(Meta)': 0, '(Google)': 0, '(Naver)': 0, '(Kakao)': 0 };

  for (let i = 0; i < 90; i++) {
    const curDate = new Date(startDate);
    curDate.setDate(startDate.getDate() + i);

    const dateStr = curDate.toISOString().split('T')[0];
    const dayOfWeek = curDate.getDay(); // 0: Sun, 6: Sat
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
    const month = curDate.getMonth() + 1;
    
    // Promo day: Summer Promo (June-July), Discount Promo (Random)
    const isPromoSummer = (month === 6 || month === 7) ? 1 : 0;
    const isPromoDiscount = Math.random() > 0.9 ? 1 : 0;
    const isPromoEndYear = (month === 11 || month === 12) ? 1 : 0;

    // Daily Spend with natural variations (+-20%)
    const dailyData = {};

    // Ad Spend (High variance for MMM regression, with pulsing)
    channels.forEach(ch => {
      const baseCost = ch.baseCost;
      let spend = baseCost * (0.4 + Math.random() * 1.2);
      
      // 10% chance of a big campaign drop or spike
      const rand = Math.random();
      if (rand > 0.9) spend *= 2.5; 
      else if (rand < 0.1) spend *= 0.1;

      dailyData[`${ch.key} 광고비`] = Math.round(spend);
      
      const imp = Math.round(spend / ch.cpm * 1000 * (0.8 + Math.random() * 0.4));
      dailyData[`${ch.key} 노출수`] = imp;
      const clicks = Math.round(imp * ch.ctr * (0.8 + Math.random() * 0.4));
      dailyData[`${ch.key} 클릭수`] = clicks;
    });

    // Compute ground-truth adstock & saturation revenue
    let mediaRevenueTotal = 0;
    channels.forEach(ch => {
      const spend = dailyData[`${ch.key} 광고비`];
      const adstock = spend + ch.decay * (prevAdstock[ch.key] || 0);
      prevAdstock[ch.key] = adstock;

      // Diminishing returns log curve for ground truth generation
      const saturatedVal = Math.log(1 + 0.00008 * adstock);
      
      let kpiCoefScale = 850000;
      switch (kpiType) {
        case 'purchase': kpiCoefScale = 25; break;    // Increased to ensure stronger signal vs baseline
        case 'traffic': kpiCoefScale = 1200; break;   
        case 'install': kpiCoefScale = 50; break;     
        case 'lead': kpiCoefScale = 10; break;        
      }
      
      mediaRevenueTotal += saturatedVal * ch.coef * kpiCoefScale;
    });

    // Baseline Revenue & Seasonality Factor
    let baseline = 18000000; // 1,800만원 base
    let noiseScale = 2000000;
    let minKpi = 5000000;
    let kpiName = '매출액';
    
    switch (kpiType) {
      case 'purchase': 
        baseline = 100; noiseScale = 50; minKpi = 20; kpiName = '구매수';
        break;
      case 'traffic': 
        baseline = 5000; noiseScale = 2000; minKpi = 1000; kpiName = '유입수';
        break;
      case 'install': 
        baseline = 300; noiseScale = 150; minKpi = 50; kpiName = '앱설치수';
        break;
      case 'lead': 
        baseline = 50; noiseScale = 25; minKpi = 10; kpiName = '잠재고객수';
        break;
    }

    if (isWeekend) baseline *= 1.35; // Weekend 35% boost
    if (month === 6 || month === 7) baseline *= 1.2; // Summer boost 20%
    if (month === 11 || month === 0 || month === 1) baseline *= 0.85; // Winter drop 15%
    
    // Early / Late month effects
    const day = parseInt(dateStr.split('-')[2]);
    if (day <= 10) baseline *= 1.15; // Early month boost (e.g. salary days)
    if (day >= 21) baseline *= 0.9; // Late month drop

    if (isPromoSummer) baseline *= 1.3;
    if (isPromoDiscount) baseline *= 1.4; 
    if (isPromoEndYear) baseline *= 1.5;

    // Random noise
    const noise = (Math.random() - 0.5) * noiseScale;
    const totalRevenue = Math.round(baseline + mediaRevenueTotal + noise);

    data.push({
      '일자': dateStr,
      [kpiName]: Math.max(minKpi, totalRevenue),
      '프로모션A (여름)': isPromoSummer,
      '프로모션B (할인)': isPromoDiscount,
      '프로모션C (연말)': isPromoEndYear,
      ...dailyData
    });
  }

  return data;
}

/**
 * Export sample data as real .XLSX Excel File
 */
export function downloadSampleExcel(kpiType = 'revenue') {
  const sampleData = generateSampleMMMData(kpiType);

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "MMM_Input_Data");

  // Auto-fit column widths
  const colWidths = [
    { wch: 15 }, // Date
    { wch: 15 }, // Rev
    { wch: 18 }, // Promo A
    { wch: 18 }, // Promo B
    { wch: 18 }, // Promo C
    // Meta
    { wch: 15 }, { wch: 15 }, { wch: 15 },
    // Google
    { wch: 15 }, { wch: 15 }, { wch: 15 },
    // Naver
    { wch: 15 }, { wch: 15 }, { wch: 15 },
    // Kakao
    { wch: 15 }, { wch: 15 }, { wch: 15 }
  ];
  worksheet['!cols'] = colWidths;

  XLSX.writeFile(workbook, "MMM_Meridian_Sample_Data.xlsx");
}
