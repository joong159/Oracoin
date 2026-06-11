/**
 * Oracoin 고성능 클라이언트 사이드 기술 지표 라이브러리 (100 Indicators)
 * 주입된 캔들(OHLCV) 배열을 사용하여 각 보조지표 값을 정밀 연산합니다.
 */

// --- 1. 기본 통계 및 이평선 헬퍼 ---

export const calculateSMA = (values, period) => {
  const sma = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      sma.push(null);
    } else {
      const sum = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
  }
  return sma;
};

export const calculateEMA = (values, period) => {
  const ema = [];
  if (values.length === 0) return ema;
  const k = 2 / (period + 1);
  let prevEma = values[0];
  ema.push(prevEma);
  for (let i = 1; i < values.length; i++) {
    const currEma = values[i] * k + prevEma * (1 - k);
    ema.push(currEma);
    prevEma = currEma;
  }
  return ema;
};

export const calculateWMA = (values, period) => {
  const wma = [];
  const denominator = (period * (period + 1)) / 2;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      wma.push(null);
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += values[i - period + 1 + j] * (j + 1);
      }
      wma.push(sum / denominator);
    }
  }
  return wma;
};

export const calculateStdDev = (values, period) => {
  const stdDevs = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      stdDevs.push(null);
    } else {
      const slice = values.slice(i - period + 1, i + 1);
      const mean = slice.reduce((a, b) => a + b, 0) / period;
      const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
      stdDevs.push(Math.sqrt(variance));
    }
  }
  return stdDevs;
};

// --- 2. 100대 보조지표 계산 유닛 ---

export const calculateIndicator = (type, period, dev, candles) => {
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const opens = candles.map(c => c.open);
  const volumes = candles.map(c => c.volume);
  const size = candles.length;

  // 1. 추세 지표 (Trend Indicators - 25개)
  if (type === 'sma') return calculateSMA(closes, period);
  if (type === 'ema') return calculateEMA(closes, period);
  if (type === 'wma') return calculateWMA(closes, period);
  if (type === 'hma') {
    // Hull Moving Average = WMA(2*WMA(n/2) - WMA(n)), sqrt(n))
    const halfWma = calculateWMA(closes, Math.floor(period / 2));
    const fullWma = calculateWMA(closes, period);
    const rawHma = [];
    for (let i = 0; i < size; i++) {
      if (halfWma[i] === null || fullWma[i] === null) rawHma.push(closes[i]);
      else rawHma.push(2 * halfWma[i] - fullWma[i]);
    }
    return calculateWMA(rawHma, Math.floor(Math.sqrt(period)));
  }
  if (type === 'macd_line' || type === 'macd_signal' || type === 'macd_hist') {
    const fastEma = calculateEMA(closes, 12);
    const slowEma = calculateEMA(closes, 26);
    const line = fastEma.map((f, i) => f - slowEma[i]);
    const sig = calculateEMA(line, 9);
    if (type === 'macd_line') return line;
    if (type === 'macd_signal') return sig;
    return line.map((l, i) => l - sig[i]);
  }
  if (type === 'adx' || type === 'dmi_plus' || type === 'dmi_minus') {
    // DMI 및 ADX 간이 계산
    const plusDM = [];
    const minusDM = [];
    const tr = [];
    tr.push(highs[0] - lows[0]);
    plusDM.push(0);
    minusDM.push(0);
    for (let i = 1; i < size; i++) {
      const upMove = highs[i] - highs[i - 1];
      const downMove = lows[i - 1] - lows[i];
      plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
      minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
      tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
    }
    const trSmooth = calculateEMA(tr, period);
    const plusDMSmooth = calculateEMA(plusDM, period);
    const minusDMSmooth = calculateEMA(minusDM, period);
    const plusDI = plusDMSmooth.map((p, i) => trSmooth[i] ? (p / trSmooth[i]) * 100 : 50);
    const minusDI = minusDMSmooth.map((m, i) => trSmooth[i] ? (m / trSmooth[i]) * 100 : 50);
    if (type === 'dmi_plus') return plusDI;
    if (type === 'dmi_minus') return minusDI;
    
    const dx = plusDI.map((p, i) => {
      const sum = p + minusDI[i];
      return sum ? (Math.abs(p - minusDI[i]) / sum) * 100 : 0;
    });
    return calculateEMA(dx, period);
  }
  if (type === 'aroon_up' || type === 'aroon_down' || type === 'aroon_osc') {
    const up = [];
    const down = [];
    for (let i = 0; i < size; i++) {
      if (i < period) {
        up.push(50); down.push(50);
      } else {
        const sliceH = highs.slice(i - period, i + 1);
        const sliceL = lows.slice(i - period, i + 1);
        const maxIdx = sliceH.lastIndexOf(Math.max(...sliceH));
        const minIdx = sliceL.lastIndexOf(Math.min(...sliceL));
        up.push(((period - (period - maxIdx)) / period) * 100);
        down.push(((period - (period - minIdx)) / period) * 100);
      }
    }
    if (type === 'aroon_up') return up;
    if (type === 'aroon_down') return down;
    return up.map((u, i) => u - down[i]);
  }
  if (type === 'parabolic_sar') {
    // Parabolic SAR 근사 추적선
    const sar = [];
    let isBull = true;
    let ep = highs[0];
    let af = 0.02;
    sar.push(lows[0]);
    for (let i = 1; i < size; i++) {
      let nextSar = sar[i - 1] + af * (ep - sar[i - 1]);
      if (isBull) {
        if (lows[i] < nextSar) {
          isBull = false;
          nextSar = ep;
          ep = lows[i];
          af = 0.02;
        } else {
          if (highs[i] > ep) { ep = highs[i]; af = Math.min(af + 0.02, 0.2); }
        }
      } else {
        if (highs[i] > nextSar) {
          isBull = true;
          nextSar = ep;
          ep = highs[i];
          af = 0.02;
        } else {
          if (lows[i] < ep) { ep = lows[i]; af = Math.min(af + 0.02, 0.2); }
        }
      }
      sar.push(nextSar);
    }
    return sar;
  }
  if (type.startsWith('ichimoku_')) {
    // 일목균형표
    const tenkan = []; // 9
    const kijun = []; // 26
    for (let i = 0; i < size; i++) {
      if (i < 9) tenkan.push(closes[i]);
      else {
        const slice = highs.slice(i - 8, i + 1).concat(lows.slice(i - 8, i + 1));
        tenkan.push((Math.max(...slice) + Math.min(...slice)) / 2);
      }
      if (i < 26) kijun.push(closes[i]);
      else {
        const slice = highs.slice(i - 25, i + 1).concat(lows.slice(i - 25, i + 1));
        kijun.push((Math.max(...slice) + Math.min(...slice)) / 2);
      }
    }
    if (type === 'ichimoku_tenkan') return tenkan;
    if (type === 'ichimoku_kijun') return kijun;
    
    const senkouA = tenkan.map((t, i) => (t + kijun[i]) / 2);
    if (type === 'ichimoku_senkou_a') return senkouA;
    
    const senkouB = [];
    for (let i = 0; i < size; i++) {
      if (i < 52) senkouB.push(closes[i]);
      else {
        const slice = highs.slice(i - 51, i + 1).concat(lows.slice(i - 51, i + 1));
        senkouB.push((Math.max(...slice) + Math.min(...slice)) / 2);
      }
    }
    if (type === 'ichimoku_senkou_b') return senkouB;
    return closes; // 후행 스팬
  }
  if (type === 'trix') {
    const ema1 = calculateEMA(closes, period);
    const ema2 = calculateEMA(ema1, period);
    const ema3 = calculateEMA(ema2, period);
    const trix = [0];
    for (let i = 1; i < size; i++) {
      trix.push(ema3[i - 1] ? ((ema3[i] - ema3[i - 1]) / ema3[i - 1]) * 100 : 0);
    }
    return trix;
  }
  if (type === 'vortex_plus' || type === 'vortex_minus') {
    const plusVM = [];
    const minusVM = [];
    const tr = [];
    for (let i = 1; i < size; i++) {
      plusVM.push(Math.abs(highs[i] - lows[i - 1]));
      minusVM.push(Math.abs(lows[i] - highs[i - 1]));
      tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
    }
    const trSum = calculateSMA(tr, period);
    const plusVMSum = calculateSMA(plusVM, period);
    const minusVMSum = calculateSMA(minusVM, period);
    const pV = [1].concat(plusVMSum.map((p, i) => trSum[i] ? p / trSum[i] : 1));
    const mV = [1].concat(minusVMSum.map((m, i) => trSum[i] ? m / trSum[i] : 1));
    return type === 'vortex_plus' ? pV : mV;
  }
  if (type === 'supertrend') {
    // ATR 기반 슈퍼트렌드 상하선 추적
    const atr = calculateATR(highs, lows, closes, period);
    const st = [];
    let isUp = true;
    st.push(closes[0]);
    for (let i = 1; i < size; i++) {
      const basicUpper = (highs[i] + lows[i]) / 2 + dev * atr[i];
      const basicLower = (highs[i] + lows[i]) / 2 - dev * atr[i];
      if (closes[i] > st[i - 1] && closes[i - 1] <= st[i - 1]) isUp = true;
      if (closes[i] < st[i - 1] && closes[i - 1] >= st[i - 1]) isUp = false;
      st.push(isUp ? basicLower : basicUpper);
    }
    return st;
  }
  if (type === 'zigzag') {
    const zz = [];
    let lastPivot = closes[0];
    zz.push(lastPivot);
    for (let i = 1; i < size; i++) {
      const diff = ((closes[i] - lastPivot) / lastPivot) * 100;
      if (Math.abs(diff) > period) {
        lastPivot = closes[i];
      }
      zz.push(lastPivot);
    }
    return zz;
  }
  if (type === 'dpo') {
    const k = Math.floor(period / 2) + 1;
    const sma = calculateSMA(closes, period);
    const dpo = [];
    for (let i = 0; i < size; i++) {
      if (i + k < size && sma[i + k] !== null) dpo.push(closes[i] - sma[i + k]);
      else dpo.push(0);
    }
    return dpo;
  }
  if (type === 'kst') {
    const roc1 = calculateROC(closes, 10);
    const roc2 = calculateROC(closes, 15);
    const roc3 = calculateROC(closes, 20);
    const roc4 = calculateROC(closes, 30);
    const sma1 = calculateSMA(roc1, 10);
    const sma2 = calculateSMA(roc2, 10);
    const sma3 = calculateSMA(roc3, 10);
    const sma4 = calculateSMA(roc4, 15);
    const kst = [];
    for (let i = 0; i < size; i++) {
      kst.push((sma1[i] || 0) * 1 + (sma2[i] || 0) * 2 + (sma3[i] || 0) * 3 + (sma4[i] || 0) * 4);
    }
    return kst;
  }
  if (type === 'mass_index') {
    const range = highs.map((h, i) => h - lows[i]);
    const ema1 = calculateEMA(range, 9);
    const ema2 = calculateEMA(ema1, 9);
    const ratio = ema1.map((e1, i) => ema2[i] ? e1 / ema2[i] : 1);
    const mass = [];
    for (let i = 0; i < size; i++) {
      if (i < period) mass.push(20);
      else mass.push(ratio.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0));
    }
    return mass;
  }
  if (type.startsWith('alligator_')) {
    // Alligator: 턱(13,8), 이빨(8,5), 입술(5,3)
    if (type === 'alligator_jaw') return calculateSMA(closes, 13);
    if (type === 'alligator_teeth') return calculateSMA(closes, 8);
    return calculateSMA(closes, 5);
  }
  if (type === 'gator_osc') {
    const jaw = calculateSMA(closes, 13);
    const teeth = calculateSMA(closes, 8);
    return jaw.map((j, i) => Math.abs(j - teeth[i]));
  }
  if (type === 'coppock') {
    const roc14 = calculateROC(closes, 14);
    const roc11 = calculateROC(closes, 11);
    const sum = roc14.map((r, i) => r + roc11[i]);
    return calculateWMA(sum, 10);
  }
  if (type === 'gmma_short' || type === 'gmma_long') {
    const periods = type === 'gmma_short' ? [3, 5, 8, 10, 12, 15] : [30, 35, 40, 45, 50, 60];
    const emas = periods.map(p => calculateEMA(closes, p));
    const mean = [];
    for (let i = 0; i < size; i++) {
      const sum = emas.reduce((s, ema) => s + ema[i], 0);
      mean.push(sum / periods.length);
    }
    return mean;
  }
  if (type === 'linear_reg_curve') {
    const lrc = [];
    for (let i = 0; i < size; i++) {
      if (i < period) lrc.push(closes[i]);
      else {
        const slice = closes.slice(i - period + 1, i + 1);
        lrc.push(calculateLinearRegPoint(slice));
      }
    }
    return lrc;
  }
  if (type === 'qqe') {
    const rsi = calculateRSI(closes, period);
    const rsiEma = calculateEMA(rsi, 5);
    const atrRsi = [];
    atrRsi.push(0);
    for (let i = 1; i < size; i++) {
      atrRsi.push(Math.abs(rsiEma[i] - rsiEma[i - 1]));
    }
    const smoothAtrRsi = calculateEMA(atrRsi, 14);
    return rsiEma.map((r, i) => r + 2.618 * smoothAtrRsi[i]);
  }
  if (type === 'chande_kroll') {
    const atr = calculateATR(highs, lows, closes, period);
    const ck = [];
    for (let i = 0; i < size; i++) {
      ck.push(closes[i] - dev * atr[i]);
    }
    return ck;
  }

  // 2. 모멘텀 지표 (Momentum Indicators - 25개)
  if (type === 'rsi') {
    const rsi = [];
    for (let i = 0; i < size; i++) {
      if (i < period) rsi.push(50);
      else rsi.push(calculateRSI(closes.slice(i - period, i + 1)));
    }
    return rsi;
  }
  if (type === 'stoch_k' || type === 'stoch_d') {
    const st = calculateStochastic(highs, lows, closes, period, 3);
    return type === 'stoch_k' ? st.kLine : st.dLine;
  }
  if (type === 'stoch_rsi') {
    const rsi = calculateRSI(closes, period);
    const stRsi = [];
    for (let i = 0; i < size; i++) {
      if (i < period) stRsi.push(50);
      else {
        const slice = rsi.slice(i - period + 1, i + 1);
        const max = Math.max(...slice);
        const min = Math.min(...slice);
        stRsi.push(max === min ? 50 : ((rsi[i] - min) / (max - min)) * 100);
      }
    }
    return stRsi;
  }
  if (type === 'cci') return calculateCCI(highs, lows, closes, period);
  if (type === 'roc') return calculateROC(closes, period);
  if (type === 'williams_r') {
    const wr = [];
    for (let i = 0; i < size; i++) {
      if (i < period) wr.push(-50);
      else {
        const sliceH = highs.slice(i - period + 1, i + 1);
        const sliceL = lows.slice(i - period + 1, i + 1);
        const max = Math.max(...sliceH);
        const min = Math.min(...sliceL);
        wr.push(max === min ? -50 : ((max - closes[i]) / (max - min)) * -100);
      }
    }
    return wr;
  }
  if (type === 'momentum') {
    const mom = [];
    for (let i = 0; i < size; i++) {
      if (i < period) mom.push(0);
      else mom.push(closes[i] - closes[i - period]);
    }
    return mom;
  }
  if (type === 'awesome_osc' || type === 'accelerator_osc') {
    const midPrices = highs.map((h, i) => (h + lows[i]) / 2);
    const sma5 = calculateSMA(midPrices, 5);
    const sma34 = calculateSMA(midPrices, 34);
    const ao = sma5.map((s5, i) => s5 - sma34[i]);
    if (type === 'awesome_osc') return ao;
    const aoSma5 = calculateSMA(ao, 5);
    return ao.map((a, i) => a - aoSma5[i]);
  }
  if (type === 'mfi') {
    const mfi = [];
    const tp = highs.map((h, i) => (h + lows[i] + closes[i]) / 3);
    for (let i = 0; i < size; i++) {
      if (i < period) mfi.push(50);
      else {
        let posFlow = 0;
        let negFlow = 0;
        for (let j = i - period + 1; j <= i; j++) {
          const rawFlow = tp[j] * volumes[j];
          if (tp[j] > tp[j - 1]) posFlow += rawFlow;
          else negFlow += rawFlow;
        }
        const mr = negFlow === 0 ? 100 : posFlow / negFlow;
        mfi.push(100 - 100 / (1 + mr));
      }
    }
    return mfi;
  }
  if (type === 'cmo') {
    const cmo = [];
    for (let i = 0; i < size; i++) {
      if (i < period) cmo.push(0);
      else {
        let gains = 0, losses = 0;
        for (let j = i - period + 1; j <= i; j++) {
          const diff = closes[j] - closes[j - 1];
          if (diff > 0) gains += diff;
          else losses -= diff;
        }
        cmo.push(gains + losses === 0 ? 0 : ((gains - losses) / (gains + losses)) * 100);
      }
    }
    return cmo;
  }
  if (type === 'ultimate_osc') {
    const uo = [];
    for (let i = 0; i < size; i++) {
      if (i < 28) uo.push(50);
      else {
        const bp = [];
        const tr = [];
        for (let j = i - 27; j <= i; j++) {
          const bpVal = closes[j] - Math.min(lows[j], closes[j - 1]);
          const trVal = Math.max(highs[j] - lows[j], Math.abs(highs[j] - closes[j - 1]), Math.abs(lows[j] - closes[j - 1]));
          bp.push(bpVal);
          tr.push(trVal);
        }
        const avg7 = bp.slice(-7).reduce((a, b) => a + b, 0) / tr.slice(-7).reduce((a, b) => a + b, 0);
        const avg14 = bp.slice(-14).reduce((a, b) => a + b, 0) / tr.slice(-14).reduce((a, b) => a + b, 0);
        const avg28 = bp.reduce((a, b) => a + b, 0) / tr.reduce((a, b) => a + b, 0);
        uo.push(((4 * avg7 + 2 * avg14 + avg28) / 7) * 100);
      }
    }
    return uo;
  }
  if (type === 'rvi') {
    const stdDev = calculateStdDev(closes, period);
    const upEma = calculateEMA(stdDev.map((s, i) => (closes[i] > (opens[i] || closes[i])) ? s : 0), period);
    const dnEma = calculateEMA(stdDev.map((s, i) => (closes[i] <= (opens[i] || closes[i])) ? s : 0), period);
    return upEma.map((u, i) => u + dnEma[i] === 0 ? 50 : (u / (u + dnEma[i])) * 100);
  }
  if (type === 'smi_ergodic' || type === 'tsi') {
    // Double Smooth Momentum
    const diff = [];
    const absDiff = [];
    diff.push(0); absDiff.push(0);
    for (let i = 1; i < size; i++) {
      diff.push(closes[i] - closes[i - 1]);
      absDiff.push(Math.abs(closes[i] - closes[i - 1]));
    }
    const smooth1 = calculateEMA(diff, 25);
    const smooth2 = calculateEMA(smooth1, 13);
    const absSmooth1 = calculateEMA(absDiff, 25);
    const absSmooth2 = calculateEMA(absSmooth1, 13);
    const tsi = smooth2.map((s, i) => absSmooth2[i] ? (s / absSmooth2[i]) * 100 : 0);
    if (type === 'tsi') return tsi;
    return calculateEMA(tsi, 5); // SMI Ergodic
  }
  if (type === 'fisher_transform') {
    const fisher = [];
    let prevFisher = 0;
    let prevValue = 0;
    fisher.push(0);
    for (let i = 1; i < size; i++) {
      const slice = closes.slice(Math.max(0, i - period + 1), i + 1);
      const max = Math.max(...slice);
      const min = Math.min(...slice);
      const rawVal = max === min ? 0.5 : (closes[i] - min) / (max - min);
      const val = 0.66 * (rawVal - 0.5) + 0.67 * prevValue;
      const cleanVal = Math.min(Math.max(val, -0.999), 0.999);
      const fish = 0.5 * Math.log((1 + cleanVal) / (1 - cleanVal)) + 0.5 * prevFisher;
      fisher.push(fish);
      prevFisher = fish;
      prevValue = cleanVal;
    }
    return fisher;
  }
  if (type === 'connors_rsi') {
    const rsiPrice = calculateRSI(closes, 3);
    const streak = [];
    let currentStreak = 0;
    streak.push(0);
    for (let i = 1; i < size; i++) {
      if (closes[i] > closes[i - 1]) currentStreak = Math.max(1, currentStreak + 1);
      else if (closes[i] < closes[i - 1]) currentStreak = Math.min(-1, currentStreak - 1);
      else currentStreak = 0;
      streak.push(currentStreak);
    }
    const rsiStreak = [];
    for (let i = 0; i < size; i++) {
      if (i < 2) rsiStreak.push(50);
      else rsiStreak.push(calculateRSI(streak.slice(0, i + 1), 2));
    }
    const rank = [];
    for (let i = 0; i < size; i++) {
      if (i < 100) rank.push(50);
      else {
        const roc = closes[i] - closes[i - 1];
        const slice = closes.slice(i - 99, i + 1);
        const rocs = [];
        for (let j = 1; j < slice.length; j++) rocs.push(slice[j] - slice[j - 1]);
        const lowerCount = rocs.filter(r => r < roc).length;
        rank.push(lowerCount);
      }
    }
    return rsiPrice.map((rp, i) => (rp + rsiStreak[i] + rank[i]) / 3);
  }
  if (type === 'center_of_gravity') {
    const cog = [];
    for (let i = 0; i < size; i++) {
      if (i < period) cog.push(0);
      else {
        const slice = closes.slice(i - period + 1, i + 1);
        let num = 0, den = 0;
        for (let j = 0; j < period; j++) {
          num += slice[j] * (j + 1);
          den += slice[j];
        }
        cog.push(den ? -num / den : 0);
      }
    }
    return cog;
  }
  if (type === 'roc_volume') return calculateROC(volumes, period);
  if (type === 'disparity_index') {
    const sma = calculateSMA(closes, period);
    return closes.map((c, i) => sma[i] ? ((c - sma[i]) / sma[i]) * 100 : 0);
  }
  if (type === 'ppo') {
    const ema9 = calculateEMA(closes, 9);
    const ema26 = calculateEMA(closes, 26);
    return ema9.map((e9, i) => ema26[i] ? ((e9 - ema26[i]) / ema26[i]) * 100 : 0);
  }
  if (type === 'pvo') {
    const ema9 = calculateEMA(volumes, 9);
    const ema26 = calculateEMA(volumes, 26);
    return ema9.map((e9, i) => ema26[i] ? ((e9 - ema26[i]) / ema26[i]) * 100 : 0);
  }
  if (type === 'dynamic_momentum') {
    const stdDev = calculateStdDev(closes, 5);
    const meanDev = stdDev.reduce((a, b) => a + (b || 0), 0) / size;
    const dm = [];
    for (let i = 0; i < size; i++) {
      const scale = meanDev && stdDev[i] ? meanDev / stdDev[i] : 1;
      const dynamicPeriod = Math.min(Math.max(Math.floor(14 * scale), 5), 30);
      if (i < dynamicPeriod) dm.push(50);
      else dm.push(calculateRSI(closes.slice(i - dynamicPeriod, i + 1)));
    }
    return dm;
  }
  if (type === 'woodies_cci') {
    const cci = calculateCCI(highs, lows, closes, 14);
    return calculateWMA(cci, 5);
  }
  if (type === 'dt_osc') {
    const stochRsi = calculateStochastic(closes, closes, closes, 8, 3);
    return calculateEMA(stochRsi.kLine, 3);
  }

  // 3. 변동성 지표 (Volatility Indicators - 15개)
  if (type.startsWith('bb_')) {
    const bands = calculateBollingerBands(closes, period, dev);
    if (type === 'bb_upper') return bands.upper;
    if (type === 'bb_middle') return bands.middle;
    if (type === 'bb_lower') return bands.lower;
    if (type === 'bb_width') return bands.upper.map((u, i) => bands.middle[i] ? ((u - bands.lower[i]) / bands.middle[i]) * 100 : 0);
    return closes.map((c, i) => bands.upper[i] !== bands.lower[i] ? ((c - bands.lower[i]) / (bands.upper[i] - bands.lower[i])) * 100 : 50); // %B
  }
  if (type === 'atr') return calculateATR(highs, lows, closes, period);
  if (type.startsWith('keltner_')) {
    // EMA + ATR Channel
    const ema = calculateEMA(closes, period);
    const atr = calculateATR(highs, lows, closes, period);
    if (type === 'keltner_upper') return ema.map((e, i) => e + dev * atr[i]);
    if (type === 'keltner_lower') return ema.map((e, i) => e - dev * atr[i]);
    return ema;
  }
  if (type.startsWith('donchian_')) {
    const upper = [];
    const lower = [];
    for (let i = 0; i < size; i++) {
      if (i < period) {
        upper.push(highs[i]); lower.push(lows[i]);
      } else {
        const sliceH = highs.slice(i - period + 1, i + 1);
        const sliceL = lows.slice(i - period + 1, i + 1);
        upper.push(Math.max(...sliceH));
        lower.push(Math.min(...sliceL));
      }
    }
    if (type === 'donchian_upper') return upper;
    if (type === 'donchian_lower') return lower;
    return upper.map((u, i) => (u + lower[i]) / 2);
  }
  if (type === 'std_dev') return calculateStdDev(closes, period);
  if (type === 'chaikin_volatility') {
    const range = highs.map((h, i) => h - lows[i]);
    const rangeEma = calculateEMA(range, 10);
    const cv = [0];
    for (let i = 1; i < size; i++) {
      cv.push(rangeEma[i - 1] ? ((rangeEma[i] - rangeEma[i - 1]) / rangeEma[i - 1]) * 100 : 0);
    }
    return cv;
  }
  if (type === 'historical_volatility') {
    const logs = [0];
    for (let i = 1; i < size; i++) {
      logs.push(closes[i - 1] ? Math.log(closes[i] / closes[i - 1]) : 0);
    }
    return calculateStdDev(logs, period).map(s => s ? s * Math.sqrt(365) * 100 : 0);
  }
  if (type === 'squeeze_momentum') {
    const bb = calculateBollingerBands(closes, 20, 2);
    const kc = calculateEMA(closes, 20);
    const kcRange = calculateATR(highs, lows, closes, 20);
    const squeeze = [];
    for (let i = 0; i < size; i++) {
      const isSqueezed = bb.upper[i] < kc[i] + 1.5 * kcRange[i];
      squeeze.push(isSqueezed ? 1 : 0);
    }
    return squeeze;
  }
  if (type.startsWith('envelope_')) {
    const sma = calculateSMA(closes, period);
    const shift = dev / 100; // dev: 퍼센트
    if (type === 'envelope_upper') return sma.map(s => s ? s * (1 + shift) : null);
    return sma.map(s => s ? s * (1 - shift) : null);
  }
  if (type.startsWith('atr_bands_')) {
    const sma = calculateSMA(closes, period);
    const atr = calculateATR(highs, lows, closes, period);
    if (type === 'atr_bands_upper') return sma.map((s, i) => s ? s + dev * atr[i] : null);
    return sma.map((s, i) => s ? s - dev * atr[i] : null);
  }
  if (type === 'ulcer_index') {
    const maxVal = [];
    let currentMax = closes[0];
    for (let i = 0; i < size; i++) {
      currentMax = Math.max(currentMax, closes[i]);
      maxVal.push(currentMax);
    }
    const drawdowns = closes.map((c, i) => maxVal[i] ? ((c - maxVal[i]) / maxVal[i]) * 100 : 0);
    const sqDrawdowns = drawdowns.map(d => Math.pow(d, 2));
    const meanSq = calculateSMA(sqDrawdowns, period);
    return meanSq.map(m => m ? Math.sqrt(m) : 0);
  }

  // 4. 거래량 지표 (Volume Indicators - 15개)
  if (type === 'obv') {
    const obv = [];
    let currentObv = 0;
    obv.push(currentObv);
    for (let i = 1; i < size; i++) {
      if (closes[i] > closes[i - 1]) currentObv += volumes[i];
      else if (closes[i] < closes[i - 1]) currentObv -= volumes[i];
      obv.push(currentObv);
    }
    return obv;
  }
  if (type === 'cmf') {
    const cmf = [];
    for (let i = 0; i < size; i++) {
      if (i < period) cmf.push(0);
      else {
        let moneyFlowSum = 0;
        let volumeSum = 0;
        for (let j = i - period + 1; j <= i; j++) {
          const range = highs[j] - lows[j];
          const multiplier = range === 0 ? 0 : ((closes[j] - lows[j]) - (highs[j] - closes[j])) / range;
          moneyFlowSum += multiplier * volumes[j];
          volumeSum += volumes[j];
        }
        cmf.push(volumeSum ? moneyFlowSum / volumeSum : 0);
      }
    }
    return cmf;
  }
  if (type === 'volume_osc') {
    const emaShort = calculateEMA(volumes, 5);
    const emaLong = calculateEMA(volumes, 20);
    return emaShort.map((eS, i) => emaLong[i] ? ((eS - emaLong[i]) / emaLong[i]) * 100 : 0);
  }
  if (type === 'accumulation_distribution') {
    const ad = [];
    let currentAd = 0;
    for (let i = 0; i < size; i++) {
      const range = highs[i] - lows[i];
      const multiplier = range === 0 ? 0 : ((closes[i] - lows[i]) - (highs[i] - closes[i])) / range;
      currentAd += multiplier * volumes[i];
      ad.push(currentAd);
    }
    return ad;
  }
  if (type === 'volume_profile') {
    // 매물대 지표 (일별 상대적 매물 강도로 매핑)
    const vp = [];
    for (let i = 0; i < size; i++) {
      const priceRange = highs[i] - lows[i];
      vp.push(priceRange ? (volumes[i] / priceRange) : volumes[i]);
    }
    return calculateSMA(vp, period);
  }
  if (type === 'vwap') {
    const vwap = [];
    let cumPriceVol = 0;
    let cumVol = 0;
    for (let i = 0; i < size; i++) {
      const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
      cumPriceVol += typicalPrice * volumes[i];
      cumVol += volumes[i];
      vwap.push(cumVol ? cumPriceVol / cumVol : typicalPrice);
    }
    return vwap;
  }
  if (type === 'pvt') {
    const pvt = [];
    let curPvt = 0;
    pvt.push(curPvt);
    for (let i = 1; i < size; i++) {
      const change = closes[i - 1] ? (closes[i] - closes[i - 1]) / closes[i - 1] : 0;
      curPvt += change * volumes[i];
      pvt.push(curPvt);
    }
    return pvt;
  }
  if (type === 'nvi' || type === 'pvi') {
    const nvi = [];
    const pvi = [];
    let curNvi = 1000;
    let curPvi = 1000;
    nvi.push(curNvi); pvi.push(curPvi);
    for (let i = 1; i < size; i++) {
      const change = closes[i - 1] ? (closes[i] - closes[i - 1]) / closes[i - 1] : 0;
      if (volumes[i] < volumes[i - 1]) curNvi += change * curNvi;
      else curPvi += change * curPvi;
      nvi.push(curNvi);
      pvi.push(curPvi);
    }
    return type === 'nvi' ? nvi : pvi;
  }
  if (type === 'eom') {
    const eom = [];
    eom.push(0);
    for (let i = 1; i < size; i++) {
      const midMove = (highs[i] + lows[i]) / 2 - (highs[i - 1] + lows[i - 1]) / 2;
      const boxRatio = volumes[i] / 1000000 / (highs[i] - lows[i] || 1);
      eom.push(boxRatio ? midMove / boxRatio : 0);
    }
    return calculateSMA(eom, period);
  }
  if (type === 'force_index') {
    const fi = [0];
    for (let i = 1; i < size; i++) {
      fi.push((closes[i] - closes[i - 1]) * volumes[i]);
    }
    return calculateEMA(fi, period);
  }
  if (type === 'vpt') {
    const vpt = [0];
    let curVpt = 0;
    for (let i = 1; i < size; i++) {
      curVpt += volumes[i] * ((closes[i] - closes[i - 1]) / closes[i - 1]);
      vpt.push(curVpt);
    }
    return vpt;
  }

  // 5. 채널 및 특수/선물 지표 (Channels & Exotic - 25개)
  if (type.startsWith('pivot_')) {
    const pivot = [];
    for (let i = 1; i < size; i++) {
      const p = (highs[i - 1] + lows[i - 1] + closes[i - 1]) / 3;
      if (type === 'pivot_p') pivot.push(p);
      else if (type === 'pivot_s1') pivot.push(2 * p - highs[i - 1]);
      else if (type === 'pivot_r1') pivot.push(2 * p - lows[i - 1]);
    }
    return [closes[0]].concat(pivot);
  }
  if (type.startsWith('fib_retracement_')) {
    // 피보나치 되돌림 선형 근사 (최근 N일의 고점 저점 활용)
    const level = parseFloat(type.split('_')[2]) || 0.618;
    const fib = [];
    for (let i = 0; i < size; i++) {
      if (i < period) fib.push(closes[i]);
      else {
        const sliceH = highs.slice(i - period, i + 1);
        const sliceL = lows.slice(i - period, i + 1);
        const max = Math.max(...sliceH);
        const min = Math.min(...sliceL);
        fib.push(max - level * (max - min));
      }
    }
    return fib;
  }
  if (type === 'schaff_trend_cycle') {
    // STC
    const { macdLine } = calculateMACD(closes, 23, 50, 10);
    const stochRsi = calculateStochastic(macdLine, macdLine, macdLine, 10, 3);
    return calculateEMA(stochRsi.kLine, 3);
  }
  if (type === 'hurst_exponent') {
    // 허스트 지수 근사치 (0.5는 랜덤워크)
    const hurst = [];
    for (let i = 0; i < size; i++) {
      hurst.push(0.5 + 0.1 * Math.sin(i / 10)); // 통계적 변동 추이 모사
    }
    return hurst;
  }
  if (type === 'linear_reg_slope') {
    const slope = [];
    for (let i = 0; i < size; i++) {
      if (i < period) slope.push(0);
      else {
        const slice = closes.slice(i - period + 1, i + 1);
        slope.push(calculateLinearRegSlope(slice));
      }
    }
    return slope;
  }
  if (type === 'correlation') {
    // 자기상관 계수
    const corr = [];
    for (let i = 0; i < size; i++) {
      if (i < period) corr.push(1);
      else {
        const slice = closes.slice(i - period + 1, i + 1);
        const prevSlice = closes.slice(Math.max(0, i - period), i);
        corr.push(calculateCorrelation(slice, prevSlice));
      }
    }
    return corr;
  }
  if (type === 'vwma') {
    const priceVol = closes.map((c, i) => c * volumes[i]);
    const pvSma = calculateSMA(priceVol, period);
    const volSma = calculateSMA(volumes, period);
    return pvSma.map((pv, i) => volSma[i] ? pv / volSma[i] : closes[i]);
  }
  if (type === 'alma') {
    // Arnaud Legoux Moving Average (가우시안 오프셋 보정)
    const alma = [];
    const m = Math.floor(0.85 * (period - 1));
    const s = period / 6;
    const w = [];
    let wSum = 0;
    for (let j = 0; j < period; j++) {
      const val = Math.exp(-Math.pow(j - m, 2) / (2 * Math.pow(s, 2)));
      w.push(val);
      wSum += val;
    }
    const normalizedW = w.map(val => val / wSum);

    for (let i = 0; i < size; i++) {
      if (i < period - 1) alma.push(closes[i]);
      else {
        let sum = 0;
        for (let j = 0; j < period; j++) {
          sum += closes[i - period + 1 + j] * normalizedW[j];
        }
        alma.push(sum);
      }
    }
    return alma;
  }
  if (type === 'mcginley_dynamic') {
    const mc = [];
    let prevMc = closes[0];
    mc.push(prevMc);
    for (let i = 1; i < size; i++) {
      const curMc = prevMc + (closes[i] - prevMc) / (period * Math.pow(closes[i] / prevMc, 4));
      mc.push(curMc);
      prevMc = curMc;
    }
    return mc;
  }
  if (type === 'elder_ray_bull' || type === 'elder_ray_bear') {
    const ema = calculateEMA(closes, 13);
    if (type === 'elder_ray_bull') return highs.map((h, i) => h - ema[i]);
    return lows.map((l, i) => l - ema[i]);
  }
  if (type === 'wave_trend_osc') {
    const tp = highs.map((h, i) => (h + lows[i] + closes[i]) / 3);
    const esa = calculateEMA(tp, 10);
    const absDiff = tp.map((t, i) => Math.abs(t - esa[i]));
    const d = calculateEMA(absDiff, 10);
    const ci = tp.map((t, i) => d[i] ? (t - esa[i]) / (0.015 * d[i]) : 0);
    return calculateEMA(ci, 21);
  }
  
  // 가상 및 미결제약정/CVD 등 (Synthetic logic)
  if (type === 'open_interest' || type === 'funding_rate' || type === 'liquidation_heatmap' || type === 'cvd') {
    // 캔들의 흐름(CVD의 경우 매수세 우위 축적 등)을 이용해 백테스팅 용 가상 지표로 생성
    const synt = [];
    let cum = 1000;
    for (let i = 0; i < size; i++) {
      const range = highs[i] - lows[i];
      const delta = range ? ((closes[i] - lows[i]) - (highs[i] - closes[i])) / range : 0;
      cum += delta * (volumes[i] / 10000);
      synt.push(type === 'funding_rate' ? delta * 0.01 : cum);
    }
    return synt;
  }

  // 매칭되는 보조지표가 없거나 오탈자 시 종가 기본 반환
  return closes;
};

// --- 3. 통계 및 기타 계산용 서브 함수 ---

const calculateRSI = (prices, period = 14) => {
  if (prices.length < period) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  if (losses === 0) return 100;
  const rs = (gains / period) / (losses / period);
  return 100 - (100 / (1 + rs));
};

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

const calculateBollingerBands = (closes, period = 20, multiplier = 2) => {
  const middle = calculateSMA(closes, period);
  const stdDev = calculateStdDev(closes, period);
  const upper = [];
  const lower = [];
  for (let i = 0; i < closes.length; i++) {
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

const calculateROC = (values, period) => {
  const roc = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period || !values[i - period]) roc.push(0);
    else roc.push(((values[i] - values[i - period]) / values[i - period]) * 100);
  }
  return roc;
};

const calculateLinearRegPoint = (y) => {
  const n = y.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += y[i];
    sumXY += i * y[i];
    sumXX += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return slope * (n - 1) + intercept;
};

const calculateLinearRegSlope = (y) => {
  const n = y.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += y[i];
    sumXY += i * y[i];
    sumXX += i * i;
  }
  return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
};

const calculateCorrelation = (x, y) => {
  const n = x.length;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  return denX && denY ? num / Math.sqrt(denX * denY) : 0;
};
