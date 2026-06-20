import React, { useState, useEffect, useRef } from 'react';
import { auth, googleProvider, db, functions } from './firebase';
import { signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, addDoc, query, onSnapshot, orderBy, deleteDoc, serverTimestamp, increment } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { translations } from './translations';
import { Chart } from 'chart.js/auto';
import { calculateIndicator, calculateSMA } from './indicators';
import { UPBIT_KRW_MARKETS } from './upbitMarkets';

const INDICATORS_METADATA = {
  trend: {
    label: "추세 지표 (Trend)",
    labelEn: "Trend Indicators",
    items: [
      { value: 'sma', label: '단순이동평균 (SMA)' },
      { value: 'ema', label: '지수이동평균 (EMA)' },
      { value: 'wma', label: '가중이동평균 (WMA)' },
      { value: 'hma', label: '헐이동평균 (HMA)' },
      { value: 'macd_line', label: 'MACD Line' },
      { value: 'macd_signal', label: 'MACD Signal' },
      { value: 'macd_hist', label: 'MACD Histogram' },
      { value: 'adx', label: '평균방향성지수 (ADX)' },
      { value: 'dmi_plus', label: 'DMI +DI' },
      { value: 'dmi_minus', label: 'DMI -DI' },
      { value: 'aroon_up', label: '아룬 업 (Aroon Up)' },
      { value: 'aroon_down', label: '아룬 다운 (Aroon Down)' },
      { value: 'aroon_osc', label: '아룬 오실레이터' },
      { value: 'parabolic_sar', label: '파라볼릭 SAR' },
      { value: 'ichimoku_tenkan', label: '일목균형표 전환선' },
      { value: 'ichimoku_kijun', label: '일목균형표 기준선' },
      { value: 'ichimoku_senkou_a', label: '일목균형표 선행스팬A' },
      { value: 'ichimoku_senkou_b', label: '일목균형표 선행스팬B' },
      { value: 'ichimoku_chikou', label: '일목균형표 후행스팬' },
      { value: 'trix', label: 'TRIX' },
      { value: 'vortex_plus', label: '보텍스 +VI' },
      { value: 'vortex_minus', label: '보텍스 -VI' },
      { value: 'supertrend', label: '슈퍼트렌드 (Supertrend)' },
      { value: 'zigzag', label: '지그재그 (ZigZag)' },
      { value: 'dpo', label: '탈트렌드 오실레이터 (DPO)' },
      { value: 'kst', label: 'KST 오실레이터' },
      { value: 'mass_index', label: '질량 지수 (Mass Index)' },
      { value: 'alligator_jaw', label: '앨리게이터 턱 (Jaw)' },
      { value: 'alligator_teeth', label: '앨리게이터 이빨 (Teeth)' },
      { value: 'alligator_lips', label: '앨리게이터 입술 (Lips)' },
      { value: 'gator_osc', label: '게이터 오실레이터' },
      { value: 'coppock', label: '코포크 가이드 (Coppock)' },
      { value: 'gmma_short', label: '구피이평 단기군' },
      { value: 'gmma_long', label: '구피이평 장기군' },
      { value: 'linear_reg_curve', label: '선형회귀 곡선' },
      { value: 'qqe', label: '정량적 질적 추정 (QQE)' },
      { value: 'chande_kroll', label: '샹들리에 크롤 스톱' }
    ]
  },
  momentum: {
    label: "모멘텀 지표 (Momentum)",
    labelEn: "Momentum Indicators",
    items: [
      { value: 'rsi', label: '상대강도지수 (RSI)' },
      { value: 'stoch_k', label: '스토캐스틱 %K' },
      { value: 'stoch_d', label: '스토캐스틱 %D' },
      { value: 'stoch_rsi', label: '스토캐스틱 RSI' },
      { value: 'cci', label: '상품채널지수 (CCI)' },
      { value: 'roc', label: '가격 변동률 (ROC)' },
      { value: 'williams_r', label: '윌리엄스 %R' },
      { value: 'momentum', label: '모멘텀 (Momentum)' },
      { value: 'awesome_osc', label: '어썸 오실레이터 (AO)' },
      { value: 'accelerator_osc', label: '가속 오실레이터 (AC)' },
      { value: 'mfi', label: '자금흐름지수 (MFI)' },
      { value: 'cmo', label: '샹드 모멘텀 오실레이터' },
      { value: 'ultimate_osc', label: '얼티메이트 오실레이터' },
      { value: 'rvi', label: '상대활력지수 (RVI)' },
      { value: 'smi_ergodic', label: 'SMI 에르고딕 오실레이터' },
      { value: 'tsi', label: '진정한 강도 지수 (TSI)' },
      { value: 'fisher_transform', label: '피셔 트랜스폼' },
      { value: 'connors_rsi', label: '코너스 RSI' },
      { value: 'center_of_gravity', label: '중력 중심 오실레이터' },
      { value: 'roc_volume', label: '거래량 변동률 (ROCV)' },
      { value: 'disparity_index', label: '이격도 지수' },
      { value: 'ppo', label: '가격 비율 오실레이터' },
      { value: 'pvo', label: '거래량 비율 오실레이터' },
      { value: 'dynamic_momentum', label: '동적 모멘텀 지수' },
      { value: 'woodies_cci', label: '우디 CCI' },
      { value: 'dt_osc', label: 'DT 오실레이터' }
    ]
  },
  volatility: {
    label: "변동성 지표 (Volatility)",
    labelEn: "Volatility Indicators",
    items: [
      { value: 'bb_upper', label: '볼린저 밴드 상단' },
      { value: 'bb_middle', label: '볼린저 밴드 중앙' },
      { value: 'bb_lower', label: '볼린저 밴드 하단' },
      { value: 'bb_width', label: '볼린저 밴드 폭' },
      { value: 'bb_pctb', label: '볼린저 밴드 %B' },
      { value: 'atr', label: '평균 실질 범위 (ATR)' },
      { value: 'keltner_upper', label: '켈트너 채널 상단' },
      { value: 'keltner_lower', label: '켈트너 채널 하단' },
      { value: 'donchian_upper', label: '돈치안 채널 상단' },
      { value: 'donchian_lower', label: '돈치안 채널 하단' },
      { value: 'donchian_middle', label: '돈치안 채널 중간' },
      { value: 'std_dev', label: '표준편차 (StdDev)' },
      { value: 'chaikin_volatility', label: '차이킨 변동성' },
      { value: 'historical_volatility', label: '역사적 변동성' },
      { value: 'squeeze_momentum', label: '스퀴즈 모멘텀' },
      { value: 'envelope_upper', label: '엔벨로프 상단' },
      { value: 'envelope_lower', label: '엔벨로프 하단' },
      { value: 'atr_bands_upper', label: 'ATR 밴드 상단' },
      { value: 'atr_bands_lower', label: 'ATR 밴드 하단' },
      { value: 'ulcer_index', label: '얼서 인덱스 (Ulcer)' }
    ]
  },
  volume: {
    label: "거래량 지표 (Volume)",
    labelEn: "Volume Indicators",
    items: [
      { value: 'obv', label: '온밸런스 볼륨 (OBV)' },
      { value: 'cmf', label: '차이킨 머니 플로우 (CMF)' },
      { value: 'volume_osc', label: '거래량 오실레이터' },
      { value: 'accumulation_distribution', label: '매집/분산 (A/D)' },
      { value: 'volume_profile', label: '매물대 프로파일' },
      { value: 'vwap', label: '거래량 가중평균가 (VWAP)' },
      { value: 'pvt', label: '거래량 가격 트렌드 (PVT)' },
      { value: 'nvi', label: '음의 거래량 지수 (NVI)' },
      { value: 'pvi', label: '양의 거래량 지수 (PVI)' },
      { value: 'eom', label: '이동 용이성 (EOM)' },
      { value: 'force_index', label: '포스 인덱스 (Force Index)' },
      { value: 'vpt', label: '거래량 가격 트렌드 (VPT)' }
    ]
  },
  exotic: {
    label: "채널 및 특수/선물 지표 (Exotic)",
    labelEn: "Exotic Indicators",
    items: [
      { value: 'pivot_p', label: '피벗 포인트 P' },
      { value: 'pivot_s1', label: '피벗 지지선 S1' },
      { value: 'pivot_r1', label: '피벗 저항선 R1' },
      { value: 'fib_retracement_0.236', label: '피보나치 0.236 되돌림' },
      { value: 'fib_retracement_0.382', label: '피보나치 0.382 되돌림' },
      { value: 'fib_retracement_0.5', label: '피보나치 0.5 되돌림' },
      { value: 'fib_retracement_0.618', label: '피보나치 0.618 되돌림' },
      { value: 'fib_retracement_0.786', label: '피보나치 0.786 되돌림' },
      { value: 'schaff_trend_cycle', label: '샤프 트렌드 사이클 (STC)' },
      { value: 'hurst_exponent', label: '허스트 지수 (Hurst)' },
      { value: 'linear_reg_slope', label: '선형회귀 기울기' },
      { value: 'correlation', label: '자기상관 계수 (Corr)' },
      { value: 'vwma', label: '거래량 가중이동평균' },
      { value: 'alma', label: '알마 이동평균 (ALMA)' },
      { value: 'mcginley_dynamic', label: '맥긴리 다이나믹' },
      { value: 'elder_ray_bull', label: '엘더 레이 황소 힘' },
      { value: 'elder_ray_bear', label: '엘더 레이 곰 힘' },
      { value: 'wave_trend_osc', label: '웨이브 트렌드 (WT)' },
      { value: 'open_interest', label: '미결제약정 (OI)' },
      { value: 'funding_rate', label: '펀딩비 (Funding Rate)' },
      { value: 'liquidation_heatmap', label: '청산 히트맵 가상화' },
      { value: 'cvd', label: '누적 볼륨 델타 (CVD)' }
    ]
  }
};

// --- Kakao AdFit Responsive Unit Component ---
function KakaoAd({ adUnit, width = "728", height = "90" }) {
  useEffect(() => {
    // Create script dynamically to trigger rendering of this specific ad area
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = "//t1.kakaocdn.net/kas/static/ba.min.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      try {
        document.body.removeChild(script);
      } catch (e) {}
    };
  }, [adUnit]);

  return (
    <div className="ad-container glass-panel" onClick={(e) => e.stopPropagation()} style={{ minHeight: `${parseInt(height) + 30}px`, display: "flex", justifyContent: "center" }}>
      <span className="ad-label">ADVERTISEMENT</span>
      <ins className="kakao_ad_area" 
           style={{ display: "none" }}
           data-ad-unit={adUnit}
           data-ad-width={width}
           data-ad-height={height}></ins>
    </div>
  );
}

const CandlestickChart = ({ candles, trades, language }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [hoveredCandle, setHoveredCandle] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const maxDisplay = 80;
  const displayCandles = candles.length > maxDisplay ? candles.slice(-maxDisplay) : candles;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const resizeCanvas = () => {
      const rect = containerRef.current.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = 300 * window.devicePixelRatio;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `300px`;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      draw();
    };

    const draw = () => {
      const w = canvas.width / window.devicePixelRatio;
      const h = canvas.height / window.devicePixelRatio;
      ctx.clearRect(0, 0, w, h);

      if (displayCandles.length === 0) return;

      const prices = displayCandles.flatMap(c => [c.high, c.low]);
      const minPrice = Math.min(...prices) * 0.995;
      const maxPrice = Math.max(...prices) * 1.005;
      const priceRange = maxPrice - minPrice;

      const mapY = (price) => h - 30 - ((price - minPrice) / priceRange) * (h - 50);

      const paddingLeft = 10;
      const paddingRight = 60;
      const chartWidth = w - paddingLeft - paddingRight;
      const candleWidth = chartWidth / displayCandles.length;

      // Draw grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px Space Grotesk';
      ctx.textAlign = 'left';

      const tickCount = 4;
      for (let i = 0; i < tickCount; i++) {
        const targetPrice = minPrice + (priceRange * i) / (tickCount - 1);
        const y = mapY(targetPrice);
        
        ctx.beginPath();
        ctx.moveTo(paddingLeft, y);
        ctx.lineTo(w - paddingRight, y);
        ctx.stroke();

        ctx.fillText(
          new Intl.NumberFormat(language === 'ko' ? 'ko-KR' : 'en-US', {
            notation: 'compact',
            maximumFractionDigits: 1
          }).format(targetPrice),
          w - paddingRight + 5,
          y + 3
        );
      }

      // Draw candles
      displayCandles.forEach((c, idx) => {
        const x = paddingLeft + idx * candleWidth + candleWidth / 2;
        const yOpen = mapY(c.open);
        const yClose = mapY(c.close);
        const yHigh = mapY(c.high);
        const yLow = mapY(c.low);

        const isBullish = c.close >= c.open;
        const color = isBullish ? '#22c55e' : '#ef4444';

        ctx.strokeStyle = color;
        ctx.fillStyle = color;

        // Wick
        ctx.beginPath();
        ctx.moveTo(x, yHigh);
        ctx.lineTo(x, yLow);
        ctx.stroke();

        // Body
        const bodyWidth = Math.max(1, candleWidth * 0.7);
        ctx.fillRect(x - bodyWidth / 2, Math.min(yOpen, yClose), bodyWidth, Math.max(1, Math.abs(yOpen - yClose)));
      });

      // Draw markers
      const startTimestamp = displayCandles[0].time;
      const endTimestamp = displayCandles[displayCandles.length - 1].time;
      const activeTrades = trades.filter(t => t.time >= startTimestamp && t.time <= endTimestamp);

      activeTrades.forEach(trade => {
        const cIdx = displayCandles.findIndex(c => c.time === trade.time);
        if (cIdx === -1) return;

        const x = paddingLeft + cIdx * candleWidth + candleWidth / 2;
        const candle = displayCandles[cIdx];

        if (trade.type === 'buy') {
          const y = mapY(candle.low) + 10;
          ctx.fillStyle = '#22c55e';
          ctx.beginPath();
          ctx.moveTo(x, y - 5);
          ctx.lineTo(x - 4, y);
          ctx.lineTo(x + 4, y);
          ctx.fill();

          ctx.font = 'bold 8px Space Grotesk';
          ctx.textAlign = 'center';
          ctx.fillText(language === 'ko' ? '매수' : 'BUY', x, y + 8);
        } else {
          const y = mapY(candle.high) - 10;
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.moveTo(x, y + 5);
          ctx.lineTo(x - 4, y);
          ctx.lineTo(x + 4, y);
          ctx.fill();

          ctx.font = 'bold 8px Space Grotesk';
          ctx.textAlign = 'center';
          ctx.fillText(language === 'ko' ? '매도' : 'SELL', x, y - 4);
        }
      });

      // Date labels
      ctx.fillStyle = '#64748b';
      ctx.font = '8px Space Grotesk';
      ctx.textAlign = 'center';
      
      const labelInterval = Math.max(1, Math.floor(displayCandles.length / 5));
      displayCandles.forEach((c, idx) => {
        if (idx % labelInterval === 0) {
          const x = paddingLeft + idx * candleWidth + candleWidth / 2;
          const dateObj = new Date(c.time);
          const label = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
          ctx.fillText(label, x, h - 5);
        }
      });
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    return () => window.removeEventListener('resize', resizeCanvas);
  }, [displayCandles, trades, language]);

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || displayCandles.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const paddingLeft = 10;
    const paddingRight = 60;
    const chartWidth = rect.width - paddingLeft - paddingRight;
    const candleWidth = chartWidth / displayCandles.length;

    const idx = Math.floor((mouseX - paddingLeft) / candleWidth);
    if (idx >= 0 && idx < displayCandles.length) {
      setHoveredCandle(displayCandles[idx]);
      setTooltipPos({ x: e.clientX - rect.left + 15, y: e.clientY - rect.top - 85 });
    } else {
      setHoveredCandle(null);
    }
  };

  const handleMouseLeave = () => {
    setHoveredCandle(null);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', marginTop: '1.25rem' }} className="glass-panel p-4">
      <h4 style={{ fontSize: '0.9rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        📊 {language === 'ko' ? '백테스팅 시세 캔들 및 거래 타점 (최근 80봉)' : 'Price Candles & Trade Execution (Last 80 bars)'}
      </h4>
      <canvas 
        ref={canvasRef} 
        onMouseMove={handleMouseMove} 
        onMouseLeave={handleMouseLeave}
        style={{ display: 'block', cursor: 'crosshair' }} 
      />
      {hoveredCandle && (
        <div style={{
          position: 'absolute',
          left: `${tooltipPos.x}px`,
          top: `${tooltipPos.y}px`,
          background: 'rgba(9, 12, 26, 0.95)',
          border: '1px solid var(--border-color)',
          borderRadius: '6px',
          padding: '0.5rem',
          fontSize: '0.72rem',
          color: 'var(--text-primary)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.1rem',
          fontFamily: 'Space Grotesk'
        }}>
          <div style={{ fontWeight: 'bold', color: 'var(--accent-cyan)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.2rem', marginBottom: '0.2rem' }}>
            📅 {new Date(hoveredCandle.time).toLocaleString(language)}
          </div>
          <div>Open: <span style={{ color: '#fff' }}>{hoveredCandle.open.toLocaleString()}</span></div>
          <div>High: <span style={{ color: '#22c55e' }}>{hoveredCandle.high.toLocaleString()}</span></div>
          <div>Low: <span style={{ color: '#ef4444' }}>{hoveredCandle.low.toLocaleString()}</span></div>
          <div>Close: <span style={{ color: '#fff' }}>{hoveredCandle.close.toLocaleString()}</span></div>
          <div>Volume: <span style={{ color: 'var(--accent-blue)' }}>{hoveredCandle.volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
        </div>
      )}
    </div>
  );
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function App() {
  // --- States ---
  const [language, setLanguage] = useState('ko');
  const [currency, setCurrency] = useState('krw');
  const [allCoins, setAllCoins] = useState([]);
  const [displayedCoins, setDisplayedCoins] = useState([]);
  const [selectedCoinIds, setSelectedCoinIds] = useState(['KRW-BTC', 'KRW-ETH', 'KRW-XRP', 'KRW-DOGE', 'KRW-SOL', 'KRW-ADA']);
  const [favorites, setFavorites] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [backtestCoin, setBacktestCoin] = useState('KRW-BTC');
  const [backtestCoinSearch, setBacktestCoinSearch] = useState('');
  const [backtestPeriod, setBacktestPeriod] = useState('365'); // '30', '90', '180', '365', '1095'
  const [backtestCapital, setBacktestCapital] = useState(1000000);
  const [backtestTimeframe, setBacktestTimeframe] = useState('1D'); // '5m', '15m', '30m', '1h', '4h', '1D', '1W'
  const [backtestStrategy, setBacktestStrategy] = useState('custom'); // 'custom', 'rsi', 'ma', 'bb', 'macd'
  const [briefingCoin, setBriefingCoin] = useState('all');
  const [briefingCoinSearch, setBriefingCoinSearch] = useState('');
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [user, setUser] = useState(null);
  const [opinionNickname, setOpinionNickname] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [scannerResults, setScannerResults] = useState([]);
  const [scannerLoading, setScannerLoading] = useState(false);
  const [scannerProgress, setScannerProgress] = useState('');
  const [activeTab, setActiveTab] = useState('home');
  const [loadingCoins, setLoadingCoins] = useState(false);
  const [limitMessageVisible, setLimitMessageVisible] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Real-time Fear & Greed states
  const [fearGreed, setFearGreed] = useState({ value: 50, classification: 'Neutral', loading: true });

  // Real-time Sentiment Poll states
  const [votes, setVotes] = useState({});

  // Modal & Chart states
  const [selectedModalCoinId, setSelectedModalCoinId] = useState(null);
  const [modalCoinDetails, setModalCoinDetails] = useState(null);
  const [modalChartData, setModalChartData] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalRange, setModalRange] = useState('7'); // '7', '30', '90' days
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  // AI Briefing States
  const [aiBriefingResults, setAiBriefingResults] = useState([]);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingError, setBriefingError] = useState('');

  // Opinions States
  const [opinions, setOpinions] = useState([]);
  const [opinionContent, setOpinionContent] = useState('');
  const [opinionPosting, setOpinionPosting] = useState(false);

  // Custom Rules States
  const [buyRules, setBuyRules] = useState([
    { id: 'b1', leftType: 'rsi', leftPeriod: 14, leftDev: 2, operator: '<', rightType: 'constant', rightPeriod: 14, rightDev: 2, rightValue: 30 }
  ]);
  const [buyLogicalOperator, setBuyLogicalOperator] = useState('AND');

  const [sellRules, setSellRules] = useState([
    { id: 's1', leftType: 'rsi', leftPeriod: 14, leftDev: 2, operator: '>', rightType: 'constant', rightPeriod: 14, rightDev: 2, rightValue: 70 }
  ]);
  const [sellLogicalOperator, setSellLogicalOperator] = useState('AND');

  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestResults, setBacktestResults] = useState(null);
  const backtestChartRef = useRef(null);
  const backtestChartInstance = useRef(null);

  // --- Rule Modification Helpers ---
  const addRule = (isBuy) => {
    const newRule = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      leftType: 'rsi',
      leftPeriod: 14,
      leftDev: 2,
      operator: isBuy ? '<' : '>',
      rightType: 'constant',
      rightPeriod: 14,
      rightDev: 2,
      rightValue: isBuy ? 30 : 70
    };
    if (isBuy) setBuyRules([...buyRules, newRule]);
    else setSellRules([...sellRules, newRule]);
  };

  const removeRule = (id, isBuy) => {
    if (isBuy) setBuyRules(buyRules.filter(r => r.id !== id));
    else setSellRules(sellRules.filter(r => r.id !== id));
  };

  const updateRule = (id, key, val, isBuy) => {
    const rules = isBuy ? buyRules : sellRules;
    const updated = rules.map(r => {
      if (r.id === id) {
        return { ...r, [key]: val };
      }
      return r;
    });
    if (isBuy) setBuyRules(updated);
    else setSellRules(updated);
  };

  const renderOperandOptions = (includeConstant = false) => {
    return (
      <>
        {includeConstant && <option value="constant">{language === 'ko' ? '고정값 (Value)' : 'Constant Value'}</option>}
        <optgroup label={language === 'ko' ? '기본 데이터' : 'Price / Volume'}>
          <option value="price_close">{language === 'ko' ? '종가 (Close)' : 'Price (Close)'}</option>
          <option value="price_open">{language === 'ko' ? '시가 (Open)' : 'Price (Open)'}</option>
          <option value="price_high">{language === 'ko' ? '고가 (High)' : 'Price (High)'}</option>
          <option value="price_low">{language === 'ko' ? '저가 (Low)' : 'Price (Low)'}</option>
          <option value="volume">{language === 'ko' ? '거래량 (Volume)' : 'Volume'}</option>
        </optgroup>
        {Object.entries(INDICATORS_METADATA).map(([key, group]) => (
          <optgroup label={language === 'ko' ? group.label : group.labelEn} key={key}>
            {group.items.map(item => (
              <option value={item.value} key={item.value}>
                {item.label}
              </option>
            ))}
          </optgroup>
        ))}
      </>
    );
  };

  const coingeckoApiKey = 'CG-xmGqWe2JgRKTWjf1WSPT9saQ';

  const fetchWithCache = async (url, cacheKey, ttlSeconds = 300) => {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { timestamp, data } = JSON.parse(cached);
        if (Date.now() - timestamp < ttlSeconds * 1000) {
          return data;
        }
      } catch (e) {
        console.warn("캐시 파싱 에러:", e);
      }
    }
    const response = await fetch(url);
    if (!response.ok) {
      if (cached) {
        try {
          const { data } = JSON.parse(cached);
          console.warn("API 에러로 인해 만료된 캐시 임시 복구 사용:", url);
          return data;
        } catch (e) {}
      }
      throw new Error(`API 요청 실패: ${response.status}`);
    }
    const data = await response.json();
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data }));
    } catch (e) {
      console.warn("캐시 쓰기 실패:", e);
    }
    return data;
  };

  // --- Translation Helper ---
  const t = (key) => translations[language]?.[key] || key;

  // --- Auth State Change Listener ---
  useEffect(() => {
    // Handle redirect login result
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          console.log("구글 리다이렉트 로그인 성공:", result.user);
        }
      })
      .catch((error) => {
        console.error("구글 리다이렉트 로그인 실패:", error);
        if (error.code === 'auth/unauthorized-domain') {
          alert(`구글 로그인 실패: 현재 도메인이 Firebase 승인 도메인 목록에 없습니다.\nFirebase 콘솔에서 이 도메인을 승인해 주세요.\n(에러 코드: ${error.code})`);
        } else {
          alert(`구글 로그인 실패: ${error.message}\n(에러 코드: ${error.code})`);
        }
      });

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser({ uid: currentUser.uid, displayName: currentUser.displayName });
        setOpinionNickname(currentUser.displayName || '');
        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.selectedCoinIds) {
              const isValid = data.selectedCoinIds.length > 0 && data.selectedCoinIds.every(id => id.startsWith('KRW-'));
              if (isValid) {
                setSelectedCoinIds(data.selectedCoinIds);
              } else {
                console.warn("Firestore에 구형 코인게코 ID 검출됨. 업비트 규격으로 복구 중...");
                const defaultList = ['KRW-BTC', 'KRW-ETH', 'KRW-XRP', 'KRW-DOGE', 'KRW-SOL', 'KRW-ADA'];
                setSelectedCoinIds(defaultList);
                await setDoc(userDocRef, { selectedCoinIds: defaultList }, { merge: true });
              }
            }
            if (data.favorites) setFavorites(data.favorites);
          }
        } catch (error) {
          console.error("Firestore 로드 실패, 로컬 스토리지 사용:", error);
          loadLocalData();
        }
      } else {
        setUser(null);
        setOpinionNickname('');
        loadLocalData();
      }
    });

    const savedLang = localStorage.getItem('cryptoLang') || (navigator.language.startsWith('ko') ? 'ko' : 'en');
    setLanguage(savedLang);
    setCurrency(savedLang === 'ko' ? 'krw' : 'usd');

    return () => unsubscribe();
  }, []);

  // --- Local Storage Fallback ---
  const loadLocalData = () => {
    const savedFavorites = localStorage.getItem('cryptoFavorites');
    if (savedFavorites) setFavorites(JSON.parse(savedFavorites));
    
    const savedSelectedCoins = localStorage.getItem('selectedCoinIds');
    if (savedSelectedCoins) {
      try {
        const parsed = JSON.parse(savedSelectedCoins);
        const isValid = parsed.length > 0 && parsed.every(id => id.startsWith('KRW-'));
        if (isValid) {
          setSelectedCoinIds(parsed);
        } else {
          console.warn("로컬 스토리지에 구형 코인게코 ID 검출됨. 초기화 진행...");
          localStorage.removeItem('selectedCoinIds');
        }
      } catch (e) {
        console.warn("로컬 코인 목록 파싱 실패:", e);
      }
    }
  };

  // --- Google Login/Logout Handlers ---
  const handleGoogleLogin = async () => {
    const isMobile = /Mobi|Android|iPhone|iPad|KakaoTalk|Line|Instagram|FBAN|FBAV/i.test(navigator.userAgent);
    try {
      if (isMobile) {
        await signInWithRedirect(auth, googleProvider);
      } else {
        await signInWithPopup(auth, googleProvider);
      }
    } catch (error) {
      console.error("구글 로그인 실패:", error);
      
      // 상세 에러 문자열 생성
      let detailMessage = "";
      if (error.customData) {
        detailMessage = `\n[상세 정보]: ${JSON.stringify(error.customData)}`;
      } else if (error.message) {
        detailMessage = `\n[메시지]: ${error.message}`;
      }

      if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch (redirectError) {
          console.error("구글 리다이렉트 로그인 실패:", redirectError);
          alert(`구글 로그인 실패: ${redirectError.message}\n(에러 코드: ${redirectError.code})${detailMessage}`);
        }
      } else if (error.code === 'auth/unauthorized-domain') {
        alert(`구글 로그인 실패: 현재 도메인이 Firebase 승인 도메인 목록에 없습니다.\nFirebase 콘솔에서 이 도메인을 승인해 주세요.\n(에러 코드: ${error.code})${detailMessage}`);
      } else {
        alert(`구글 로그인 실패: ${error.message}\n(에러 코드: ${error.code})${detailMessage}\n\n💡 해결 방법: Firebase Console에서 Google 로그인 제공업체 활성화 및 프로젝트 지원 이메일 등록 여부를 확인해 주세요.`);
      }
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("로그아웃 실패:", error);
      alert(`로그아웃 실패: ${error.message}`);
    }
  };

  // --- Fetch Fear & Greed Index ---
  useEffect(() => {
    const fetchFearGreed = async () => {
      try {
        const res = await fetch('https://api.alternative.me/fng/?limit=1');
        if (!res.ok) throw new Error('Fear & Greed Index fetch failed');
        const data = await res.json();
        if (data.data && data.data[0]) {
          setFearGreed({
            value: parseInt(data.data[0].value),
            classification: data.data[0].value_classification,
            loading: false
          });
        }
      } catch (error) {
        console.error("공포탐욕지수 조회 실패:", error);
        setFearGreed(prev => ({ ...prev, loading: false }));
      }
    };
    fetchFearGreed();
  }, []);

  // --- Realtime Sentiment Poll Sync ---
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "votes"), (snapshot) => {
      const votesData = {};
      snapshot.forEach(doc => {
        votesData[doc.id] = doc.data();
      });
      setVotes(votesData);
    }, (error) => {
      console.error("투표 현황 연동 실패:", error);
    });

    return () => unsubscribe();
  }, []);

  // --- Realtime Opinions Sync ---
  useEffect(() => {
    const q = query(collection(db, "opinions"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const ops = [];
      querySnapshot.forEach((doc) => {
        ops.push({ id: doc.id, ...doc.data() });
      });
      setOpinions(ops);
    }, (error) => {
      console.error("의견 로딩 실패:", error);
    });

    return () => unsubscribe();
  }, []);

  // --- Sync preferences to Storage/DB ---
  const syncSettings = async (newSelected, newFavs) => {
    if (auth.currentUser) {
      try {
        const userDocRef = doc(db, "users", auth.currentUser.uid);
        await setDoc(userDocRef, {
          selectedCoinIds: newSelected,
          favorites: newFavs
        }, { merge: true });
      } catch (error) {
        console.error("Firestore 동기화 실패:", error);
      }
    } else {
      localStorage.setItem('selectedCoinIds', JSON.stringify(newSelected));
      localStorage.setItem('cryptoFavorites', JSON.stringify(newFavs));
    }
  };

  // --- Fetch 100 Sidebar Coins (Static Load to Avoid 429 Rate Limits) ---
  useEffect(() => {
    const fetchSidebarCoins = () => {
      // 💡 업비트 마켓 목록을 로컬 정적 데이터(UPBIT_KRW_MARKETS)에서 로드하여 
      // 앱 구동 시 발생하는 API 호출(CORS/429 제한)을 근본적으로 제거합니다.
      const mappedCoins = UPBIT_KRW_MARKETS.map(marketInfo => {
        const symbol = marketInfo.market.split('-')[1]; // "BTC"
        return {
          id: marketInfo.market, // "KRW-BTC"
          name: marketInfo.korean_name,
          symbol: symbol.toLowerCase(),
          image: `https://static.upbit.com/logos/${symbol}.png`,
          current_price: 0, // 웹소켓이 실시간으로 채워줍니다.
          price_change_percentage_24h: 0,
          market_cap: 0,
          trade_volume: 0
        };
      });

      setAllCoins(mappedCoins);
    };

    fetchSidebarCoins();
  }, [currency]);

  // --- Fetch detailed info & calculations (Upbit API Migration & Rate Limit Fix) ---
  useEffect(() => {
    const loadCoinData = async () => {
      if (selectedCoinIds.length === 0) {
        setDisplayedCoins([]);
        return;
      }
      
      setLoadingCoins(true);
      
      // 1. 코인 정보(이름, 심볼, 이미지) 및 가격 레이아웃 즉시 초기화 (API 호출 생략)
      const initialDisplayed = selectedCoinIds.map(coinId => {
        const symbol = coinId.split('-')[1];
        // allCoins에 이미 존재하는 웹소켓 수신 가격이 있다면 재활용, 없으면 0원 초기화
        const existingCoin = allCoins.find(c => c.id === coinId);
        const marketInfo = UPBIT_KRW_MARKETS.find(m => m.market === coinId);
        
        return {
          id: coinId,
          name: marketInfo ? marketInfo.korean_name : symbol,
          symbol: symbol.toLowerCase(),
          image: `https://static.upbit.com/logos/${symbol}.png`,
          current_price: existingCoin ? existingCoin.current_price : 0,
          price_change_percentage_24h: existingCoin ? existingCoin.price_change_percentage_24h : 0,
          rsi: 50,
          ma_20_day_comparison: 'neutral',
          market_cap: 0,
          trade_volume: 0
        };
      });
      
      setDisplayedCoins(initialDisplayed);
      setLoadingCoins(false); // 레이아웃이 준비되었으므로 스피너 즉시 중지

      // 2. 보조지표(RSI/MA) 계산을 위한 과거 일봉 캔들 데이터 백그라운드 로드
      // 업비트의 브라우저 Origin 헤더 기준 '10초당 1회' 극단적 제한을 회피하기 위해,
      // 로컬 스토리지 캐시를 먼저 검증하고 캐시 부재 시 11초의 안전 대기 간격을 두고 순차 호출합니다.
      for (let i = 0; i < selectedCoinIds.length; i++) {
        const coinId = selectedCoinIds[i];
        
        try {
          const cacheKey = `coinChart_30d_${coinId}`;
          const cached = localStorage.getItem(cacheKey);
          let chartData = null;
          let isFromCache = false;
          
          if (cached) {
            try {
              const { timestamp, data } = JSON.parse(cached);
              if (Date.now() - timestamp < 3600 * 1000) { // 1시간 캐시
                chartData = data;
                isFromCache = true;
              }
            } catch (e) {}
          }
          
          if (!chartData) {
            const response = await fetch(`https://api.upbit.com/v1/candles/days?market=${coinId}&count=30`);
            if (response.ok) {
              chartData = await response.json();
              localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: chartData }));
            } else if (response.status === 429) {
              console.warn(`Upbit rate limit hit for ${coinId}, will retry later.`);
            }
          }
          
          if (chartData && Array.isArray(chartData) && chartData.length > 0) {
            const prices = chartData.slice().reverse().map(c => c.trade_price);
            const rsi = calculateRSI(prices.slice(-15));
            const ma_20 = prices.slice(-20).reduce((a, b) => a + b, 0) / Math.min(prices.length, 20);
            
            setDisplayedCoins(prevCoins => 
              prevCoins.map(c => {
                if (c.id === coinId) {
                  const ma_20_day_comparison = c.current_price > ma_20 ? 'above' : 'below';
                  return { ...c, rsi, ma_20_day_comparison };
                }
                return c;
              })
            );
          }
          
          // API를 실제 호출했을 경우에만 11초 대기 (캐시 히트 시 즉시 다음 루프)
          if (!isFromCache && i < selectedCoinIds.length - 1) {
            await sleep(11000);
          }
        } catch (err) {
          console.error(`${coinId} 백그라운드 캔들 로드 실패:`, err);
        }
      }
    };

    loadCoinData();
  }, [selectedCoinIds]);

  // --- Upbit WebSocket Realtime Price Sync ---
  useEffect(() => {
    if (allCoins.length === 0) return;

    let ws;
    let isConnected = true;

    const connectWebSocket = () => {
      ws = new WebSocket('wss://api.upbit.com/websocket/v1');
      ws.binaryType = 'blob';

      ws.onopen = () => {
        if (!isConnected) return;
        const codes = allCoins.map(c => c.id);
        ws.send(JSON.stringify([
          { ticket: "oracoin-realtime" },
          { type: "ticker", codes: codes }
        ]));
      };

      ws.onmessage = async (event) => {
        if (!isConnected) return;
        try {
          const text = await event.data.text();
          const ticker = JSON.parse(text);
          
          // allCoins 실시간 가격 업데이트
          setAllCoins(prevCoins => 
            prevCoins.map(c => {
              if (c.id === ticker.code) {
                return {
                  ...c,
                  current_price: ticker.trade_price,
                  price_change_percentage_24h: ticker.signed_change_rate * 100
                };
              }
              return c;
            })
          );

          // displayedCoins 실시간 가격 업데이트
          setDisplayedCoins(prevCoins => 
            prevCoins.map(c => {
              if (c.id === ticker.code) {
                return {
                  ...c,
                  current_price: ticker.trade_price,
                  price_change_percentage_24h: ticker.signed_change_rate * 100
                };
              }
              return c;
            })
          );
        } catch (e) {
          // 파싱 실패 우회
        }
      };

      ws.onerror = (err) => {
        console.error("웹소켓 에러:", err);
      };

      ws.onclose = () => {
        if (isConnected) {
          setTimeout(connectWebSocket, 3000); // 3초 후 재연결
        }
      };
    };

    connectWebSocket();

    return () => {
      isConnected = false;
      if (ws) ws.close();
    };
  }, [allCoins.length]);

  // --- RSI Calculation Helper ---
  const calculateRSI = (prices) => {
    if (prices.length < 15) return 50;
    let gains = 0;
    let losses = 0;
    for (let i = 1; i < prices.length; i++) {
      const diff = prices[i] - prices[i - 1];
      if (diff > 0) gains += diff;
      else losses -= diff;
    }
    if (losses === 0) return 100;
    const rs = (gains / 14) / (losses / 14);
    return 100 - (100 / (1 + rs));
  };

  // --- Simple Moving Average (SMA) Calculation ---
  const calculateSMA = (data, period = 7) => {
    const sma = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        sma.push(null);
      } else {
        const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        sma.push(sum / period);
      }
    }
    return sma;
  };

  // --- Exponential Moving Average (EMA) Calculation ---
  const calculateEMA = (data, period = 14) => {
    const ema = [];
    if (data.length === 0) return ema;
    const k = 2 / (period + 1);
    let prevEma = data[0];
    ema.push(prevEma);
    for (let i = 1; i < data.length; i++) {
      const currEma = data[i] * k + prevEma * (1 - k);
      ema.push(currEma);
      prevEma = currEma;
    }
    return ema;
  };

  // --- MACD Calculation ---
  const calculateMACD = (data, fast = 12, slow = 26, signal = 9) => {
    const fastEma = calculateEMA(data, fast);
    const slowEma = calculateEMA(data, slow);
    const macdLine = [];
    for (let i = 0; i < data.length; i++) {
      macdLine.push(fastEma[i] - slowEma[i]);
    }
    const signalLine = calculateEMA(macdLine, signal);
    const histogram = [];
    for (let i = 0; i < data.length; i++) {
      histogram.push(macdLine[i] - signalLine[i]);
    }
    return { macdLine, signalLine, histogram };
  };

  // --- Standard Deviation Calculation ---
  const calculateStdDev = (data, period = 20) => {
    const stdDevs = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        stdDevs.push(null);
      } else {
        const slice = data.slice(i - period + 1, i + 1);
        const mean = slice.reduce((a, b) => a + b, 0) / period;
        const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
        stdDevs.push(Math.sqrt(variance));
      }
    }
    return stdDevs;
  };

  // --- Bollinger Bands Calculation ---
  const calculateBollingerBands = (data, period = 20, multiplier = 2) => {
    const middle = calculateSMA(data, period);
    const stdDev = calculateStdDev(data, period);
    const upper = [];
    const lower = [];
    for (let i = 0; i < data.length; i++) {
      if (middle[i] === null || stdDev[i] === null) {
        upper.push(null);
        lower.push(null);
      } else {
        upper.push(middle[i] + multiplier * stdDev[i]);
        lower.push(middle[i] - multiplier * stdDev[i]);
      }
    }
    return { upper, middle, lower };
  };

  // --- Stochastic Oscillator Calculation ---
  const calculateStochastic = (highs, lows, closes, period = 14, dPeriod = 3) => {
    const kLine = [];
    for (let i = 0; i < closes.length; i++) {
      if (i < period - 1) {
        kLine.push(50);
      } else {
        const highSlice = highs.slice(i - period + 1, i + 1);
        const lowSlice = lows.slice(i - period + 1, i + 1);
        const maxHigh = Math.max(...highSlice);
        const minLow = Math.min(...lowSlice);
        if (maxHigh === minLow) {
          kLine.push(50);
        } else {
          kLine.push(((closes[i] - minLow) / (maxHigh - minLow)) * 100);
        }
      }
    }
    const dLine = calculateSMA(kLine, dPeriod);
    return { kLine, dLine };
  };

  // --- Average True Range (ATR) Calculation ---
  const calculateATR = (highs, lows, closes, period = 14) => {
    const tr = [];
    if (closes.length === 0) return tr;
    tr.push(highs[0] - lows[0]);
    for (let i = 1; i < closes.length; i++) {
      const trVal = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      tr.push(trVal);
    }
    return calculateEMA(tr, period);
  };

  // --- Commodity Channel Index (CCI) Calculation ---
  const calculateCCI = (highs, lows, closes, period = 20) => {
    const tp = [];
    for (let i = 0; i < closes.length; i++) {
      tp.push((highs[i] + lows[i] + closes[i]) / 3);
    }
    const tpSma = calculateSMA(tp, period);
    const cci = [];
    for (let i = 0; i < tp.length; i++) {
      if (i < period - 1 || tpSma[i] === null) {
        cci.push(0);
      } else {
        const slice = tp.slice(i - period + 1, i + 1);
        const mean = tpSma[i];
        const meanDeviation = slice.reduce((a, b) => a + Math.abs(b - mean), 0) / period;
        if (meanDeviation === 0) {
          cci.push(0);
        } else {
          cci.push((tp[i] - mean) / (0.015 * meanDeviation));
        }
      }
    }
    return cci;
  };

  // --- Candle Resampling Engine ---
  const resampleToCandles = (prices, volumes, timeframe) => {
    let intervalMs = 24 * 60 * 60 * 1000; // default 1 day
    if (timeframe === '5m') intervalMs = 5 * 60 * 1000;
    else if (timeframe === '15m') intervalMs = 15 * 60 * 1000;
    else if (timeframe === '30m') intervalMs = 30 * 60 * 1000;
    else if (timeframe === '1h') intervalMs = 60 * 60 * 1000;
    else if (timeframe === '4h') intervalMs = 4 * 60 * 60 * 1000;
    else if (timeframe === '1D') intervalMs = 24 * 60 * 60 * 1000;
    else if (timeframe === '1W') intervalMs = 7 * 24 * 60 * 60 * 1000;

    if (!prices || prices.length === 0) return [];

    const candles = [];
    let currentBucket = null;

    for (let i = 0; i < prices.length; i++) {
      const [t, p] = prices[i];
      const v = (volumes && volumes[i]) ? volumes[i][1] : 0;
      
      const bucketTime = Math.floor(t / intervalMs) * intervalMs;

      if (!currentBucket || currentBucket.time !== bucketTime) {
        if (currentBucket) {
          candles.push(currentBucket);
        }
        currentBucket = {
          time: bucketTime,
          open: p,
          high: p,
          low: p,
          close: p,
          volume: v
        };
      } else {
        currentBucket.high = Math.max(currentBucket.high, p);
        currentBucket.low = Math.min(currentBucket.low, p);
        currentBucket.close = p;
        currentBucket.volume += v;
      }
    }
    if (currentBucket) {
      candles.push(currentBucket);
    }
    return candles;
  };

  // --- Indicator Mappings ---
  const getRsiStatus = (rsi) => {
    if (!rsi) return { rsiClass: 'text-secondary-style', rsiText: t('rsi_neutral') };
    if (rsi > 70) return { rsiClass: 'text-red', rsiText: t('rsi_overbought') };
    if (rsi < 30) return { rsiClass: 'text-green', rsiText: t('rsi_oversold') };
    return { rsiClass: 'text-secondary-style', rsiText: t('rsi_neutral') };
  };

  const getMaStatus = (maComparison) => {
    if (maComparison === 'above') return { maClass: 'text-green', maText: t('ma_uptrend') };
    if (maComparison === 'below') return { maClass: 'text-red', maText: t('ma_downtrend') };
    return { maClass: 'text-secondary-style', maText: t('rsi_neutral') };
  };

  const getEvaluation = (rsi, maComparison) => {
    let score = 0;
    if (rsi && rsi < 30) score++;
    if (rsi && rsi > 70) score--;
    if (maComparison === 'above') score++;
    if (maComparison === 'below') score--;

    if (score > 0) return { evalClass: 'text-green', evalText: t('eval_buy') };
    if (score < 0) return { evalClass: 'text-red', evalText: t('eval_caution') };
    return { evalClass: 'text-secondary-style', evalText: t('eval_neutral') };
  };

  // --- Handlers for list edits ---
  const handleFavorite = (id) => {
    let newFavs;
    if (favorites.includes(id)) {
      newFavs = favorites.filter(favId => favId !== id);
    } else {
      newFavs = [...favorites, id];
    }
    setFavorites(newFavs);
    syncSettings(selectedCoinIds, newFavs);
  };

  const handleAddCoin = (id) => {
    if (selectedCoinIds.length >= 6) {
      setLimitMessageVisible(true);
      setTimeout(() => setLimitMessageVisible(false), 2000);
      return;
    }
    if (!selectedCoinIds.includes(id)) {
      const newSelected = [...selectedCoinIds, id];
      setSelectedCoinIds(newSelected);
      syncSettings(newSelected, favorites);
    }
  };

  const handleRemoveCoin = (id, e) => {
    e.stopPropagation();
    const newSelected = selectedCoinIds.filter(coinId => coinId !== id);
    setSelectedCoinIds(newSelected);
    setDisplayedCoins(displayedCoins.filter(c => c.id !== id));
    syncSettings(newSelected, favorites);
  };

  // --- Handlers for Sentiment Poll voting ---
  const handleVote = async (coinId, type) => {
    try {
      const voteRef = doc(db, "votes", coinId);
      await setDoc(voteRef, {
        [type]: increment(1)
      }, { merge: true });
    } catch (error) {
      console.error("투표 반영 실패:", error);
    }
  };

  // --- Detail Modal fetch & chart rendering ---
  useEffect(() => {
    if (!selectedModalCoinId) return;

    const fetchModalDetails = async () => {
      setModalLoading(true);
      try {
        const marketName = allCoins.find(c => c.id === selectedModalCoinId)?.name || selectedModalCoinId;
        const details = {
          name: marketName,
          description: {
            ko: translations[language]?.desc?.[selectedModalCoinId] || `${marketName}은(는) 업비트 원화 마켓에 등록된 디지털 자산입니다.`,
            en: `${marketName} is a digital asset listed on the Upbit KRW market.`
          },
          links: {
            homepage: [`https://upbit.com/exchange?code=${selectedModalCoinId}`]
          }
        };

        const chartData = await fetchWithCache(
          `https://api.upbit.com/v1/candles/days?market=${selectedModalCoinId}&count=${modalRange}`,
          `modalChart_${selectedModalCoinId}_upbit_${modalRange}`,
          900 // 15분 캐시
        );

        // 시간순(과거->현재) 정렬 및 차트 데이터 매핑
        const formattedPrices = chartData.slice().reverse().map(c => [c.timestamp, c.trade_price]);

        setModalCoinDetails(details);
        setModalChartData(formattedPrices);
      } catch (error) {
        console.error("상세 데이터 로딩 실패:", error);
      } finally {
        setModalLoading(false);
      }
    };

    fetchModalDetails();
  }, [selectedModalCoinId, currency, modalRange, language, allCoins]);

  // Chart rendering effect
  useEffect(() => {
    if (!modalChartData || !chartRef.current) return;

    const ctx = chartRef.current.getContext('2d');
    if (chartInstance.current) chartInstance.current.destroy();

    const labels = modalChartData.map(p => new Date(p[0]).toLocaleDateString(language));
    const prices = modalChartData.map(p => p[1]);
    const sma7 = calculateSMA(prices, 7);

    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: t('price'),
            data: prices,
            borderColor: '#4facfe',
            backgroundColor: 'rgba(79, 172, 254, 0.08)',
            borderWidth: 2,
            tension: 0.4,
            pointRadius: 0,
            fill: true,
          },
          {
            label: '7-SMA',
            data: sma7,
            borderColor: '#d946ef',
            borderWidth: 1.5,
            tension: 0.4,
            pointRadius: 0,
            fill: false,
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            ticks: { color: '#94a3b8', font: { family: 'Space Grotesk' } },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          },
          x: {
            ticks: { color: '#94a3b8', font: { family: 'Space Grotesk' } },
            grid: { color: 'transparent' }
          }
        },
        plugins: {
          legend: { 
            display: true,
            labels: { color: '#94a3b8', font: { family: 'Space Grotesk', size: 10 } }
          }
        }
      }
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [modalChartData, language]);

  // --- Local Fallback Briefing Generator ---
  const generateLocalBriefing = (coinId, userContext) => {
    const coin = allCoins.find(c => c.id === coinId);
    const dispCoin = displayedCoins.find(c => c.id === coinId) || coin;
    if (!coin) return null;

    const price = coin.current_price;
    const change = coin.price_change_percentage_24h || 0;
    const rsi = dispCoin?.rsi ? dispCoin.rsi.toFixed(1) : (50 + Math.random() * 20 - 10).toFixed(1);
    const ma = dispCoin?.ma_20_day_comparison || 'neutral';
    
    // Evaluate recommendation
    let rec = language === 'ko' ? '관망' : 'Neutral / Watch';
    if (rsi < 30 || ma === 'above') {
      rec = language === 'ko' ? '매수 고려' : 'Consider Buying';
    } else if (rsi > 70 || ma === 'below') {
      rec = language === 'ko' ? '주의 필요' : 'Caution Advised';
    }

    const priceTargetVal = price * (rec.includes('Buy') || rec.includes('매수') ? 1.05 : 0.95);
    const formattedPriceTarget = new Intl.NumberFormat(language, { 
      style: 'currency', 
      currency: currency 
    }).format(priceTargetVal);

    const buyRulesText = userContext.customStrategy.buyRules.map(r => `${r.left} ${r.op} ${r.right}`).join(', ');
    const sellRulesText = userContext.customStrategy.sellRules.map(r => `${r.left} ${r.op} ${r.right}`).join(', ');

    let opinion = '';
    if (language === 'ko') {
      opinion = `[현황 분석] 현재 ${coin.name}(${coin.symbol.toUpperCase()})의 가격은 ${new Intl.NumberFormat('ko-KR', { style: 'currency', currency: currency }).format(price)}이며, 24시간 전 대비 ${change.toFixed(2)}% 변동을 보이고 있습니다. 
      [기술 지표 분석] 현재 14일 기준 RSI는 ${rsi}로 ${rsi > 70 ? '과매수 구간(고점 시그널)' : rsi < 30 ? '과매도 구간(반등 시그널)' : '중립 수준'}에 위치해 있으며, 20일 이동평균선 대비 가격이 ${ma === 'above' ? '위에 있어 상승 추세' : ma === 'below' ? '아래에 있어 하락 추세' : '조정을 거치는 중'}입니다.
      [전략 적용 평가] 귀하가 설정하신 매수 전략(${buyRulesText || 'RSI < 30'}) 및 매도 전략(${sellRulesText || 'RSI > 70'})과 현재 지표를 대조한 결과, ${
        rsi < 30 ? '매수 신호 조건에 근접하여 매수 관점 진입이 유효해 보입니다.' : 
        rsi > 70 ? '매도 분할 실현 관점이 요구되는 리스크 관리 구간입니다.' : 
        '뚜렷한 시그널이 부재한 관망(Neutral) 상태가 적절합니다.'
      } 단기 목표가는 변동성을 고려하여 ${formattedPriceTarget} 부근으로 판단됩니다.
      
      * 💡 안내: 진짜 생성형 AI(Gemini) 분석 리포트를 원하시면, 로컬 .env 파일에 'VITE_GEMINI_API_KEY=본인키'를 등록하시거나 Firebase Cloud Functions를 배포해주세요.`;
    } else {
      opinion = `[Market Status] The current price of ${coin.name}(${coin.symbol.toUpperCase()}) is ${new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(price)}, changing by ${change.toFixed(2)}% in the last 24 hours.
      [Technical Analysis] The 14-day RSI is currently at ${rsi}, showing an ${rsi > 70 ? 'overbought' : rsi < 30 ? 'oversold' : 'neutral'} condition. The price is currently ${ma === 'above' ? 'above' : ma === 'below' ? 'below' : 'aligned with'} the 20-day Simple Moving Average.
      [Strategy Evaluation] Comparing these conditions with your custom buy rules (${buyRulesText || 'RSI < 30'}) and sell rules (${sellRulesText || 'RSI > 70'}), the current indicators suggest a ${
        rsi < 30 ? 'buy signal entry' : 
        rsi > 70 ? 'sell signal exit / profit realization' : 
        'neutral hold position'
      }. The short-term price target is estimated at around ${formattedPriceTarget}.
      
      * 💡 Note: For genuine generative AI analysis, please configure 'VITE_GEMINI_API_KEY' in your local .env file or deploy the Firebase Cloud Functions.`;
    }

    return {
      coinName: coin.name,
      analysis: {
        recommendation: rec,
        priceTarget: formattedPriceTarget,
        opinion: opinion
      },
      relatedNews: [
        { title: `${coin.name} 가격 정보 및 차트 데이터 상세분석 (Coingecko 제공)`, url: `https://www.coingecko.com/en/coins/${coin.id}` }
      ]
    };
  };

  // --- AI Briefing Generator ---
  const fetchPersonalizedBriefing = async () => {
    setBriefingLoading(true);
    setBriefingError('');
    setAiBriefingResults([]);

    let coinIds = [];
    let coinNames = [];
    if (briefingCoin === 'all') {
      coinIds = selectedCoinIds;
      coinNames = selectedCoinIds.map(id => {
        const coin = allCoins.find(c => c.id === id);
        return coin ? coin.name : id;
      });
    } else {
      coinIds = [briefingCoin];
      const coin = allCoins.find(c => c.id === briefingCoin);
      coinNames = [coin ? coin.name : briefingCoin];
    }

    if (coinNames.length === 0) {
      setBriefingError(language === 'ko' ? "분석할 코인을 선택해 주세요." : "Please select coins to analyze.");
      setBriefingLoading(false);
      return;
    }

    // 1:1 유저 개인화 투자 맥락(Context) 구성
    const userContext = {
      favorites: favorites.map(id => {
        const coin = allCoins.find(c => c.id === id);
        return coin ? coin.name : id;
      }),
      watchlist: selectedCoinIds.map(id => {
        const coin = allCoins.find(c => c.id === id);
        return coin ? coin.name : id;
      }),
      backtestCapital,
      customStrategy: {
        buyRules: buyRules.map(r => ({ left: r.leftType, op: r.operator, right: r.rightType === 'constant' ? r.rightValue : r.rightType })),
        sellRules: sellRules.map(r => ({ left: r.leftType, op: r.operator, right: r.rightType === 'constant' ? r.rightValue : r.rightType }))
      }
    };

    try {
      const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
      let analysisData = null;

      if (geminiApiKey) {
        // Direct client-side call to Google Gemini API (local testing)
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `You are an expert crypto analyst AI. Analyze the following coins: ${coinNames.join(', ')}.
                Language: ${language === 'ko' ? 'Korean' : 'English'}.
                User Context:
                - Watchlist: ${userContext.watchlist.join(', ')}
                - Favorites: ${userContext.favorites.join(', ')}
                - Initial Capital: ${userContext.backtestCapital}
                - Custom Trading Strategy: Buy Rules (${JSON.stringify(userContext.customStrategy.buyRules)}), Sell Rules (${JSON.stringify(userContext.customStrategy.sellRules)})

                Please evaluate each coin based on its current market context, user watchlist, and custom rules.
                Return your response strictly as a raw JSON array matching this format (no markdown code blocks, just raw JSON text without \`\`\`json wrappers):
                [
                  {
                    "coinName": "Coin Name",
                    "analysis": {
                      "recommendation": "투자 판단 (e.g. 매수 고려 / 주의 필요 / 관망)",
                      "priceTarget": "단기 목표가 (e.g. ₩ 105,000,000)",
                      "opinion": "Detailed technical analysis opinion citing the user's custom rules and current market conditions..."
                    },
                    "relatedNews": [
                      { "title": "Related news title or analysis topic", "url": "https://coingecko.com" }
                    ]
                  }
                ]`
              }]
            }],
            generationConfig: {
              responseMimeType: "application/json"
            }
          })
        });

        if (response.ok) {
          const resJson = await response.json();
          let text = resJson.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
          // Clean possible markdown backticks
          text = text.replace(/^\s*```json/i, '').replace(/```\s*$/i, '').trim();
          analysisData = JSON.parse(text);
        } else {
          console.warn("Gemini Direct API 호출 실패, Cloud Function/로컬 분석 시도...");
        }
      } else {
        // Secure server-side call via Cloudflare Pages Function (production default)
        try {
          const response = await fetch('/api/briefing', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              lang: language,
              coins: coinNames,
              userContext
            })
          });
          if (response.ok) {
            let text = await response.text();
            text = text.replace(/^\s*```json/i, '').replace(/```\s*$/i, '').trim();
            analysisData = JSON.parse(text);
          } else {
            console.warn("Cloudflare Pages Function /api/briefing 호출 실패, Firebase/로컬 분석 시도...");
          }
        } catch (cfErr) {
          console.warn("Cloudflare Pages Function 호출 실패:", cfErr);
        }
      }

      if (!analysisData) {
        // Fallback to Firebase Cloud Function if deployed
        try {
          const callBriefing = httpsCallable(functions, 'getAIBriefing');
          const result = await callBriefing({ 
            lang: language, 
            coins: coinNames,
            userContext
          });
          analysisData = JSON.parse(result.data.candidates?.[0]?.content?.parts?.[0]?.text || '[]');
        } catch (funcErr) {
          console.warn("Cloud Function getAIBriefing 호출 실패, 로컬 분석 탑재:", funcErr);
          // Trigger local high-quality rule-based analysis
          analysisData = coinIds.map(id => generateLocalBriefing(id, userContext)).filter(Boolean);
        }
      }

      setAiBriefingResults(analysisData);
    } catch (error) {
      console.error("AI 브리핑 생성 과정 전체 에러:", error);
      // Final fallback to local rule-based analysis on any general error
      try {
        const fallbackData = coinIds.map(id => generateLocalBriefing(id, userContext)).filter(Boolean);
        if (fallbackData.length > 0) {
          setAiBriefingResults(fallbackData);
        } else {
          setBriefingError(t('briefing_error'));
        }
      } catch (fallbackErr) {
        setBriefingError(t('briefing_error'));
      }
    } finally {
      setBriefingLoading(false);
    }
  };

  // --- Post Opinion ---
  const handlePostOpinion = async () => {
    if (!opinionContent.trim() || !user) return;
    setOpinionPosting(true);
    try {
      let finalNickname = opinionNickname.trim() || user.displayName || 'Anonymous';
      if (isAnonymous) {
        const uidHash = user.uid.slice(0, 4);
        finalNickname = `${language === 'ko' ? '익명' : 'Anonymous'}_${uidHash}`;
      }
      
      await addDoc(collection(db, "opinions"), {
        uid: user.uid,
        nickname: finalNickname,
        content: opinionContent.trim(),
        createdAt: serverTimestamp(),
        coinTarget: document.querySelector('.ai-briefing-results-container h2')?.textContent || 'General'
      });
      setOpinionContent('');
    } catch (error) {
      console.error("의견 작성 실패:", error);
      alert(t('opinion_post_error'));
    } finally {
      setOpinionPosting(false);
    }
  };

  // --- Delete Opinion ---
  const handleDeleteOpinion = async (opinionId) => {
    if (confirm(t('enter_password_for_delete') || "정말로 이 의견을 삭제하시겠습니까?")) {
      try {
        await deleteDoc(doc(db, "opinions", opinionId));
      } catch (error) {
        console.error("의견 삭제 실패:", error);
        alert(t('delete_opinion_error'));
      }
    }
  };

  // --- Backtesting Simulator Engine ---
  const runBacktestSimulation = async () => {
    if (!backtestCoin) {
      alert(t('backtest_select_coin_warning'));
      return;
    }
    setBacktestLoading(true);
    setBacktestResults(null);

    try {
      // 1. 타임프레임별로 업비트 캔들 API URL 설정 (최대 200개 캔들)
      let candleUrl = '';
      const count = Math.min(parseInt(backtestPeriod) || 200, 200);
      const tf = backtestTimeframe.toLowerCase();
      
      if (tf === '5m') {
        candleUrl = `https://api.upbit.com/v1/candles/minutes/5?market=${backtestCoin}&count=${count}`;
      } else if (tf === '15m') {
        candleUrl = `https://api.upbit.com/v1/candles/minutes/15?market=${backtestCoin}&count=${count}`;
      } else if (tf === '30m') {
        candleUrl = `https://api.upbit.com/v1/candles/minutes/30?market=${backtestCoin}&count=${count}`;
      } else if (tf === '1h' || tf === '1h') {
        candleUrl = `https://api.upbit.com/v1/candles/minutes/60?market=${backtestCoin}&count=${count}`;
      } else if (tf === '4h' || tf === '4h') {
        candleUrl = `https://api.upbit.com/v1/candles/minutes/240?market=${backtestCoin}&count=${count}`;
      } else if (tf === '1w') {
        candleUrl = `https://api.upbit.com/v1/candles/weeks?market=${backtestCoin}&count=${count}`;
      } else {
        candleUrl = `https://api.upbit.com/v1/candles/days?market=${backtestCoin}&count=${count}`;
      }

      const rawCandles = await fetchWithCache(
        candleUrl,
        `backtestCandles_${backtestCoin}_${backtestTimeframe}_${count}`,
        3600 // 1시간 캐시
      );

      if (!rawCandles || rawCandles.length < 20) {
        throw new Error("충분한 가격 데이터가 제공되지 않았습니다. 업비트 점검 중이거나 지원하지 않는 마켓 코드일 수 있습니다.");
      }

      // 2. 시간순(과거->현재) 정렬 및 표준 포맷 변환
      const candles = rawCandles.slice().reverse().map(c => ({
        time: c.candle_date_time_kst || c.candle_date_time_utc,
        open: c.opening_price,
        high: c.high_price,
        low: c.low_price,
        close: c.trade_price,
        volume: c.candle_acc_trade_volume,
        timestamp: c.timestamp
      }));

      const closes = candles.map(c => c.close);
      const highs = candles.map(c => c.high);
      const lows = candles.map(c => c.low);
      const opens = candles.map(c => c.open);
      const volumes = candles.map(c => c.volume);

      // 3. 지표 계산 및 맵 구축
      const indicators = {};
      
      const ensureIndicator = (type, period, dev) => {
        const key = `${type}_${period}_${dev}`;
        if (indicators[key]) return;
        indicators[key] = calculateIndicator(type, period, dev, candles);
      };

      // 사용 중인 지표들 사전 준비
      const prepareRules = (rules) => {
        rules.forEach(rule => {
          if (rule.leftType !== 'constant' && !rule.leftType.startsWith('price_') && rule.leftType !== 'volume') {
            ensureIndicator(rule.leftType, parseInt(rule.leftPeriod) || 14, parseFloat(rule.leftDev) || 2);
          }
          if (rule.rightType !== 'constant' && !rule.rightType.startsWith('price_') && rule.rightType !== 'volume') {
            ensureIndicator(rule.rightType, parseInt(rule.rightPeriod) || 14, parseFloat(rule.rightDev) || 2);
          }
        });
      };

      // 전략 설정에 맞춰 활성 룰 설정
      let activeBuyRules = [...buyRules];
      let activeSellRules = [...sellRules];
      let activeBuyOperator = buyLogicalOperator;
      let activeSellOperator = sellLogicalOperator;

      if (backtestStrategy === 'rsi') {
        activeBuyRules = [{ id: 'b_rsi', leftType: 'rsi', leftPeriod: 14, leftDev: 2, operator: '<', rightType: 'constant', rightPeriod: 14, rightDev: 2, rightValue: 30 }];
        activeSellRules = [{ id: 's_rsi', leftType: 'rsi', leftPeriod: 14, leftDev: 2, operator: '>', rightType: 'constant', rightPeriod: 14, rightDev: 2, rightValue: 70 }];
        activeBuyOperator = 'AND';
        activeSellOperator = 'AND';
      } else if (backtestStrategy === 'ma') {
        activeBuyRules = [{ id: 'b_ma', leftType: 'sma', leftPeriod: 5, leftDev: 2, operator: 'cross_above', rightType: 'sma', rightPeriod: 20, rightDev: 2, rightValue: 0 }];
        activeSellRules = [{ id: 's_ma', leftType: 'sma', leftPeriod: 5, leftDev: 2, operator: 'cross_under', rightType: 'sma', rightPeriod: 20, rightDev: 2, rightValue: 0 }];
        activeBuyOperator = 'AND';
        activeSellOperator = 'AND';
      } else if (backtestStrategy === 'bb') {
        activeBuyRules = [{ id: 'b_bb', leftType: 'price_close', leftPeriod: 20, leftDev: 2, operator: '<', rightType: 'bb_lower', rightPeriod: 20, rightDev: 2, rightValue: 0 }];
        activeSellRules = [{ id: 's_bb', leftType: 'price_close', leftPeriod: 20, leftDev: 2, operator: '>', rightType: 'bb_upper', rightPeriod: 20, rightDev: 2, rightValue: 0 }];
        activeBuyOperator = 'AND';
        activeSellOperator = 'AND';
      } else if (backtestStrategy === 'macd') {
        activeBuyRules = [{ id: 'b_macd', leftType: 'macd_line', leftPeriod: 12, leftDev: 2, operator: 'cross_above', rightType: 'macd_signal', rightPeriod: 26, rightDev: 2, rightValue: 0 }];
        activeSellRules = [{ id: 's_macd', leftType: 'macd_line', leftPeriod: 12, leftDev: 2, operator: 'cross_under', rightType: 'macd_signal', rightPeriod: 26, rightDev: 2, rightValue: 0 }];
        activeBuyOperator = 'AND';
        activeSellOperator = 'AND';
      }

      prepareRules(activeBuyRules);
      prepareRules(activeSellRules);

      // 피연산자 평가 함수
      const evalOp = (type, period, dev, value, idx) => {
        if (type === 'constant') return parseFloat(value) || 0;
        if (type === 'price_close') return candles[idx].close;
        if (type === 'price_open') return candles[idx].open;
        if (type === 'price_high') return candles[idx].high;
        if (type === 'price_low') return candles[idx].low;
        if (type === 'volume') return candles[idx].volume;
        
        const p = parseInt(period) || 14;
        const d = parseFloat(dev) || 2;
        const key = `${type}_${p}_${d}`;
        return indicators[key] ? indicators[key][idx] : 0;
      };

      // 단일 규칙 검증 함수
      const checkRule = (rule, idx) => {
        const leftVal = evalOp(rule.leftType, rule.leftPeriod, rule.leftDev, rule.rightValue, idx);
        const rightVal = evalOp(rule.rightType, rule.rightPeriod, rule.rightDev, rule.rightValue, idx);

        if (leftVal === null || rightVal === null) return false;

        if (rule.operator === 'cross_above') {
          if (idx === 0) return false;
          const prevLeft = evalOp(rule.leftType, rule.leftPeriod, rule.leftDev, rule.rightValue, idx - 1);
          const prevRight = evalOp(rule.rightType, rule.rightPeriod, rule.rightDev, rule.rightValue, idx - 1);
          if (prevLeft === null || prevRight === null) return false;
          return prevLeft <= prevRight && leftVal > rightVal;
        }
        if (rule.operator === 'cross_under') {
          if (idx === 0) return false;
          const prevLeft = evalOp(rule.leftType, rule.leftPeriod, rule.leftDev, rule.rightValue, idx - 1);
          const prevRight = evalOp(rule.rightType, rule.rightPeriod, rule.rightDev, rule.rightValue, idx - 1);
          if (prevLeft === null || prevRight === null) return false;
          return prevLeft >= prevRight && leftVal < rightVal;
        }

        if (rule.operator === '>') return leftVal > rightVal;
        if (rule.operator === '<') return leftVal < rightVal;
        if (rule.operator === '>=') return leftVal >= rightVal;
        if (rule.operator === '<=') return leftVal <= rightVal;

        return false;
      };

      // 규칙 조합 검증 함수
      const checkGroup = (rules, op, idx) => {
        if (rules.length === 0) return false;
        if (op === 'AND') {
          return rules.every(rule => checkRule(rule, idx));
        } else {
          return rules.some(rule => checkRule(rule, idx));
        }
      };

      // 4. 시뮬레이션 가동
      let cash = backtestCapital;
      let holdings = 0;
      const tradeLog = [];
      const equityCurve = [];
      
      const startIndex = Math.min(25, candles.length - 2);

      for (let i = startIndex; i < candles.length; i++) {
        const price = candles[i].close;
        const dateObj = new Date(candles[i].time);
        const date = ['5m', '15m', '30m', '1h', '4h'].includes(backtestTimeframe)
          ? `${dateObj.getMonth() + 1}/${dateObj.getDate()} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`
          : dateObj.toLocaleDateString(language);

        const buySignal = checkGroup(activeBuyRules, activeBuyOperator, i) && holdings === 0;
        const sellSignal = checkGroup(activeSellRules, activeSellOperator, i) && holdings > 0;

        if (buySignal) {
          holdings = (cash * 0.999) / price;
          tradeLog.push({
            type: 'buy',
            date,
            time: candles[i].time,
            price,
            cashSpent: cash,
            holdingsBought: holdings
          });
          cash = 0;
        } else if (sellSignal) {
          const cashReceived = holdings * price * 0.999;
          const lastBuy = [...tradeLog].reverse().find(t => t.type === 'buy');
          const returnVal = lastBuy ? ((price * 0.999 - lastBuy.price) / lastBuy.price) * 100 : 0;
          
          tradeLog.push({
            type: 'sell',
            date,
            time: candles[i].time,
            price,
            cashReceived,
            returnPercentage: returnVal
          });
          cash = cashReceived;
          holdings = 0;
        }

        const currentPortfolioValue = cash + holdings * price;
        equityCurve.push([candles[i].time, currentPortfolioValue]);
      }

      // 최종 통계 계산
      const finalAssets = cash + holdings * closes[closes.length - 1];
      const totalReturn = ((finalAssets - backtestCapital) / backtestCapital) * 100;
      const holdReturn = ((closes[closes.length - 1] - closes[startIndex]) / closes[startIndex]) * 100;

      const sellTrades = tradeLog.filter(t => t.type === 'sell');
      const winCount = sellTrades.filter(t => t.returnPercentage > 0).length;
      const winRate = sellTrades.length > 0 ? (winCount / sellTrades.length) * 100 : 0;

      let peak = backtestCapital;
      let maxDrawdown = 0;
      equityCurve.forEach(p => {
        const val = p[1];
        if (val > peak) peak = val;
        const drawdown = ((peak - val) / peak) * 100;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
      });

      setBacktestResults({
        totalReturn,
        holdReturn,
        winRate,
        mdd: maxDrawdown,
        finalAssets,
        tradeCount: tradeLog.length,
        trades: tradeLog.reverse(),
        equityCurve,
        priceCurve: candles.slice(startIndex).map(c => [c.time, (c.close / closes[startIndex]) * backtestCapital]),
        timeframe: backtestTimeframe,
        candles: candles.slice(startIndex)
      });

    } catch (error) {
      console.error("백테스트 에러:", error);
      alert(error.message || "시뮬레이션 가동에 실패했습니다.");
    } finally {
      setBacktestLoading(false);
    }
  };

  // --- Real-time Strategy Scanner ---
  const runStrategyScanner = async () => {
    setScannerLoading(true);
    setScannerResults([]);
    setScannerProgress('');
    
    // Top 10 coins to scan (Upbit API Migration)
    const scannerCoins = [
      { id: 'KRW-BTC', symbol: 'btc', name: '비트코인' },
      { id: 'KRW-ETH', symbol: 'eth', name: '이더리움' },
      { id: 'KRW-SOL', symbol: 'sol', name: '솔라나' },
      { id: 'KRW-XRP', symbol: 'xrp', name: '리플' },
      { id: 'KRW-DOGE', symbol: 'doge', name: '도지코인' },
      { id: 'KRW-ADA', symbol: 'ada', name: '에이다' },
      { id: 'KRW-DOT', symbol: 'dot', name: '폴카닷' },
      { id: 'KRW-AVAX', symbol: 'avax', name: '아발란체' },
      { id: 'KRW-LINK', symbol: 'link', name: '체인링크' },
      { id: 'KRW-TRX', symbol: 'trx', name: '트론' }
    ];

    const results = [];

    try {
      for (let i = 0; i < scannerCoins.length; i++) {
        const coin = scannerCoins[i];
        setScannerProgress(`실시간 필터링 분석 중: ${coin.name} (${i + 1}/${scannerCoins.length}) ...`);
        
        try {
          let candleUrl = '';
          const count = 100; // 스캔에 필요한 캔들 수
          const tf = backtestTimeframe.toLowerCase();
          
          if (tf === '5m') {
            candleUrl = `https://api.upbit.com/v1/candles/minutes/5?market=${coin.id}&count=${count}`;
          } else if (tf === '15m') {
            candleUrl = `https://api.upbit.com/v1/candles/minutes/15?market=${coin.id}&count=${count}`;
          } else if (tf === '30m') {
            candleUrl = `https://api.upbit.com/v1/candles/minutes/30?market=${coin.id}&count=${count}`;
          } else if (tf === '1h') {
            candleUrl = `https://api.upbit.com/v1/candles/minutes/60?market=${coin.id}&count=${count}`;
          } else if (tf === '4h') {
            candleUrl = `https://api.upbit.com/v1/candles/minutes/240?market=${coin.id}&count=${count}`;
          } else if (tf === '1w') {
            candleUrl = `https://api.upbit.com/v1/candles/weeks?market=${coin.id}&count=${count}`;
          } else {
            candleUrl = `https://api.upbit.com/v1/candles/days?market=${coin.id}&count=${count}`;
          }

          const cacheKey = `scannerCandles_${coin.id}_${backtestTimeframe}`;
          const cached = localStorage.getItem(cacheKey);
          let rawCandles = null;
          let isFromCache = false;

          if (cached) {
            try {
              const { timestamp, data } = JSON.parse(cached);
              if (Date.now() - timestamp < 900 * 1000) { // 15분 캐시
                rawCandles = data;
                isFromCache = true;
              }
            } catch (e) {}
          }

          if (!rawCandles) {
            const response = await fetch(candleUrl);
            if (response.ok) {
              rawCandles = await response.json();
              localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: rawCandles }));
            }
          }
          
          if (!rawCandles || rawCandles.length < 20) {
            continue;
          }

          // 시간순(과거->현재) 정렬 및 변환
          const candles = rawCandles.slice().reverse().map(c => ({
            time: c.candle_date_time_kst || c.candle_date_time_utc,
            open: c.opening_price,
            high: c.high_price,
            low: c.low_price,
            close: c.trade_price,
            volume: c.candle_acc_trade_volume,
            timestamp: c.timestamp
          }));

          const closes = candles.map(c => c.close);
          
          const indicators = {};
          const ensureIndicator = (type, period, dev) => {
            const key = `${type}_${period}_${dev}`;
            if (indicators[key]) return;
            indicators[key] = calculateIndicator(type, period, dev, candles);
          };

          let activeBuyRules = [...buyRules];
          let activeSellRules = [...sellRules];
          let activeBuyOperator = buyLogicalOperator;
          let activeSellOperator = sellLogicalOperator;

          const prepareRules = (rules) => {
            rules.forEach(rule => {
              if (rule.leftType !== 'constant' && !rule.leftType.startsWith('price_') && rule.leftType !== 'volume') {
                ensureIndicator(rule.leftType, parseInt(rule.leftPeriod) || 14, parseFloat(rule.leftDev) || 2);
              }
              if (rule.rightType !== 'constant' && !rule.rightType.startsWith('price_') && rule.rightType !== 'volume') {
                ensureIndicator(rule.rightType, parseInt(rule.rightPeriod) || 14, parseFloat(rule.rightDev) || 2);
              }
            });
          };

          prepareRules(activeBuyRules);
          prepareRules(activeSellRules);

          const evalOp = (type, period, dev, value, idx) => {
            if (type === 'constant') return parseFloat(value) || 0;
            if (type === 'price_close') return candles[idx].close;
            if (type === 'price_open') return candles[idx].open;
            if (type === 'price_high') return candles[idx].high;
            if (type === 'price_low') return candles[idx].low;
            if (type === 'volume') return candles[idx].volume;
            
            const p = parseInt(period) || 14;
            const d = parseFloat(dev) || 2;
            const key = `${type}_${p}_${d}`;
            return indicators[key] ? indicators[key][idx] : 0;
          };

          const checkRule = (rule, idx) => {
            const leftVal = evalOp(rule.leftType, rule.leftPeriod, rule.leftDev, rule.rightValue, idx);
            const rightVal = evalOp(rule.rightType, rule.rightPeriod, rule.rightDev, rule.rightValue, idx);
            if (leftVal === null || rightVal === null) return false;

            if (rule.operator === 'cross_above') {
              if (idx === 0) return false;
              const prevLeft = evalOp(rule.leftType, rule.leftPeriod, rule.leftDev, rule.rightValue, idx - 1);
              const prevRight = evalOp(rule.rightType, rule.rightPeriod, rule.rightDev, rule.rightValue, idx - 1);
              return prevLeft <= prevRight && leftVal > rightVal;
            }
            if (rule.operator === 'cross_under') {
              if (idx === 0) return false;
              const prevLeft = evalOp(rule.leftType, rule.leftPeriod, rule.leftDev, rule.rightValue, idx - 1);
              const prevRight = evalOp(rule.rightType, rule.rightPeriod, rule.rightDev, rule.rightValue, idx - 1);
              return prevLeft >= prevRight && leftVal < rightVal;
            }
            if (rule.operator === '>') return leftVal > rightVal;
            if (rule.operator === '<') return leftVal < rightVal;
            if (rule.operator === '>=') return leftVal >= rightVal;
            if (rule.operator === '<=') return leftVal <= rightVal;
            return false;
          };

          const checkGroup = (rules, op, idx) => {
            if (rules.length === 0) return false;
            return op === 'AND' ? rules.every(r => checkRule(r, idx)) : rules.some(r => checkRule(r, idx));
          };

          const lastIdx = candles.length - 1;
          const currentPrice = closes[lastIdx];
          const prevPrice = closes[lastIdx - 1] || currentPrice;
          const pctChange = ((currentPrice - prevPrice) / prevPrice) * 100;

          const isBuy = checkGroup(activeBuyRules, activeBuyOperator, lastIdx);
          const isSell = checkGroup(activeSellRules, activeSellOperator, lastIdx);

          let signal = 'HOLD';
          if (isBuy && !isSell) signal = 'BUY';
          else if (isSell && !isBuy) signal = 'SELL';

          results.push({
            id: coin.id,
            name: coin.name,
            symbol: coin.symbol,
            price: currentPrice,
            change: pctChange,
            signal
          });
          
          if (!isFromCache && i < scannerCoins.length - 1) {
            await sleep(11000);
          }
        } catch (err) {
          console.error(`${coin.name} 스캔 실패:`, err);
        }
      }

      setScannerResults(results.filter(Boolean));
    } catch (error) {
      console.error("전략 스캐너 실행 오류:", error);
      alert("스캐너 실행 중 오류가 발생했습니다.");
    } finally {
      setScannerLoading(false);
    }
  };

  // Rendering Backtest Chart
  useEffect(() => {
    if (!backtestResults || !backtestChartRef.current) return;

    const ctx = backtestChartRef.current.getContext('2d');
    if (backtestChartInstance.current) backtestChartInstance.current.destroy();

    const labels = backtestResults.equityCurve.map(p => {
      const dateObj = new Date(p[0]);
      return ['5m', '15m', '30m', '1h', '4h'].includes(backtestResults.timeframe)
        ? `${dateObj.getMonth() + 1}/${dateObj.getDate()} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`
        : dateObj.toLocaleDateString(language);
    });

    const strategyData = backtestResults.equityCurve.map(p => p[1]);
    const holdData = backtestResults.priceCurve.map(p => p[1]);

    // Build buy and sell markers mapping
    const buyTimes = new Set();
    const sellTimes = new Set();
    backtestResults.trades.forEach(t => {
      if (t.type === 'buy') buyTimes.add(t.time);
      if (t.type === 'sell') sellTimes.add(t.time);
    });

    const buyMarkers = [];
    const sellMarkers = [];

    backtestResults.equityCurve.forEach(p => {
      const time = p[0];
      const val = p[1];
      if (buyTimes.has(time)) {
        buyMarkers.push(val);
        sellMarkers.push(null);
      } else if (sellTimes.has(time)) {
        buyMarkers.push(null);
        sellMarkers.push(val);
      } else {
        buyMarkers.push(null);
        sellMarkers.push(null);
      }
    });

    backtestChartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: t('backtest_title'),
            data: strategyData,
            borderColor: '#00f2fe',
            backgroundColor: 'rgba(0, 242, 254, 0.05)',
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 0,
            fill: true,
          },
          {
            label: t('backtest_stat_hold_return'),
            data: holdData,
            borderColor: 'rgba(255, 255, 255, 0.25)',
            borderWidth: 1.5,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false,
          },
          {
            label: language === 'ko' ? '매수 지점 (Buy)' : 'Buy Point',
            data: buyMarkers,
            borderColor: '#22c55e',
            backgroundColor: '#22c55e',
            pointStyle: 'circle',
            pointRadius: 6,
            pointHoverRadius: 8,
            showLine: false,
            fill: false,
          },
          {
            label: language === 'ko' ? '매도 지점 (Sell)' : 'Sell Point',
            data: sellMarkers,
            borderColor: '#ef4444',
            backgroundColor: '#ef4444',
            pointStyle: 'circle',
            pointRadius: 6,
            pointHoverRadius: 8,
            showLine: false,
            fill: false,
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            ticks: { color: '#94a3b8', font: { family: 'Space Grotesk' } },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          },
          x: {
            ticks: { color: '#94a3b8', font: { family: 'Space Grotesk' } },
            grid: { color: 'transparent' }
          }
        },
        plugins: {
          legend: { 
            display: true, 
            labels: { color: '#94a3b8', font: { family: 'Space Grotesk', size: 10 } } 
          }
        }
      }
    });

    return () => {
      if (backtestChartInstance.current) {
        backtestChartInstance.current.destroy();
        backtestChartInstance.current = null;
      }
    };
  }, [backtestResults, language]);

  // --- Display calculations ---
  const filteredCoins = displayedCoins.filter(c => {
    const searchMatch = searchTerm === '' || c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.symbol.toLowerCase().includes(searchTerm.toLowerCase());
    const watchlistMatch = !watchlistOnly || favorites.includes(c.id);
    return searchMatch && watchlistMatch;
  });

  const sortedCoins = [...filteredCoins].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'price') return b.current_price - a.current_price;
    if (sortBy === 'change') return b.price_change_percentage_24h - a.price_change_percentage_24h;
    return 0;
  });

  const changeLanguage = (lang) => {
    setLanguage(lang);
    setCurrency(lang === 'ko' ? 'krw' : 'usd');
    localStorage.setItem('cryptoLang', lang);
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="main-header">
        <a href="#" className="logo-text" onClick={(e) => { e.preventDefault(); setActiveTab('home'); setIsMobileMenuOpen(false); }}>Oracoin</a>
        
        {/* Desktop Navigation */}
        <nav className="main-nav desktop-only">
          <a href="#" className={`nav-link ${activeTab === 'home' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('home'); }}>홈</a>
          <a href="#" className={`nav-link ${activeTab === 'blog' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('blog'); }}>AI 브리핑</a>
          <a href="#" className={`nav-link ${activeTab === 'backtest' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('backtest'); }}>{t('backtest_tab')}</a>
          <a href="#" className={`nav-link ${activeTab === 'about' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('about'); }}>소개</a>
        </nav>

        {/* Right side group containing both auth and toggle */}
        <div className="header-right-group">
          <div className="header-right">
            {user ? (
              <button 
                className="filter-btn" 
                onClick={handleGoogleLogout}
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
              >
                {user.displayName.split(' ')[0]} (Logout)
              </button>
            ) : (
              <button 
                className="btn-accent" 
                onClick={handleGoogleLogin}
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
              >
                Google Login
              </button>
            )}
            
            <div className="desktop-only" style={{ display: 'flex', gap: '0.25rem' }}>
              <button className={`filter-btn ${language === 'ko' ? 'active' : ''}`} onClick={() => changeLanguage('ko')} style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>KO</button>
              <button className={`filter-btn ${language === 'en' ? 'active' : ''}`} onClick={() => changeLanguage('en')} style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>EN</button>
            </div>
          </div>

          {/* Mobile Menu Toggle Button */}
          <button 
            className={`mobile-menu-toggle ${isMobileMenuOpen ? 'active' : ''}`} 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            <span className="hamburger-bar"></span>
            <span className="hamburger-bar"></span>
            <span className="hamburger-bar"></span>
          </button>
        </div>

        {/* Mobile Navigation Menu Overlay */}
        <div className={`mobile-nav-overlay ${isMobileMenuOpen ? 'open' : ''}`}>
          <nav className="mobile-nav-links">
            <a href="#" className={`mobile-nav-link ${activeTab === 'home' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('home'); setIsMobileMenuOpen(false); }}>홈</a>
            <a href="#" className={`mobile-nav-link ${activeTab === 'blog' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('blog'); setIsMobileMenuOpen(false); }}>AI 브리핑</a>
            <a href="#" className={`mobile-nav-link ${activeTab === 'backtest' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('backtest'); setIsMobileMenuOpen(false); }}>{t('backtest_tab')}</a>
            <a href="#" className={`mobile-nav-link ${activeTab === 'about' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('about'); setIsMobileMenuOpen(false); }}>소개</a>
          </nav>
          
          <div className="mobile-nav-actions">
            <div style={{ display: 'flex', gap: '0.5rem', width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}>
              <button className={`filter-btn ${language === 'ko' ? 'active' : ''}`} onClick={() => { changeLanguage('ko'); setIsMobileMenuOpen(false); }} style={{ flex: 1, padding: '0.5rem' }}>KO</button>
              <button className={`filter-btn ${language === 'en' ? 'active' : ''}`} onClick={() => { changeLanguage('en'); setIsMobileMenuOpen(false); }} style={{ flex: 1, padding: '0.5rem' }}>EN</button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="dashboard-layout">
        {activeTab === 'home' && (
          <>
            {/* Sidebar with all 100 coins */}
            <aside className="sidebar">
              <h2 className="sidebar-title">{t('sidebar_title')}</h2>
              {limitMessageVisible && <p style={{ color: 'var(--color-red)', fontSize: '0.75rem', textAlign: 'center' }}>{t('limit_message')}</p>}
              <div className="sidebar-list">
                {allCoins.map(coin => {
                  const isSelected = selectedCoinIds.includes(coin.id);
                  return (
                    <div className="coin-sidebar-item" key={coin.id}>
                      <div className="coin-sidebar-info">
                        <img src={coin.image} alt={coin.name} className="coin-sidebar-img" />
                        <span className="coin-sidebar-name">{coin.name}</span>
                      </div>
                      <button 
                        className="btn-icon" 
                        onClick={() => handleAddCoin(coin.id)}
                        disabled={isSelected}
                        style={{ color: isSelected ? 'rgba(255,255,255,0.1)' : 'var(--color-green)', cursor: isSelected ? 'not-allowed' : 'pointer' }}
                      >
                        +
                      </button>
                    </div>
                  );
                })}
              </div>
              
              {/* Sidebar Ad Banner (Desktop Only) */}
              <div className="desktop-only" style={{ marginTop: 'auto', paddingTop: '1.25rem', width: '100%', display: 'flex', justifyContent: 'center' }}>
                <KakaoAd adUnit="DAN-YOUR_SIDEBAR_AD_UNIT" width="160" height="600" />
              </div>
            </aside>

            {/* Main Cards View */}
            <main className="dashboard-content">
              <div className="container-inner">
                {/* Fear & Greed index */}
                {!fearGreed.loading && (
                  <div className="fng-card glass-panel">
                    <div className="fng-info">
                      <span className="indicator-title">{t('fear_greed_title')}</span>
                      <div className="fng-value-display">
                        <span className="fng-value">{fearGreed.value}</span>
                        <span className={`fng-text ${
                          fearGreed.value >= 75 ? 'text-green' :
                          fearGreed.value >= 55 ? 'text-gold' :
                          fearGreed.value >= 45 ? 'text-secondary-style' :
                          'text-red'
                        }`}>
                          {fearGreed.classification}
                        </span>
                      </div>
                    </div>
                    {/* Visual Gauge */}
                    <div className="fng-gauge-track">
                      <div 
                        className="fng-gauge-fill" 
                        style={{ 
                          transform: `rotate(${(fearGreed.value / 100) * 180 - 90}deg)`,
                          background: fearGreed.value >= 75 ? 'var(--color-green)' :
                                      fearGreed.value >= 55 ? 'var(--color-gold)' :
                                      fearGreed.value >= 45 ? 'var(--text-secondary)' :
                                      'var(--color-red)'
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Home Top Leaderboard Ad */}
                <KakaoAd adUnit="DAN-qfq0xsFo8mOaufgN" width="728" height="90" />

                {/* Search & Filters */}
                <div className="toolbar glass-panel">
                  <div className="search-wrapper">
                    <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <input 
                      type="text" 
                      className="search-input" 
                      placeholder={t('search_placeholder')}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>

                  <div className="filter-btn-group">
                    <button className={`filter-btn ${sortBy === 'name' ? 'active' : ''}`} onClick={() => setSortBy('name')}>{t('sort_name')}</button>
                    <button className={`filter-btn ${sortBy === 'price' ? 'active' : ''}`} onClick={() => setSortBy('price')}>{t('sort_price')}</button>
                    <button className={`filter-btn ${sortBy === 'change' ? 'active' : ''}`} onClick={() => setSortBy('change')}>{t('sort_change')}</button>
                  </div>

                  <div className="toggle-switch-wrapper" onClick={() => setWatchlistOnly(!watchlistOnly)}>
                    <span className="toggle-switch-label">{t('watchlist')}</span>
                    <input 
                      type="checkbox" 
                      checked={watchlistOnly} 
                      onChange={() => {}}
                      style={{ cursor: 'pointer' }}
                    />
                  </div>
                </div>

                {/* Coin Grid */}
                {loadingCoins ? (
                  <div className="crypto-grid">
                    {selectedCoinIds.map(id => (
                      <div className="skeleton-card animate-pulse glass-panel p-12 flex-center" key={id} style={{ height: '320px' }}>
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                      </div>
                    ))}
                  </div>
                ) : selectedCoinIds.length === 0 ? (
                  <div className="glass-panel p-12 text-center-align">
                    <p style={{ color: 'var(--text-secondary)' }}>{t('add_coin_prompt')}</p>
                  </div>
                ) : sortedCoins.length === 0 ? (
                  <div className="glass-panel p-12 text-center-align">
                    <p style={{ color: 'var(--text-secondary)' }}>{t('no_results_text')}</p>
                  </div>
                ) : (
                  <div className="crypto-grid">
                    {sortedCoins.map(coin => {
                      const isFavorite = favorites.includes(coin.id);
                      const priceChange = coin.price_change_percentage_24h || 0;
                      const formattedPrice = new Intl.NumberFormat(language, { 
                        style: 'currency', 
                        currency: currency,
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: priceChange > 100 ? 0 : 2 
                      }).format(coin.current_price);
                      
                      const { evalClass, evalText } = getEvaluation(coin.rsi, coin.ma_20_day_comparison);
                      const { rsiClass, rsiText } = getRsiStatus(coin.rsi);
                      const { maClass, maText } = getMaStatus(coin.ma_20_day_comparison);

                      // Sentiment variables
                      const coinVotes = votes[coin.id] || { bullish: 0, bearish: 0 };
                      const totalC = coinVotes.bullish + coinVotes.bearish;
                      const bullishPct = totalC > 0 ? (coinVotes.bullish / totalC) * 100 : 50;
                      const bearishPct = totalC > 0 ? (coinVotes.bearish / totalC) * 100 : 50;

                      return (
                        <div 
                          className="crypto-card glass-panel" 
                          key={coin.id}
                          onClick={() => setSelectedModalCoinId(coin.id)}
                        >
                          <div className="card-header">
                            <div className="coin-profile">
                              <img src={coin.image} alt={coin.name} className="coin-profile-img" />
                              <div>
                                <h3 className="coin-profile-name">{coin.name}</h3>
                                <span className="coin-profile-symbol">{coin.symbol}</span>
                              </div>
                            </div>

                            <div className="card-actions">
                              <button 
                                className={`btn-icon ${isFavorite ? 'favorited' : ''}`}
                                onClick={(e) => { e.stopPropagation(); handleFavorite(coin.id); }}
                              >
                                ★
                              </button>
                              <button 
                                className="btn-icon remove"
                                onClick={(e) => handleRemoveCoin(coin.id, e)}
                              >
                                &times;
                              </button>
                            </div>
                          </div>

                          <div className="card-body">
                            <p className="coin-price">{formattedPrice}</p>
                            <p className={`coin-change ${priceChange >= 0 ? 'text-green' : 'text-red'}`}>
                              {priceChange >= 0 ? '▲' : '▼'} {Math.abs(priceChange).toFixed(2)}%
                            </p>
                          </div>

                          {/* Sentiment Poll Bar */}
                          <div className="vote-container" onClick={(e) => e.stopPropagation()}>
                            <div className="sentiment-bar-wrapper">
                              <span>🚀 {bullishPct.toFixed(0)}%</span>
                              <span style={{ fontSize: '0.65rem' }}>{t('votes_sentiment_title')}</span>
                              <span>{bearishPct.toFixed(0)}% 🐻</span>
                            </div>
                            <div className="sentiment-bar">
                              <div className="sentiment-fill-bullish" style={{ width: `${bullishPct}%` }} />
                              <div className="sentiment-fill-bearish" style={{ width: `${bearishPct}%` }} />
                            </div>
                            <div className="vote-btn-group" style={{ marginTop: '0.15rem' }}>
                              <button className="vote-btn bullish" onClick={() => handleVote(coin.id, 'bullish')}>🚀</button>
                              <button className="vote-btn bearish" onClick={() => handleVote(coin.id, 'bearish')}>🐻</button>
                            </div>
                          </div>

                          <div className="card-footer">
                            <p className="indicator-title">{t('evaluation')}</p>
                            <div className="rating-display">
                              <p className={`rating-text ${evalClass}`}>{evalText}</p>
                            </div>
                            <div className="indicator-item" style={{ marginTop: '0.25rem' }}>
                              <span className="indicator-name">RSI:</span>
                              <span className={rsiClass}>{rsiText} ({coin.rsi ? coin.rsi.toFixed(1) : 'N/A'})</span>
                            </div>
                            <div className="indicator-item">
                              <span className="indicator-name">MA(20):</span>
                              <span className={maClass}>{maText}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </main>
          </>
        )}

        {/* AI Briefing Tab */}
        {activeTab === 'blog' && (
          <main className="dashboard-content w-full-style">
            <div className="container-inner m-auto" style={{ maxWidth: '850px' }}>
              <div className="ai-briefing-wrapper">
                <div className="ai-briefing-header">
                  <h1>{t('blog_title')}</h1>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>{t('blog_subtitle')}</p>
                </div>

                <div className="selected-coins-box glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: '700' }}>{t('analysis_target')}</h3>
                  
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: '220px' }}>
                      <input 
                        type="text" 
                        className="input-text" 
                        style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem', marginBottom: '0.25rem' }} 
                        placeholder={t('backtest_search_coin')} 
                        value={briefingCoinSearch}
                        onChange={(e) => setBriefingCoinSearch(e.target.value)}
                      />
                      <select 
                        className="input-select"
                        style={{ fontSize: '0.8rem', padding: '0.4rem' }}
                        value={briefingCoin}
                        onChange={(e) => setBriefingCoin(e.target.value)}
                      >
                        <option value="all">{language === 'ko' ? '⭐ 관심 목록 코인 전체' : '⭐ All Watchlist Coins'}</option>
                        {allCoins
                          .filter(coin => 
                            coin.name.toLowerCase().includes(briefingCoinSearch.toLowerCase()) || 
                            coin.symbol.toLowerCase().includes(briefingCoinSearch.toLowerCase())
                          )
                          .map(coin => (
                            <option value={coin.id} key={coin.id}>{coin.name} ({coin.symbol.toUpperCase()})</option>
                          ))
                        }
                      </select>
                    </div>

                    <div className="coins-chips-container" style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', flex: 1 }}>
                      {briefingCoin === 'all' ? (
                        selectedCoinIds.length === 0 ? (
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{t('add_coin_for_briefing')}</p>
                        ) : (
                          selectedCoinIds.map(id => {
                            const coin = allCoins.find(c => c.id === id);
                            return (
                              <span className="coin-chip" key={id} style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}>
                                {coin && <img src={coin.image} alt={coin.name} className="coin-chip-img" />}
                                {coin ? coin.name : id}
                              </span>
                            );
                          })
                        )
                      ) : (
                        (() => {
                          const coin = allCoins.find(c => c.id === briefingCoin);
                          return (
                            <span className="coin-chip" key={briefingCoin} style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}>
                              {coin && <img src={coin.image} alt={coin.name} className="coin-chip-img" />}
                              {coin ? coin.name : briefingCoin}
                            </span>
                          );
                        })()
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-center-align">
                  <button 
                    className="btn-primary" 
                    onClick={fetchPersonalizedBriefing}
                    disabled={((briefingCoin === 'all' && selectedCoinIds.length === 0) || briefingLoading)}
                  >
                    {briefingLoading ? t('ai_loading') : t('fetch_briefing_btn')}
                  </button>
                </div>

                {/* AI Briefing Results */}
                {briefingLoading && (
                  <div className="glass-panel p-12 flex-center" style={{ flexDirection: 'column', gap: '1rem' }}>
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400"></div>
                    <p style={{ color: 'var(--text-secondary)' }}>{t('ai_loading')}</p>
                  </div>
                )}

                {briefingError && (
                  <div className="glass-panel p-12 text-center-align">
                    <p style={{ color: 'var(--color-red)' }}>{briefingError}</p>
                  </div>
                )}

                {!briefingLoading && aiBriefingResults.length > 0 && (
                  <div className="ai-briefing-results-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {aiBriefingResults.map((item, index) => {
                      const rec = item.analysis.recommendation || "";
                      const recClass = rec.includes(t('rec_buy_keyword')) ? 'text-green bg-green/10' : 
                                       rec.includes(t('rec_sell_keyword')) ? 'text-red bg-red/10' :
                                       'text-secondary-style bg-white/5';
                      
                      return (
                        <div className="ai-card glass-panel" key={index}>
                          <h2 style={{ fontSize: '1.4rem', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                            {item.coinName} AI 분석 리포트
                          </h2>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '700' }}>{t('recommendation_title')}</span>
                              <p style={{ fontSize: '1.1rem', fontWeight: '700', marginTop: '0.25rem' }} className={recClass}>{rec}</p>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '700' }}>{t('price_target_title')}</span>
                              <p style={{ fontSize: '1.1rem', fontWeight: '700', marginTop: '0.25rem' }}>{item.analysis.priceTarget}</p>
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <h3 style={{ fontSize: '1.05rem', fontWeight: '700' }}>{t('ai_opinion_title')}</h3>
                            <p className="ai-opinion-text">{item.analysis.opinion}</p>
                          </div>

                          {item.relatedNews && item.relatedNews.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <h3 style={{ fontSize: '1.05rem', fontWeight: '700' }}>{t('related_news_title')}</h3>
                              <ul className="ai-news-list">
                                {item.relatedNews.map((news, idx) => (
                                  <li className="ai-news-item" key={idx}>
                                    <a href={news.url} target="_blank" rel="noopener noreferrer">🌐 {news.title}</a>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* User Opinions Section */}
                <div className="opinion-section" style={{ marginTop: '2rem' }}>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>{t('user_opinions_title')}</h2>
                  
                  {/* Opinion Form */}
                  <div className="opinion-form-container glass-panel">
                    {user ? (
                      <>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: '700' }}>{user.displayName}님의 의견</h3>
                        <textarea 
                          className="opinion-input" 
                          rows="3" 
                          placeholder="의견을 입력하세요..."
                          value={opinionContent}
                          onChange={(e) => setOpinionContent(e.target.value)}
                        />
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <input 
                              type="text" 
                              className="input-text" 
                              style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem', width: '220px', height: '32px' }} 
                              placeholder={t('opinion_nickname_placeholder')}
                              value={isAnonymous ? '' : opinionNickname}
                              disabled={isAnonymous}
                              onChange={(e) => setOpinionNickname(e.target.value)}
                            />
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
                              <input 
                                type="checkbox" 
                                checked={isAnonymous}
                                onChange={(e) => setIsAnonymous(e.target.checked)}
                                style={{ cursor: 'pointer' }}
                              />
                              {t('opinion_anonymous_label')}
                            </label>
                          </div>
                          
                          <button 
                            className="btn-accent" 
                            onClick={handlePostOpinion}
                            disabled={!opinionContent.trim() || opinionPosting}
                            style={{ height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            {opinionPosting ? t('posting_opinion') : t('post_opinion_btn')}
                          </button>
                        </div>
                      </>
                    ) : (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center' }}>
                        의견을 남기려면 <a href="#" onClick={(e) => { e.preventDefault(); handleGoogleLogin(); }} style={{ color: 'var(--accent-cyan)', fontWeight: '700' }}>로그인</a>해주세요.
                      </p>
                    )}
                  </div>

                  {/* Opinions List */}
                  <div className="opinions-list">
                    {opinions.map(opinion => {
                      const isAuthor = user && user.uid === opinion.uid;
                      const dateText = opinion.createdAt ? new Date(opinion.createdAt.toDate()).toLocaleString() : '';
                      return (
                        <div className="opinion-item glass-panel" key={opinion.id}>
                          <div className="opinion-header">
                            <span className="opinion-author">{opinion.nickname}</span>
                            <div className="opinion-meta">
                              <span>{dateText}</span>
                              {isAuthor && (
                                <button 
                                  className="btn-icon remove" 
                                  onClick={() => handleDeleteOpinion(opinion.id)}
                                  style={{ fontSize: '0.8rem', textDecoration: 'underline' }}
                                >
                                  삭제
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="opinion-content">{opinion.content}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>
          </main>
        )}

        {/* Backtesting Tab */}
        {activeTab === 'backtest' && (
          <main className="dashboard-content w-full-style">
            <div className="container-inner m-auto" style={{ maxWidth: '1100px' }}>
              <div className="backtest-container flex-col-style" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* 1. Global settings panel */}
                <div className="glass-panel p-6" style={{ padding: '1.5rem' }}>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
                    📈 {t('backtest_title')}
                  </h2>
                  <div className="backtest-inputs-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                    <div className="input-group">
                      <label className="input-label">{t('backtest_coin_select')}</label>
                      <input 
                        type="text" 
                        className="input-text" 
                        style={{ marginBottom: '0.3rem', fontSize: '0.75rem', padding: '0.4rem 0.65rem' }} 
                        placeholder={t('backtest_search_coin')} 
                        value={backtestCoinSearch}
                        onChange={(e) => setBacktestCoinSearch(e.target.value)}
                      />
                      <select 
                        className="input-select"
                        value={backtestCoin}
                        onChange={(e) => setBacktestCoin(e.target.value)}
                      >
                        {allCoins
                          .filter(coin => 
                            coin.name.toLowerCase().includes(backtestCoinSearch.toLowerCase()) || 
                            coin.symbol.toLowerCase().includes(backtestCoinSearch.toLowerCase())
                          )
                          .map(coin => (
                            <option value={coin.id} key={coin.id}>{coin.name} ({coin.symbol.toUpperCase()})</option>
                          ))
                        }
                      </select>
                    </div>

                    <div className="input-group">
                      <label className="input-label">{t('backtest_timeframe')}</label>
                      <select 
                        className="input-select"
                        value={backtestTimeframe}
                        onChange={(e) => setBacktestTimeframe(e.target.value)}
                      >
                        <option value="5m">5분봉 (5m)</option>
                        <option value="15m">15분봉 (15m)</option>
                        <option value="30m">30분봉 (30m)</option>
                        <option value="1h">1시간봉 (1h)</option>
                        <option value="4h">4시간봉 (4h)</option>
                        <option value="1D">일봉 (1D)</option>
                        <option value="1W">주봉 (1W)</option>
                      </select>
                    </div>

                    <div className="input-group">
                      <label className="input-label">{t('backtest_period_select')}</label>
                      <select 
                        className="input-select"
                        value={backtestPeriod}
                        disabled={['5m', '15m', '30m', '1h', '4h'].includes(backtestTimeframe)}
                        onChange={(e) => setBacktestPeriod(e.target.value)}
                      >
                        <option value="30">30일 (1 Month)</option>
                        <option value="90">90일 (3 Months)</option>
                        <option value="180">180일 (6 Months)</option>
                        <option value="365">365일 (1 Year)</option>
                        <option value="1095">1095일 (3 Years)</option>
                      </select>
                      {['5m', '15m', '30m'].includes(backtestTimeframe) && <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>* 최근 1일치 고정</span>}
                      {['1h', '4h'].includes(backtestTimeframe) && <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>* 최근 30일치 고정</span>}
                    </div>

                    <div className="input-group">
                      <label className="input-label">{t('backtest_capital')} ({currency.toUpperCase()})</label>
                      <input 
                        type="number" 
                        className="input-text"
                        value={backtestCapital}
                        onChange={(e) => setBacktestCapital(parseInt(e.target.value) || 0)}
                      />
                    </div>

                    <div className="input-group">
                      <label className="input-label">{t('backtest_strategy')}</label>
                      <select 
                        className="input-select"
                        value={backtestStrategy}
                        onChange={(e) => setBacktestStrategy(e.target.value)}
                      >
                        <option value="custom">{t('backtest_strategy_custom')}</option>
                        <option value="rsi">RSI 과매수/과매도 프리셋 (30-70)</option>
                        <option value="ma">MA 크로스 프리셋 (5-20 SMA)</option>
                        <option value="bb">볼린저밴드 하단매수/상단매도 프리셋</option>
                        <option value="macd">MACD 시그널 크로스오버 프리셋</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 2. Custom Rule Builder Editor */}
                {backtestStrategy === 'custom' && (
                  <div className="custom-strategy-editor" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '1.5rem', marginTop: '1rem' }}>
                    
                    {/* Buy Rules Column */}
                    <div className="glass-panel p-6" style={{ padding: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>{t('backtest_buy_rules')}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t('backtest_logical_operator')}:</span>
                          <select 
                            className="input-select" 
                            style={{ padding: '0.2rem 0.5rem', width: 'auto', fontSize: '0.75rem' }}
                            value={buyLogicalOperator}
                            onChange={(e) => setBuyLogicalOperator(e.target.value)}
                          >
                            <option value="AND">AND (모두 만족)</option>
                            <option value="OR">OR (하나라도 만족)</option>
                          </select>
                        </div>
                      </div>

                      <div className="rules-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {buyRules.map(rule => (
                          <div className="rule-row-container" key={rule.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '0.5rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            {/* Left Operand */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1 }}>
                              <select 
                                className="input-select" 
                                style={{ fontSize: '0.75rem', padding: '0.2rem' }}
                                value={rule.leftType} 
                                onChange={(e) => updateRule(rule.id, 'leftType', e.target.value, true)}
                              >
                                {renderOperandOptions(false)}
                              </select>
                              
                              {!rule.leftType.startsWith('price_') && rule.leftType !== 'volume' && (
                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                  <input 
                                    type="number" 
                                    className="input-text" 
                                    style={{ fontSize: '0.7rem', padding: '0.1rem 0.25rem', height: 'auto', width: '60px' }}
                                    placeholder="Period"
                                    value={rule.leftPeriod}
                                    onChange={(e) => updateRule(rule.id, 'leftPeriod', e.target.value, true)}
                                  />
                                  {(rule.leftType.startsWith('bb_') || rule.leftType.startsWith('keltner_') || rule.leftType === 'supertrend' || rule.leftType === 'chande_kroll') && (
                                    <input 
                                      type="number" 
                                      className="input-text" 
                                      style={{ fontSize: '0.7rem', padding: '0.1rem 0.25rem', height: 'auto', width: '50px' }}
                                      placeholder="Dev"
                                      value={rule.leftDev}
                                      onChange={(e) => updateRule(rule.id, 'leftDev', e.target.value, true)}
                                    />
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Operator */}
                            <select 
                              className="input-select" 
                              style={{ fontSize: '0.75rem', padding: '0.2rem', width: '85px', textAlign: 'center' }}
                              value={rule.operator}
                              onChange={(e) => updateRule(rule.id, 'operator', e.target.value, true)}
                            >
                              <option value=">">&gt;</option>
                              <option value="<">&lt;</option>
                              <option value=">=">&gt;=</option>
                              <option value="&lt;=">&lt;=</option>
                              <option value="cross_above">상향돌파</option>
                              <option value="cross_under">하향돌파</option>
                            </select>

                            {/* Right Operand */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1 }}>
                              <select 
                                className="input-select" 
                                style={{ fontSize: '0.75rem', padding: '0.2rem' }}
                                value={rule.rightType} 
                                onChange={(e) => updateRule(rule.id, 'rightType', e.target.value, true)}
                              >
                                {renderOperandOptions(true)}
                              </select>
                              
                              {rule.rightType === 'constant' ? (
                                <input 
                                  type="number" 
                                  className="input-text" 
                                  style={{ fontSize: '0.75rem', padding: '0.1rem 0.25rem', height: 'auto' }}
                                  value={rule.rightValue}
                                  onChange={(e) => updateRule(rule.id, 'rightValue', e.target.value, true)}
                                />
                              ) : (
                                !rule.rightType.startsWith('price_') && rule.rightType !== 'volume' && (
                                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                                    <input 
                                      type="number" 
                                      className="input-text" 
                                      style={{ fontSize: '0.7rem', padding: '0.1rem 0.25rem', height: 'auto', width: '60px' }}
                                      placeholder="Period"
                                      value={rule.rightPeriod}
                                      onChange={(e) => updateRule(rule.id, 'rightPeriod', e.target.value, true)}
                                    />
                                    {(rule.rightType.startsWith('bb_') || rule.rightType.startsWith('keltner_') || rule.rightType === 'supertrend' || rule.rightType === 'chande_kroll') && (
                                      <input 
                                        type="number" 
                                        className="input-text" 
                                        style={{ fontSize: '0.7rem', padding: '0.1rem 0.25rem', height: 'auto', width: '50px' }}
                                        placeholder="Dev"
                                        value={rule.rightDev}
                                        onChange={(e) => updateRule(rule.id, 'rightDev', e.target.value, true)}
                                      />
                                    )}
                                  </div>
                                )
                              )}
                            </div>

                            <button 
                              className="btn-icon remove" 
                              onClick={() => removeRule(rule.id, true)}
                              style={{ color: 'var(--color-red)', fontSize: '1.2rem', padding: '0.2rem' }}
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                      </div>

                      <button 
                        className="filter-btn w-full-style" 
                        style={{ marginTop: '0.75rem', fontSize: '0.8rem', borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.1)' }}
                        onClick={() => addRule(true)}
                      >
                        {t('backtest_rule_add')}
                      </button>
                    </div>

                    {/* Sell Rules Column */}
                    <div className="glass-panel p-6" style={{ padding: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>{t('backtest_sell_rules')}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t('backtest_logical_operator')}:</span>
                          <select 
                            className="input-select" 
                            style={{ padding: '0.2rem 0.5rem', width: 'auto', fontSize: '0.75rem' }}
                            value={sellLogicalOperator}
                            onChange={(e) => setSellLogicalOperator(e.target.value)}
                          >
                            <option value="AND">AND (모두 만족)</option>
                            <option value="OR">OR (하나라도 만족)</option>
                          </select>
                        </div>
                      </div>

                      <div className="rules-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {sellRules.map(rule => (
                          <div className="rule-row-container" key={rule.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '0.5rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            {/* Left Operand */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1 }}>
                              <select 
                                className="input-select" 
                                style={{ fontSize: '0.75rem', padding: '0.2rem' }}
                                value={rule.leftType} 
                                onChange={(e) => updateRule(rule.id, 'leftType', e.target.value, false)}
                              >
                                {renderOperandOptions(false)}
                              </select>
                              
                              {!rule.leftType.startsWith('price_') && rule.leftType !== 'volume' && (
                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                  <input 
                                    type="number" 
                                    className="input-text" 
                                    style={{ fontSize: '0.7rem', padding: '0.1rem 0.25rem', height: 'auto', width: '60px' }}
                                    placeholder="Period"
                                    value={rule.leftPeriod}
                                    onChange={(e) => updateRule(rule.id, 'leftPeriod', e.target.value, false)}
                                  />
                                  {(rule.leftType.startsWith('bb_') || rule.leftType.startsWith('keltner_') || rule.leftType === 'supertrend' || rule.leftType === 'chande_kroll') && (
                                    <input 
                                      type="number" 
                                      className="input-text" 
                                      style={{ fontSize: '0.7rem', padding: '0.1rem 0.25rem', height: 'auto', width: '50px' }}
                                      placeholder="Dev"
                                      value={rule.leftDev}
                                      onChange={(e) => updateRule(rule.id, 'leftDev', e.target.value, false)}
                                    />
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Operator */}
                            <select 
                              className="input-select" 
                              style={{ fontSize: '0.75rem', padding: '0.2rem', width: '85px', textAlign: 'center' }}
                              value={rule.operator}
                              onChange={(e) => updateRule(rule.id, 'operator', e.target.value, false)}
                            >
                              <option value=">">&gt;</option>
                              <option value="<">&lt;</option>
                              <option value=">=">&gt;=</option>
                              <option value="&lt;=">&lt;=</option>
                              <option value="cross_above">상향돌파</option>
                              <option value="cross_under">하향돌파</option>
                            </select>

                            {/* Right Operand */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1 }}>
                              <select 
                                className="input-select" 
                                style={{ fontSize: '0.75rem', padding: '0.2rem' }}
                                value={rule.rightType} 
                                onChange={(e) => updateRule(rule.id, 'rightType', e.target.value, false)}
                              >
                                {renderOperandOptions(true)}
                              </select>
                              
                              {rule.rightType === 'constant' ? (
                                <input 
                                  type="number" 
                                  className="input-text" 
                                  style={{ fontSize: '0.75rem', padding: '0.1rem 0.25rem', height: 'auto' }}
                                  value={rule.rightValue}
                                  onChange={(e) => updateRule(rule.id, 'rightValue', e.target.value, false)}
                                />
                              ) : (
                                !rule.rightType.startsWith('price_') && rule.rightType !== 'volume' && (
                                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                                    <input 
                                      type="number" 
                                      className="input-text" 
                                      style={{ fontSize: '0.7rem', padding: '0.1rem 0.25rem', height: 'auto', width: '60px' }}
                                      placeholder="Period"
                                      value={rule.rightPeriod}
                                      onChange={(e) => updateRule(rule.id, 'rightPeriod', e.target.value, false)}
                                    />
                                    {(rule.rightType.startsWith('bb_') || rule.rightType.startsWith('keltner_') || rule.rightType === 'supertrend' || rule.rightType === 'chande_kroll') && (
                                      <input 
                                        type="number" 
                                        className="input-text" 
                                        style={{ fontSize: '0.7rem', padding: '0.1rem 0.25rem', height: 'auto', width: '50px' }}
                                        placeholder="Dev"
                                        value={rule.rightDev}
                                        onChange={(e) => updateRule(rule.id, 'rightDev', e.target.value, false)}
                                      />
                                    )}
                                  </div>
                                )
                              )}
                            </div>

                            <button 
                              className="btn-icon remove" 
                              onClick={() => removeRule(rule.id, false)}
                              style={{ color: 'var(--color-red)', fontSize: '1.2rem', padding: '0.2rem' }}
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                      </div>

                      <button 
                        className="filter-btn w-full-style" 
                        style={{ marginTop: '0.75rem', fontSize: '0.8rem', borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.1)' }}
                        onClick={() => addRule(false)}
                      >
                        {t('backtest_rule_add')}
                      </button>
                    </div>

                  </div>
                )}

                {/* 3. Run button outside sidebar */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  <button 
                    className="btn-primary" 
                    style={{ padding: '0.8rem 2.5rem', fontSize: '1.05rem', fontWeight: '700' }}
                    onClick={runBacktestSimulation}
                    disabled={backtestLoading || allCoins.length === 0}
                  >
                    {backtestLoading ? '검증 계산 중...' : t('backtest_run_btn')}
                  </button>
                  <button 
                    className="btn-accent" 
                    style={{ padding: '0.8rem 2rem', fontSize: '1.05rem', fontWeight: '700' }}
                    onClick={runStrategyScanner}
                    disabled={scannerLoading || allCoins.length === 0}
                  >
                    {scannerLoading ? '시장 스캔 중...' : '🔍 실시간 전략 스캐너 실행'}
                  </button>
                </div>
              </div>

                {/* Backtest Results Display */}
                <div className="backtest-results-wrapper">
                  {backtestLoading ? (
                    <div className="glass-panel p-12 flex-center" style={{ flexDirection: 'column', gap: '1rem', height: '100%' }}>
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400"></div>
                      <p style={{ color: 'var(--text-secondary)' }}>{t('backtest_loading')}</p>
                    </div>
                  ) : !backtestResults ? (
                    <div className="glass-panel p-12 text-center-align flex-center" style={{ flexDirection: 'column', gap: '0.5rem', height: '100%', minHeight: '350px' }}>
                      <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5"><path d="M3 3v18h18M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"></path></svg>
                      <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                        {selectedCoinIds.length === 0 ? "먼저 홈 화면에서 코인을 추가해 주세요." : t('backtest_subtitle')}
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Stat Cards Grid */}
                      <div className="backtest-stats-grid">
                        <div className="backtest-stat-card glass-panel">
                          <span className="backtest-stat-label">{t('backtest_stat_total_return')}</span>
                          <span className={`backtest-stat-value ${backtestResults.totalReturn >= 0 ? 'text-green' : 'text-red'}`}>
                            {backtestResults.totalReturn >= 0 ? '+' : ''}{backtestResults.totalReturn.toFixed(2)}%
                          </span>
                        </div>
                        <div className="backtest-stat-card glass-panel">
                          <span className="backtest-stat-label">{t('backtest_stat_hold_return')}</span>
                          <span className={`backtest-stat-value ${backtestResults.holdReturn >= 0 ? 'text-green' : 'text-red'}`}>
                            {backtestResults.holdReturn >= 0 ? '+' : ''}{backtestResults.holdReturn.toFixed(2)}%
                          </span>
                        </div>
                        <div className="backtest-stat-card glass-panel">
                          <span className="backtest-stat-label">{t('backtest_stat_win_rate')}</span>
                          <span className="backtest-stat-value text-gold">
                            {backtestResults.winRate.toFixed(1)}%
                          </span>
                        </div>
                        <div className="backtest-stat-card glass-panel">
                          <span className="backtest-stat-label">{t('backtest_stat_mdd')}</span>
                          <span className="backtest-stat-value text-red">
                            -{backtestResults.mdd.toFixed(2)}%
                          </span>
                        </div>
                        <div className="backtest-stat-card glass-panel">
                          <span className="backtest-stat-label">{t('backtest_stat_trades')}</span>
                          <span className="backtest-stat-value">
                            {backtestResults.tradeCount}
                          </span>
                        </div>
                      </div>

                      {/* Assets Summary */}
                      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{t('backtest_final_assets')}</span>
                        <span style={{ fontSize: '1.5rem', fontWeight: '700', fontFamily: 'Space Grotesk' }}>
                          {new Intl.NumberFormat(language, { style: 'currency', currency: currency }).format(backtestResults.finalAssets)}
                        </span>
                      </div>

                      {/* Equity curve chart */}
                      <div className="glass-panel" style={{ padding: '1.5rem', height: '320px', position: 'relative' }}>
                        <canvas ref={backtestChartRef}></canvas>
                      </div>

                      {/* Candlestick Chart */}
                      {backtestResults.candles && (
                        <CandlestickChart 
                          candles={backtestResults.candles} 
                          trades={backtestResults.trades} 
                          language={language} 
                        />
                      )}

                      {/* Trades Log list */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: '700' }}>{t('backtest_trade_log')}</h3>
                        <div className="backtest-table-container glass-panel">
                          {backtestResults.trades.length === 0 ? (
                            <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>{t('backtest_no_trades')}</p>
                          ) : (
                            <table className="backtest-table">
                              <thead>
                                <tr>
                                  <th>{t('backtest_log_date')}</th>
                                  <th>{t('backtest_log_type')}</th>
                                  <th>{t('backtest_log_price')}</th>
                                  <th>{t('backtest_log_return')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {backtestResults.trades.map((trade, idx) => (
                                  <tr key={idx}>
                                    <td style={{ color: 'var(--text-secondary)' }}>{trade.date}</td>
                                    <td>
                                      <span className={trade.type === 'buy' ? 'text-green' : 'text-red'} style={{ fontWeight: '700' }}>
                                        {trade.type === 'buy' ? t('backtest_log_buy') : t('backtest_log_sell')}
                                      </span>
                                    </td>
                                    <td style={{ fontFamily: 'Space Grotesk', fontWeight: '600' }}>
                                      {new Intl.NumberFormat(language, { style: 'currency', currency: currency }).format(trade.price)}
                                    </td>
                                    <td>
                                      {trade.type === 'sell' ? (
                                        <span className={trade.returnPercentage >= 0 ? 'text-green' : 'text-red'} style={{ fontWeight: '700' }}>
                                          {trade.returnPercentage >= 0 ? '+' : ''}{trade.returnPercentage.toFixed(2)}%
                                        </span>
                                      ) : '-'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Strategy Scanner Results Section */}
                {(scannerLoading || scannerResults.length > 0) && (
                  <div className="scanner-results-section glass-panel p-6" style={{ marginTop: '1.5rem', padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      🔍 실시간 전략 스캐너 결과 (Timeframe: {backtestTimeframe})
                    </h3>
                    
                    {scannerLoading ? (
                      <div className="flex-center" style={{ flexDirection: 'column', gap: '1rem', padding: '2rem' }}>
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent-cyan"></div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{scannerProgress || '주요 10대 코인의 실시간 데이터를 분석하여 전략 시그널을 계산하는 중...'}</p>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                        {scannerResults.map(res => (
                          <div key={res.id} className="scanner-card glass-panel" style={{
                            padding: '1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem',
                            border: res.signal === 'BUY' ? '1px solid rgba(34, 197, 94, 0.4)' : res.signal === 'SELL' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-color)',
                            background: res.signal === 'BUY' ? 'rgba(34, 197, 94, 0.02)' : res.signal === 'SELL' ? 'rgba(239, 68, 68, 0.02)' : 'rgba(255,255,255,0.01)'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: '700', fontSize: '1rem' }}>{res.name}</span>
                              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: '600' }}>{res.symbol}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>현재가:</span>
                              <span style={{ fontWeight: '600', fontFamily: 'Space Grotesk' }}>
                                {new Intl.NumberFormat(language, { style: 'currency', currency: currency }).format(res.price)}
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>변동률:</span>
                              <span style={{ fontWeight: '600', color: res.change >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                                {res.change >= 0 ? '+' : ''}{res.change.toFixed(2)}%
                              </span>
                            </div>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.4rem',
                              marginTop: '0.5rem',
                              padding: '0.35rem',
                              borderRadius: '6px',
                              fontWeight: '700',
                              fontSize: '0.85rem',
                              background: res.signal === 'BUY' ? 'rgba(34, 197, 94, 0.15)' : res.signal === 'SELL' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.05)',
                              color: res.signal === 'BUY' ? '#22c55e' : res.signal === 'SELL' ? '#ef4444' : '#94a3b8'
                            }}>
                              {res.signal === 'BUY' ? '🟢 BUY (매수)' : res.signal === 'SELL' ? '🔴 SELL (매도)' : '⚪ HOLD (관망)'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </main>
          )}

        {/* About Tab */}
        {activeTab === 'about' && (
          <main className="dashboard-content w-full-style">
            <div className="container-inner m-auto" style={{ maxWidth: '850px' }}>
              <div className="glass-panel p-12 prose max-w-none" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', lineHeight: '1.75' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>{t('about_title')}</h1>
                <p style={{ color: '#cbd5e1' }}>{t('about_p1')}</p>
                
                <h2 style={{ fontSize: '1.4rem', fontWeight: '700', marginTop: '1rem' }}>{t('about_h2')}</h2>
                <p style={{ color: '#cbd5e1' }}>{t('about_p2')}</p>
                
                <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginTop: '1rem' }}>{t('about_h3_1')}</h3>
                <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', color: '#cbd5e1' }}>
                  <li><strong>실시간 데이터 분석:</strong> 전 세계 주요 코인의 가격, 변동률, 기술적 지표(RSI, 이동평균선)를 실시간으로 추적하고 객관적인 평가를 제공합니다.</li>
                  <li><strong>AI 뉴스 브리핑:</strong> 최신 국내외 뉴스를 AI가 분석하여, 시장의 전반적인 분위기와 핵심 포인트를 요약한 '오늘의 브리핑'을 매일 제공합니다.</li>
                  <li><strong>완벽한 개인화:</strong> 최대 6개의 관심 코인을 직접 선택하고, 관심 목록, 검색, 정렬 기능을 통해 자신만의 맞춤형 대시보드를 구성할 수 있습니다.</li>
                </ul>

                <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginTop: '1rem' }}>우리의 약속</h3>
                <p style={{ color: '#cbd5e1' }}>{t('about_p3')}</p>
              </div>
            </div>
          </main>
        )}
      </div>

      {/* Modal Popup */}
      {selectedModalCoinId && (
        <div className="modal-overlay" onClick={() => setSelectedModalCoinId(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedModalCoinId(null)}>&times;</button>
            
            {modalLoading || !modalCoinDetails ? (
              <div className="flex-center" style={{ height: '300px' }}>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400"></div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="flex-center" style={{ justifyContent: 'flex-start', gap: '1rem' }}>
                  <img src={modalCoinDetails.image?.small} alt={modalCoinDetails.name} style={{ width: '3rem', height: '3rem', borderRadius: '50%' }} />
                  <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: '700', fontFamily: 'var(--font-heading)' }}>{modalCoinDetails.name}</h2>
                    <p style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.85rem' }}>{modalCoinDetails.symbol}</p>
                  </div>
                </div>

                {/* Range Toggle inside Modal */}
                <div className="filter-btn-group" style={{ margin: '0.25rem 0' }}>
                  <button className={`filter-btn ${modalRange === '7' ? 'active' : ''}`} onClick={() => setModalRange('7')}>7d</button>
                  <button className={`filter-btn ${modalRange === '30' ? 'active' : ''}`} onClick={() => setModalRange('30')}>30d</button>
                  <button className={`filter-btn ${modalRange === '90' ? 'active' : ''}`} onClick={() => setModalRange('90')}>90d</button>
                </div>

                <div className="grid-details" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: '0.75rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t('price')}</span>
                    <p style={{ fontWeight: '700', fontSize: '1.1rem' }}>
                      {new Intl.NumberFormat(language, { style: 'currency', currency: currency }).format(displayedCoins.find(c => c.id === selectedModalCoinId)?.current_price || 0)}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t('change_24h')}</span>
                    <p style={{ fontWeight: '700', fontSize: '1.1rem' }} className={(displayedCoins.find(c => c.id === selectedModalCoinId)?.price_change_percentage_24h || 0) >= 0 ? 'text-green' : 'text-red'}>
                      {(displayedCoins.find(c => c.id === selectedModalCoinId)?.price_change_percentage_24h || 0).toFixed(2)}%
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t('market_cap')}</span>
                    <p style={{ fontWeight: '700', fontSize: '1.1rem' }}>
                      {new Intl.NumberFormat(language, { style: 'currency', currency: currency, notation: 'compact' }).format(displayedCoins.find(c => c.id === selectedModalCoinId)?.market_cap || 0)}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t('high_24h')}</span>
                    <p style={{ fontWeight: '700', fontSize: '1.1rem' }} className="text-green">
                      {new Intl.NumberFormat(language, { style: 'currency', currency: currency }).format(displayedCoins.find(c => c.id === selectedModalCoinId)?.high_24h || 0)}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t('low_24h')}</span>
                    <p style={{ fontWeight: '700', fontSize: '1.1rem' }} className="text-red">
                      {new Intl.NumberFormat(language, { style: 'currency', currency: currency }).format(displayedCoins.find(c => c.id === selectedModalCoinId)?.low_24h || 0)}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t('total_volume')}</span>
                    <p style={{ fontWeight: '700', fontSize: '1.1rem' }}>
                      {new Intl.NumberFormat(language, { style: 'currency', currency: currency, notation: 'compact' }).format(displayedCoins.find(c => c.id === selectedModalCoinId)?.total_volume || 0)}
                    </p>
                  </div>
                </div>

                <div style={{ height: '220px', position: 'relative' }}>
                  <canvas ref={chartRef}></canvas>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>{t('description')}</h3>
                  <p 
                    style={{ color: '#cbd5e1', fontSize: '0.85rem', lineHeight: '1.6', maxHeight: '100px', overflowY: 'auto' }}
                    dangerouslySetInnerHTML={{ __html: modalCoinDetails.description?.[language] || modalCoinDetails.description?.en || 'No description available.' }}
                  />
                  {modalCoinDetails.links?.homepage?.[0] && (
                    <a 
                      href={modalCoinDetails.links.homepage[0]} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      style={{ color: 'var(--accent-cyan)', fontSize: '0.85rem', fontWeight: '700', textDecoration: 'none', marginTop: '0.25rem' }}
                    >
                      {t('homepage')} &rarr;
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
