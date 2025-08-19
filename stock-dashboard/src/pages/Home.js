import React, { useEffect, useState } from "react";
import axios from "axios";
import "../App.css";
import { Link } from "react-router-dom";

const tickers = ["TSLA", "AAPL", "MSFT", "AMZN", "NVDA", "GOOG", "META", ];

const Home = () => {
  const [data, setData] = useState({});

  useEffect(() => {
    tickers.forEach(ticker => {
      axios.get(`/stock/${ticker}`)
        .then(res => setData(prev => ({ ...prev, [ticker]: { ...res.data } })))
        .catch(err => console.error(ticker, err));
    });
  }, []);

  const getChangeClass = (change) => change >= 0 ? "positive" : "negative";

  const getRecommendationClass = (rec) => {
    if (!rec) return "rec-hold"; // fallback class if data is missing
    if (rec.includes("Strong Buy") || rec.includes("Buy")) return "rec-buy";
    if (rec.includes("Strong Sell") || rec.includes("Sell")) return "rec-sell";
    return "rec-hold";
  };
  
  return (
    <div className="dashboard">
        <h1 className="title">📊 Stock Signal Dashboard</h1>
        <div className="card-container">
            {tickers.map(ticker => {
            const info = data[ticker];
            return (
                <Link to={`/stock/${ticker}`}>
                    <div className="card" key={ticker}>
                        <h3>{ticker}</h3>
                        {info ? (
                            <>
                            <p><strong>Close:</strong> ${info.latest_close}</p>
                            <p className={getChangeClass(info.change_pct)}>
                                <strong>Change:</strong> {info.change_pct}%
                            </p>
                            <p>
                                <strong>Recommendation:</strong>
                                <span className={`badge ${getRecommendationClass(info.recommendation)}`}>
                                {info.recommendation}
                                </span>
                            </p>
                            </>
                            ) : (
                            <p>Loading...</p>
                        )}
                    </div>
                </Link>
            );
            })}
        </div>
    </div>
  ); 
}

export default Home;