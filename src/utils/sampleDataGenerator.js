import * as XLSX from 'xlsx';

/**
 * 샘플 데모 데이터 생성기 (2년치 일 단위 데이터)
 *
 * - 업로드 형식과 똑같이 '일 단위'로 만들고, 분석 엔진이 주 단위로 변환해 분석합니다.
 * - 난수 시드를 고정해 데모를 여러 번 돌려도 같은 데이터·같은 결과가 나옵니다.
 * - 정답(실제 ROI, 실제 광고 기여분)을 함께 계산해 두어 엔진이 정답을 맞히는지 검증할 수 있습니다.
 *
 * 정답 생성 구조 (일 단위)
 *   광고 효과 = Vmax × A / (A + K),  A = 일 단위 geometric adstock(감쇠율 decay)
 *   매체별 Vmax는 기간 전체 ROI가 targetRoi가 되도록 맞춤
 *   기저 매출 = 기본값 × 주말·계절·월초/월말·추세·프로모션 효과 + 잡음
 *   광고비는 주 단위 캠페인 강약(flighting) + 일 단위 변동으로 생성
 */

const CHANNELS = [
  { key: '(Meta)', dailyCost: 1500000, decay: 0.80, targetRoi: 2.5, kScale: 1.2, cpm: 12000, ctr: 0.015 },
  { key: '(Google)', dailyCost: 2000000, decay: 0.50, targetRoi: 1.5, kScale: 0.8, cpm: 8000, ctr: 0.025 },
  { key: '(Naver)', dailyCost: 2500000, decay: 0.30, targetRoi: 3.0, kScale: 1.5, cpm: 15000, ctr: 0.030 },
  { key: '(Kakao)', dailyCost: 800000, decay: 0.70, targetRoi: 1.0, kScale: 1.0, cpm: 6000, ctr: 0.008 }
];

const KPI_CONFIG = {
  revenue: { name: '매출액', baseline: 18000000, noise: 1500000, min: 5000000 },
  purchase: { name: '구매수', baseline: 100, noise: 9, min: 20 },
  traffic: { name: '유입수', baseline: 5000, noise: 420, min: 1000 },
  install: { name: '앱설치수', baseline: 300, noise: 25, min: 50 },
  lead: { name: '잠재고객수', baseline: 50, noise: 4.5, min: 10 }
};

const NUM_DAYS = 728; // 2024-01-01(월)부터 104주

function makeRng(seed) {
  let a = seed >>> 0;
  const uniform = () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => {
    let u = 0, v = 0;
    while (u === 0) u = uniform();
    while (v === 0) v = uniform();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return { uniform, normal };
}

function toDateStr(dayIndex) {
  const d = new Date(Date.UTC(2024, 0, 1 + dayIndex));
  return d.toISOString().slice(0, 10);
}

/** 일 단위 adstock(정규화 없음, 연속 누적) 후 Hill 포화 */
function mediaEffect(spends, decay, K) {
  let carry = 0;
  return spends.map(s => {
    carry = s + decay * carry;
    const A = carry * (1 - decay); // 정상 상태에서 광고비 수준과 같은 스케일
    return A / (A + K);
  });
}

/**
 * 샘플 데이터와 정답을 함께 생성합니다.
 * @returns {{ data: Object[], truth: Object }}
 */
export function generateSampleMMMDataWithTruth(kpiType = 'revenue') {
  const cfg = KPI_CONFIG[kpiType] || KPI_CONFIG.revenue;
  const kpiScale = cfg.baseline / KPI_CONFIG.revenue.baseline;
  const rng = makeRng(20240101 + Object.keys(KPI_CONFIG).indexOf(kpiType in KPI_CONFIG ? kpiType : 'revenue'));

  // ---- 1. 광고비 (주 단위 캠페인 강약 × 일 단위 변동) ----
  const numWeeks = Math.ceil(NUM_DAYS / 7);
  const spend = {}, imps = {}, clicks = {};
  CHANNELS.forEach(ch => {
    const weekMult = [];
    for (let w = 0; w < numWeeks; w++) {
      let m = Math.exp(0.45 * rng.normal());
      const r = rng.uniform();
      if (r < 0.08) m *= 0.1;        // 집행 중단에 가까운 주
      else if (r > 0.92) m *= 2.0;   // 대형 캠페인 주
      weekMult.push(m);
    }
    spend[ch.key] = [];
    imps[ch.key] = [];
    clicks[ch.key] = [];
    for (let i = 0; i < NUM_DAYS; i++) {
      const s = Math.round(ch.dailyCost * weekMult[Math.floor(i / 7)] * (0.8 + 0.4 * rng.uniform()));
      const imp = Math.round(s / ch.cpm * 1000 * (0.85 + 0.3 * rng.uniform()));
      spend[ch.key].push(s);
      imps[ch.key].push(imp);
      clicks[ch.key].push(Math.round(imp * ch.ctr * (0.85 + 0.3 * rng.uniform())));
    }
  });

  // ---- 2. 정답 광고 효과 (ROI가 targetRoi가 되도록 Vmax 보정) ----
  const effect = {};
  const truthChannels = {};
  CHANNELS.forEach(ch => {
    const K = ch.dailyCost * ch.kScale;
    const shape = mediaEffect(spend[ch.key], ch.decay, K);
    const totalSpend = spend[ch.key].reduce((a, b) => a + b, 0);
    const vmax = (ch.targetRoi * kpiScale * totalSpend) / shape.reduce((a, b) => a + b, 0);
    effect[ch.key] = shape.map(v => v * vmax);

    // 정답 한계 ROI: 광고비를 전 기간 1% 늘렸을 때 추가 KPI ÷ 추가 광고비
    const shape101 = mediaEffect(spend[ch.key].map(s => s * 1.01), ch.decay, K);
    const extra = shape101.reduce((a, b) => a + b, 0) * vmax - shape.reduce((a, b) => a + b, 0) * vmax;
    truthChannels[`${ch.key} 광고비`] = {
      roi: ch.targetRoi * kpiScale,
      mroi: extra / (0.01 * totalSpend),
      dailyDecay: ch.decay,
      totalSpend,
      totalContrib: ch.targetRoi * kpiScale * totalSpend
    };
  });

  // ---- 3. 기저 KPI & 프로모션 ----
  const data = [];
  const promoBurstStarts = new Set();
  for (let i = 20; i < NUM_DAYS; i += 35 + Math.floor(rng.uniform() * 20)) promoBurstStarts.add(i);

  for (let i = 0; i < NUM_DAYS; i++) {
    const dateStr = toDateStr(i);
    const d = new Date(Date.UTC(2024, 0, 1 + i));
    const dow = d.getUTCDay();
    const month = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    const lastDay = new Date(Date.UTC(d.getUTCFullYear(), month, 0)).getUTCDate();

    const promoSummer = (month === 7 && day <= 14) ? 1 : 0;
    let promoDiscount = 0;
    for (let k = 0; k < 3; k++) if (promoBurstStarts.has(i - k)) promoDiscount = 1;
    const promoYearEnd = (month === 12 && day >= 10 && day <= 25) ? 1 : 0;

    let base = cfg.baseline;
    base *= 1 + 0.10 * (i / 365);                   // 연 10% 성장 추세
    if (dow === 0 || dow === 6) base *= 1.35;       // 주말
    if (month === 6 || month === 7) base *= 1.2;    // 여름 성수기
    if (month === 12 || month === 1 || month === 2) base *= 0.85; // 겨울 비수기
    if (day <= 5) base *= 1.15;                     // 월초
    if (day > lastDay - 5) base *= 0.9;             // 월말
    if (promoSummer) base *= 1.3;
    if (promoDiscount) base *= 1.4;
    if (promoYearEnd) base *= 1.5;

    let media = 0;
    CHANNELS.forEach(ch => { media += effect[ch.key][i]; });
    const value = base + media + cfg.noise * rng.normal();

    const row = {
      '일자': dateStr,
      [cfg.name]: Math.max(cfg.min, Math.round(value)),
      '프로모션A (여름)': promoSummer,
      '프로모션B (할인)': promoDiscount,
      '프로모션C (연말)': promoYearEnd
    };
    CHANNELS.forEach(ch => {
      row[`${ch.key} 광고비`] = spend[ch.key][i];
      row[`${ch.key} 노출수`] = imps[ch.key][i];
      row[`${ch.key} 클릭수`] = clicks[ch.key][i];
    });
    data.push(row);
  }

  return { data, truth: { kpiName: cfg.name, channels: truthChannels } };
}

/** 샘플 데이터(일 단위 행 배열)만 반환 */
export function generateSampleMMMData(kpiType = 'revenue') {
  return generateSampleMMMDataWithTruth(kpiType).data;
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

  XLSX.writeFile(workbook, "MMM_Sample_Data_Daily_2Y.xlsx");
}
