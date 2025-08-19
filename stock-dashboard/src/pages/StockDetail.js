import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import { format, parseISO, isSameDay } from 'date-fns';
import { Link } from 'react-router-dom'

const intervals = {
  '1d': 'Past Day',
  '1w': 'Past Week',
  '1m': 'Past Month',
  '6m': 'Past 6 Months'
};

const getYAxisDomain = (data) => {
  const closes = data.map(d => d.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const buffer = (max - min) * 0.05;
  return [Math.floor(min - buffer), Math.ceil(max + buffer)];
};

const getLineColor = (data) => {
  if (data.length < 2) return "#8884d8";
  return data[data.length - 1].close >= data[0].close ? "green" : "red";
};

const getDailyTicks = (data, interval) => {
  if (!['1d', '1w'].includes(interval)) return undefined;

  const ticks = [];
  for (let i = 0; i < data.length; i++) {
    if (i === 0 || !isSameDay(parseISO(data[i].date), parseISO(data[i - 1].date))) {
      ticks.push(data[i].date);
    }
  }
  return ticks;
};

const interpretPERatio = (value) => {
  if (value == null) return "N/A";
  if (value < 15) return "✅ Undervalued (Buy)";
  if (value > 30) return "⚠️ Overvalued (Sell)";
  return "➖ Fairly Valued";
};

const interpretPBRatio = (value) => {
  if (value == null) return "N/A";
  if (value < 1) return "✅ Undervalued (Positive Signal)";
  if (value > 3) return "⚠️ Possibly Overvalued";
  return "➖ Fairly Priced";
};

const interpretDebtToEquity = (value) => {
  if (value == null) return "N/A";
  if (value < 1) return "✅ Low Leverage (Safe)";
  if (value > 2) return "⚠️ High Risk (Debt-heavy)";
  return "➖ Moderate Risk";
};

const interpretEVtoEBITDA = (value) => {
  if (value == null) return "N/A";
  if (value < 10) return "✅ Attractive Valuation";
  if (value > 20) return "⚠️ Expensive";
  return "➖ Reasonable";
};

const interpretRSI = (value) => {
  if (value == null) return "N/A";
  if (value < 30) return "✅ Oversold (Buy Signal)";
  if (value > 70) return "⚠️ Overbought (Sell Signal)";
  return "➖ Neutral";
};

const interpretMACD = (value) => {
  if (value == null) return "N/A";
  if (value > 0) return "✅ Bullish Momentum";
  if (value < 0) return "⚠️ Bearish Momentum";
  return "➖ No Clear Trend";
};

const interpretMovingAverages = (sma, ema, latestPrice) => {
  if (!sma || !ema || !latestPrice) return {
    smaSignal: "N/A",
    emaSignal: "N/A"
  };

  const smaSignal = latestPrice > sma
    ? "✅ Price above SMA (Uptrend)"
    : "⚠️ Price below SMA (Downtrend)";

  const emaSignal = latestPrice > ema
    ? "✅ Price above EMA (Short-term Strength)"
    : "⚠️ Price below EMA (Weakness)";

  return { smaSignal, emaSignal };
};

const interpretVolume = (volume) => {
  if (volume == null) return "N/A";

  if (volume > 50_000_000) return "✅ High volume (Strong interest)";
  if (volume < 1_000_000) return "⚠️ Low volume (Weak interest)";
  return "➖ Normal volume";
};

const StockDetail = () => {
  const { ticker } = useParams();
  const [metrics, setMetrics] = useState(null);
  const [priceData, setPriceData] = useState([]);
  const [interval, setInterval] = useState('1m');
  const [error, setError] = useState(null);
  const [indicators, setIndicators] = useState(null);
  const [sentiment, setSentiment] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [latestClose, setLatestClose] = useState(null);

  useEffect(() => {
    const fetchClose = async () => {
      try {
        const res = await fetch(`/stock/${ticker}`);
        const json = await res.json();
        setLatestClose(json.latest_close);
      } catch (err) {
        console.error("Failed to fetch latest close", err);
      }
    };

    fetchClose();
  }, [ticker]);

  useEffect(() => {
    const fetchAI = async () => {
      try {
        const res = await fetch(`/analysis/${ticker}`);
        const json = await res.json();
        setAiAnalysis(json.analysis || "No analysis available.");
      } catch (err) {
        console.error("AI analysis error:", err);
        setAiAnalysis("AI Analysis not available.");
      }
    };

    fetchAI();
  }, [ticker]);

  useEffect(() => {
  const fetchSentimentData = async () => {
    try {
      const res = await fetch(`/sentiment/${ticker}`);
      const text = await res.text(); // Read raw text first
      console.log("Raw response text:", text);

      const data = JSON.parse(text); // Manually parse
      console.log("Parsed sentiment data:", data);

      setSentiment(data);
    } catch (err) {
      console.error("Failed to fetch or parse sentiment data:", err);
      setSentiment({ error: "Could not load sentiment data." });
    }
  };

  fetchSentimentData();
}, [ticker]);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await axios.get(`/metrics/${ticker}`);
        setMetrics(res.data);
      } catch (err) {
        console.error(err);
        setError("Failed to fetch metrics.");
      }
    };

    fetchMetrics();
  }, [ticker]);

  useEffect(() => {
    const fetchPriceData = async () => {
      try {
        const res = await axios.get(`/history/${ticker}?interval=${interval}`);
        setPriceData(res.data);
      } catch (err) {
        console.error(err);
        const msg = err.response?.data?.error || "Failed to fetch price data.";
        setError(msg);
      }
    };

    fetchPriceData();
  }, [ticker, interval]);

  useEffect(() => {
    const fetchIndicators = async () => {
      try {
        const res = await axios.get(`/indicators/${ticker}`);
        setIndicators(res.data);
      } catch (err) {
        console.error("Failed to load indicators", err);
      }
    };

    fetchIndicators();
  }, [ticker]);

  return (
    <>
    <Link to="/">← Back to Dashboard</Link>
    <h1 className="title">{ticker.toUpperCase()} Financial Metrics</h1>
    <div className="detail-grid">
      <div className='left-column'>
        <h2>Price Chart</h2>
        <label>
          Interval:{" "}
          <select value={interval} onChange={e => setInterval(e.target.value)}>
            {Object.entries(intervals).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </label>

        {priceData.length > 0 && (
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={priceData}>
                <CartesianGrid stroke="#ccc" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => format(parseISO(value), 'MMM d, yyyy')}
                  ticks={getDailyTicks(priceData, interval)}
                  tick={{ fontSize: 12 }}
                  minTickGap={20}
                />
                <YAxis
                  domain={getYAxisDomain(priceData)}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  labelFormatter={(value) => (
                    <span style={{ color: 'black' }}>
                      {format(parseISO(value), 'MMM d, yyyy')}
                    </span>
                  )}
                  formatter={(val) => [`$${val.toFixed(2)}`, 'Close']}
                />
                <Line
                  type="monotone"
                  dataKey="close"
                  stroke={getLineColor(priceData)}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className='metrics-container'>
           <div className='detail-card fundamental'>
            <h3>📘 Fundamental Analysis</h3>
            {error && <p style={{ color: "red" }}>{error}</p>}
            {!metrics && !error && <p>Loading...</p>}

            {metrics && (
              <>
                <p>
                  <strong>P/E Ratio</strong>: {metrics.pe_ratio ?? "N/A"}
                  <span>{interpretPERatio(metrics.pe_ratio)}</span>
                </p>
                <p>
                  <strong>P/B Ratio</strong>: {metrics.pb_ratio ?? "N/A"}
                  <span>{interpretPBRatio(metrics.pb_ratio)}</span>
                </p>
                <p>
                  <strong>EV to EBITDA</strong>: {metrics.ev_to_ebitda ?? "N/A"}
                  <span>{interpretEVtoEBITDA(metrics.ev_to_ebitda)}</span>
                </p>
                <p>
                  <strong>Debt to Equity Ratio</strong>: {metrics.debt_to_equity ?? "N/A"}
                  <span>{interpretDebtToEquity(metrics.debt_to_equity)}</span>
                </p>
                <p>
                  <strong>Free Cash Flow</strong>: ${Number(metrics.free_cash_flow).toLocaleString() ?? "N/A"}
                </p>
              </>
            )}
          </div>

          <div className='detail-card technical'>
            <h3>Technical Analysis</h3>
            {!indicators && <p>Loading indicators...</p>}
            {indicators && latestClose && (() => {
              const { smaSignal, emaSignal } = interpretMovingAverages(indicators.sma, indicators.ema, latestClose);
              return (
                <>
                  <p>
                    <strong>MACD Signal</strong>: {indicators.macd_signal}
                    <span>
                      {indicators.macd > indicators.macd_signal
                        ? "✅ Bullish Crossover"
                        : indicators.macd < indicators.macd_signal
                        ? "❌ Bearish Crossover"
                        : "➖ No Crossover"}
                    </span>
                  </p>
                  <p>
                    <strong>RSI (14d)</strong>: {indicators.rsi}
                    <span>{interpretRSI(indicators.rsi)}</span>
                  </p>
                  <p>
                    <strong>MACD</strong>: {indicators.macd}
                    <span>{interpretMACD(indicators.macd)}</span>
                  </p>
                  <p>
                    <strong>Simple MA (20d)</strong>: ${indicators.sma}
                    <span>{smaSignal}</span>
                  </p>
                  <p>
                    <strong>Exp MA (20d)</strong>: ${indicators.ema}
                    <span>{emaSignal}</span>
                  </p>
                  <p>
                    <strong>Latest Volume</strong>: {indicators.volume.toLocaleString()}
                    <span>{interpretVolume(indicators.volume)}</span>
                  </p>
                </>
              );
            })()}
          </div>
         
          <div className="detail-card analyst">
            <h3>🧾 Analyst Recommendation Summary</h3>
            {sentiment?.analyst_summary && sentiment.analyst_summary.period ? (
              <>
                <p>
                  <strong>Period:</strong>
                  <span>{sentiment.analyst_summary.period}</span>
                </p>
                <p>
                  <strong>Strong Buy:</strong>
                  <span>{sentiment.analyst_summary.strongBuy}</span>
                </p>
                <p>
                  <strong>Buy:</strong>
                  <span>{sentiment.analyst_summary.buy}</span>
                </p>
                <p>
                  <strong>Hold:</strong>
                  <span>{sentiment.analyst_summary.hold}</span>
                </p>
                <p>
                  <strong>Sell:</strong>
                  <span>{sentiment.analyst_summary.sell}</span>
                </p>
                <p>
                  <strong>Strong Sell:</strong>
                  <span>{sentiment.analyst_summary.strongSell}</span>
                </p>
              </>
            ) : (
              <p>No recent analyst recommendations.</p>
            )}
          </div>
        </div>
      </div>
      <div className="right-column">
        <div className="detail-card">
          <h3>📰 Recent News</h3>
          {sentiment?.news?.length ? (
            <div className="news-list">
              {sentiment.news.map((item, idx) => (
                <div key={idx} className="news-item">
                  <div className="news-content">
                    <a href={item.url} target="_blank" rel="noreferrer" className="news-headline">
                      {item.headline}
                    </a>
                    <div className="news-date">
                      {new Date(item.datetime * 1000).toLocaleDateString()}
                    </div>
                    {item.summary && (
                      <div className="news-summary">
                        {item.summary.slice(0, 120)}...
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>No news available</p>
          )}
        </div>
        <div className="detail-card">
          <h3>🧠 AI Analysis</h3>
          {aiAnalysis ? (
            <p>{aiAnalysis}</p>
          ) : (
            <p>Loading AI insights...</p>
          )}
        </div> 
      </div>
    </div>
    </>
  );
};

export default StockDetail;