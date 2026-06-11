import React, { useState, useEffect, useRef } from 'react';
import { auth, googleProvider, db, functions } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, addDoc, query, onSnapshot, orderBy, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { translations } from './translations';
import { Chart } from 'chart.js/auto';

function App() {
  // --- States ---
  const [language, setLanguage] = useState('ko');
  const [currency, setCurrency] = useState('krw');
  const [allCoins, setAllCoins] = useState([]);
  const [displayedCoins, setDisplayedCoins] = useState([]);
  const [selectedCoinIds, setSelectedCoinIds] = useState(['bitcoin', 'ethereum', 'ripple', 'dogecoin', 'solana', 'cardano']);
  const [favorites, setFavorites] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [loadingCoins, setLoadingCoins] = useState(false);
  const [limitMessageVisible, setLimitMessageVisible] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Modal & Chart states
  const [selectedModalCoinId, setSelectedModalCoinId] = useState(null);
  const [modalCoinDetails, setModalCoinDetails] = useState(null);
  const [modalChartData, setModalChartData] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
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

  const coingeckoApiKey = 'CG-xmGqWe2JgRKTWjf1WSPT9saQ';

  // --- Translation Helper ---
  const t = (key) => translations[language]?.[key] || key;

  // --- Auth State Change Listener ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser({ uid: currentUser.uid, displayName: currentUser.displayName });
        // Load settings from Firestore
        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.selectedCoinIds) setSelectedCoinIds(data.selectedCoinIds);
            if (data.favorites) setFavorites(data.favorites);
          }
        } catch (error) {
          console.error("Firestore 로드 실패, 로컬 스토리지 사용:", error);
          loadLocalData();
        }
      } else {
        setUser(null);
        loadLocalData();
      }
    });

    // Language setting initial load
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
    if (savedSelectedCoins && JSON.parse(savedSelectedCoins).length > 0) {
      setSelectedCoinIds(JSON.parse(savedSelectedCoins));
    }
  };

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

  // --- Fetch 100 Sidebar Coins ---
  useEffect(() => {
    const fetchSidebarCoins = async () => {
      const cacheKey = `sidebarCoins_${currency}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { timestamp, data } = JSON.parse(cached);
        if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
          setAllCoins(data);
          return;
        }
      }
      try {
        const response = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=${currency}&order=market_cap_desc&per_page=100&page=1&sparkline=false&x_cg_demo_api_key=${coingeckoApiKey}`);
        if (!response.ok) throw new Error('Failed to fetch sidebar coins');
        const data = await response.json();
        setAllCoins(data);
        localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data }));
      } catch (error) {
        console.error("사이드바 코인 목록 로딩 실패:", error);
      }
    };

    fetchSidebarCoins();
  }, [currency]);

  // --- Fetch detailed info & calculations ---
  useEffect(() => {
    const loadCoinData = async () => {
      if (selectedCoinIds.length === 0) {
        setDisplayedCoins([]);
        return;
      }
      setLoadingCoins(true);
      try {
        const ids = selectedCoinIds.join(',');
        const marketResponse = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=${currency}&ids=${ids}&order=market_cap_desc&price_change_percentage=24h&x_cg_demo_api_key=${coingeckoApiKey}`);
        if (!marketResponse.ok) throw new Error('Failed to fetch market data');
        const marketData = await marketResponse.json();

        const coinDataPromises = marketData.map(async (coin) => {
          // Add delay to prevent rate limit
          await new Promise(resolve => setTimeout(resolve, 350));
          const chartResponse = await fetch(`https://api.coingecko.com/api/v3/coins/${coin.id}/market_chart?vs_currency=${currency}&days=30&x_cg_demo_api_key=${coingeckoApiKey}`);
          if (!chartResponse.ok) {
            return { ...coin, rsi: 50, ma_20_day_comparison: 'neutral' };
          }
          const chartData = await chartResponse.json();
          const prices = chartData.prices.map(p => p[1]).slice(-21);
          const rsi = calculateRSI(prices.slice(-15));
          const ma_20 = prices.reduce((a, b) => a + b, 0) / prices.length;
          const ma_20_day_comparison = coin.current_price > ma_20 ? 'above' : 'below';

          return { ...coin, rsi, ma_20_day_comparison };
        });

        const completedData = await Promise.all(coinDataPromises);
        setDisplayedCoins(completedData);
      } catch (error) {
        console.error("데이터 로딩 실패:", error);
      } finally {
        setLoadingCoins(false);
      }
    };

    loadCoinData();
  }, [selectedCoinIds, currency]);

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

  // --- Detail Modal fetch & chart rendering ---
  useEffect(() => {
    if (!selectedModalCoinId) return;

    const fetchModalDetails = async () => {
      setModalLoading(true);
      try {
        const detailsResponse = await fetch(`https://api.coingecko.com/api/v3/coins/${selectedModalCoinId}?localization=true&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false&x_cg_demo_api_key=${coingeckoApiKey}`);
        const chartResponse = await fetch(`https://api.coingecko.com/api/v3/coins/${selectedModalCoinId}/market_chart?vs_currency=${currency}&days=7&interval=daily&x_cg_demo_api_key=${coingeckoApiKey}`);
        
        if (!detailsResponse.ok || !chartResponse.ok) throw new Error("Failed to fetch details");

        const details = await detailsResponse.json();
        const chartData = await chartResponse.json();

        setModalCoinDetails(details);
        setModalChartData(chartData.prices);
      } catch (error) {
        console.error("상세 데이터 로딩 실패:", error);
      } finally {
        setModalLoading(false);
      }
    };

    fetchModalDetails();
  }, [selectedModalCoinId, currency]);

  // Chart rendering effect
  useEffect(() => {
    if (!modalChartData || !chartRef.current) return;

    const ctx = chartRef.current.getContext('2d');
    if (chartInstance.current) chartInstance.current.destroy();

    const labels = modalChartData.map(p => new Date(p[0]).toLocaleDateString(language));
    const data = modalChartData.map(p => p[1]);

    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: t('chart_title'),
          data,
          borderColor: '#4facfe',
          backgroundColor: 'rgba(79, 172, 254, 0.08)',
          borderWidth: 2,
          tension: 0.4,
          pointRadius: 0,
          fill: true,
        }]
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
          legend: { display: false }
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

  // --- AI Briefing Generator ---
  const fetchPersonalizedBriefing = async () => {
    setBriefingLoading(true);
    setBriefingError('');
    setAiBriefingResults([]);

    const coinNames = selectedCoinIds.map(id => {
      const coin = allCoins.find(c => c.id === id);
      return coin ? coin.name : id;
    });

    try {
      const callBriefing = httpsCallable(functions, 'getAIBriefing');
      const result = await callBriefing({ lang: language, coins: coinNames });
      
      let analysisData;
      try {
        analysisData = JSON.parse(result.data.candidates?.[0]?.content?.parts?.[0]?.text || '[]');
      } catch (e) {
        console.error("AI 응답 JSON 파싱 실패:", e);
        throw new Error(t('briefing_error'));
      }
      setAiBriefingResults(analysisData);
    } catch (error) {
      console.error("AI 브리핑 생성 실패:", error);
      setBriefingError(error.message || t('briefing_error'));
    } finally {
      setBriefingLoading(false);
    }
  };

  // --- Post Opinion ---
  const handlePostOpinion = async () => {
    if (!opinionContent.trim() || !user) return;
    setOpinionPosting(true);
    try {
      await addDoc(collection(db, "opinions"), {
        uid: user.uid,
        nickname: user.displayName,
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
        <a href="#" className="logo-text" onClick={(e) => { e.preventDefault(); setActiveTab('home'); }}>Oracoin</a>
        
        <nav className="main-nav">
          <a href="#" className={`nav-link ${activeTab === 'home' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('home'); }}>홈</a>
          <a href="#" className={`nav-link ${activeTab === 'blog' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('blog'); }}>AI 브리핑</a>
          <a href="#" className={`nav-link ${activeTab === 'about' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('about'); }}>소개</a>
        </nav>

        <div className="header-right">
          {user ? (
            <button 
              className="filter-btn" 
              onClick={() => signOut(auth)}
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
            >
              {user.displayName} (Logout)
            </button>
          ) : (
            <button 
              className="btn-accent" 
              onClick={() => signInWithPopup(auth, googleProvider)}
            >
              Google Login
            </button>
          )}
          
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button className={`filter-btn ${language === 'ko' ? 'active' : ''}`} onClick={() => changeLanguage('ko')} style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>KO</button>
            <button className={`filter-btn ${language === 'en' ? 'active' : ''}`} onClick={() => changeLanguage('en')} style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>EN</button>
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
            </aside>

            {/* Main Cards View */}
            <main className="dashboard-content">
              <div className="container-inner">
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
                      <div className="skeleton-card animate-pulse glass-panel p-12 flex-center" key={id} style={{ height: '260px' }}>
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

                <div className="selected-coins-box glass-panel">
                  <h3 style={{ fontSize: '0.9rem', fontWeight: '700' }}>{t('analysis_target')}</h3>
                  <div className="coins-chips-container">
                    {selectedCoinIds.length === 0 ? (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{t('add_coin_for_briefing')}</p>
                    ) : (
                      selectedCoinIds.map(id => {
                        const coin = allCoins.find(c => c.id === id);
                        return (
                          <span className="coin-chip" key={id}>
                            {coin && <img src={coin.image} alt={coin.name} className="coin-chip-img" />}
                            {coin ? coin.name : id}
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="text-center-align">
                  <button 
                    className="btn-primary" 
                    onClick={fetchPersonalizedBriefing}
                    disabled={selectedCoinIds.length === 0 || briefingLoading}
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
                        <div style={{ textAlign: 'right' }}>
                          <button 
                            className="btn-accent" 
                            onClick={handlePostOpinion}
                            disabled={!opinionContent.trim() || opinionPosting}
                          >
                            {opinionPosting ? t('posting_opinion') : t('post_opinion_btn')}
                          </button>
                        </div>
                      </>
                    ) : (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center' }}>
                        의견을 남기려면 <a href="#" onClick={(e) => { e.preventDefault(); signInWithPopup(auth, googleProvider); }} style={{ color: 'var(--accent-cyan)', fontWeight: '700' }}>로그인</a>해주세요.
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="flex-center" style={{ justifyContent: 'flex-start', gap: '1rem' }}>
                  <img src={modalCoinDetails.image?.small} alt={modalCoinDetails.name} style={{ width: '3rem', height: '3rem', borderRadius: '50%' }} />
                  <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: '700', fontFamily: 'var(--font-heading)' }}>{modalCoinDetails.name}</h2>
                    <p style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.85rem' }}>{modalCoinDetails.symbol}</p>
                  </div>
                </div>

                <div className="grid-details" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
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
