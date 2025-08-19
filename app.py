from flask import Flask, jsonify, request
import yfinance as yf
import requests
import os
import math
from dotenv import load_dotenv
from openai import OpenAI
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

load_dotenv()

app = Flask(__name__)

def get_recommendation(change_pct):
    if change_pct >= 3:
        return "Strong Buy"
    elif change_pct >= 1:
        return "Buy"
    elif change_pct > -1:
        return "Hold"
    elif change_pct > -3:
        return "Sell"
    else:
        return "Strong Sell"
    
def get_date_range():
    today = datetime.today().strftime("%Y-%m-%d")
    last_week = (datetime.today() - timedelta(days=7)).strftime("%Y-%m-%d")
    return today, last_week

@app.route("/stock/<ticker>", methods=["GET"])
def stock_info(ticker):
    stock = yf.Ticker(ticker)
    hist = stock.history(period="5d")
    if len(hist) < 2:
        return jsonify({"error": "Not enough data"}), 400

    latest = hist['Close'].iloc[-1]
    previous = hist['Close'].iloc[-2]
    change = ((latest - previous) / previous) * 100
    recommendation = get_recommendation(change)

    return jsonify({
        "ticker": ticker.upper(),
        "latest_close": round(latest, 2),
        "change_pct": round(change, 2),
        "recommendation": recommendation
    })

@app.route("/sentiment/<ticker>", methods=["GET"])
def get_sentiment(ticker):
    stock = yf.Ticker(ticker)

    # --- Compute Put/Call Ratio (nearest expiry) ---
    try:
        expirations = stock.options
        chain = stock.option_chain(expirations[0]) if expirations else None
        puts = chain.puts if chain else None
        calls = chain.calls if chain else None

        put_volume = puts['volume'].sum() if puts is not None else 0
        call_volume = calls['volume'].sum() if calls is not None else 0

        put_call_ratio = round(put_volume / call_volume, 2) if call_volume > 0 else None
    except Exception as e:
        print("Put/Call Ratio error:", e)
        put_call_ratio = None

    # --- News via Finnhub ---
    today, last_week = get_date_range()
    
    news_url = f"https://finnhub.io/api/v1/company-news?symbol={ticker}&from={last_week}&to={today}&token={os.getenv('FINNHUB_API_KEY')}"
    news_response = requests.get(news_url)
    news = news_response.json()[:5] if news_response.status_code == 200 else []

    # --- Short Interest % ---
    try:
        info = stock.info
        shares_short = info.get("sharesShort", 0)
        float_shares = info.get("floatShares", 0)
        short_percent = round((shares_short / float_shares) * 100, 2) if float_shares > 0 else None
    except Exception as e:
        print("Short interest error:", e)
        short_percent = None

    # --- Analyst Recommendation Trend (latest 5 rows) ---
    try:
        finnhub_rec_url = f"https://finnhub.io/api/v1/stock/recommendation?symbol={ticker}&token={os.getenv("FINNHUB_API_KEY")}"
        rec_response = requests.get(finnhub_rec_url)
        if rec_response.status_code == 200 and rec_response.json():
            analyst_summary = rec_response.json()[0]  # most recent period
        else:
            analyst_summary = {}
    except Exception as e:
        print("Finnhub analyst recommendation error:", e)
        analyst_summary = {}


    return jsonify({
        "put_call_ratio": put_call_ratio,
        "short_interest_pct": short_percent,
        "analyst_summary": analyst_summary,
        "news": news
    })


@app.route("/metrics/<ticker>", methods=["GET"])
def get_metrics(ticker):
    try:
        stock = yf.Ticker(ticker)
        info = stock.info

        # Extract key financial metrics
        metrics = {
            "ticker": ticker.upper(),
            "pe_ratio": info.get("trailingPE"),
            "pb_ratio": info.get("priceToBook"),
            "ev_to_ebitda": info.get("enterpriseToEbitda"),
            "debt_to_equity": info.get("debtToEquity"),
            "free_cash_flow": info.get("freeCashflow"),
        }

        return jsonify(metrics)

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@app.route("/history/<ticker>", methods=["GET"])
def get_historical_data(ticker):

    interval_map = {
        "1d": ("1d", "5m"),
        "1w": ("5d", "30m"),
        "1m": ("1mo", "1d"),
        "6m": ("6mo", "1d")
    }

    user_interval = request.args.get("interval", "1m")
    period, granularity = interval_map.get(user_interval, ("1mo", "1d"))

    stock = yf.Ticker(ticker)
    hist = stock.history(period=period, interval=granularity)

    if hist.empty:
        return jsonify({"error": "No historical data found"}), 404

    data = [
        {"date": index.strftime("%Y-%m-%d %H:%M"), "close": round(row["Close"], 2)}
        for index, row in hist.iterrows()
    ]
    return jsonify(data)


@app.route("/indicators/<ticker>", methods=["GET"])
def get_indicators(ticker):

    stock = yf.Ticker(ticker)
    hist = stock.history(period="1y")

    if hist.empty or len(hist) < 30:
        return jsonify({"error": "Not enough data for indicators"}), 400

    close = hist['Close']
    volume = hist['Volume']

    # Simple Moving Average (20d)
    sma = close.rolling(window=20).mean().iloc[-1]

    # Exponential Moving Average (20d)
    ema = close.ewm(span=20, adjust=False).mean().iloc[-1]

    # MACD
    ema_12 = close.ewm(span=12, adjust=False).mean()
    ema_26 = close.ewm(span=26, adjust=False).mean()
    macd_series = ema_12 - ema_26
    macd = macd_series.iloc[-1]
    macd_signal = macd_series.ewm(span=9, adjust=False).mean().iloc[-1]

    # RSI
    delta = close.diff()
    gain = delta.where(delta > 0, 0)
    loss = -delta.where(delta < 0, 0)
    avg_gain = gain.rolling(window=14).mean()
    avg_loss = loss.rolling(window=14).mean()
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    rsi_latest = rsi.iloc[-1]

    return jsonify({
        "sma": round(sma, 2),
        "ema": round(ema, 2),
        "macd": round(macd, 2),
        "rsi": round(rsi_latest, 2),
        "volume": int(volume.iloc[-1]),
        "macd_signal": round(macd_signal, 2)
    })


client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

@app.route("/analysis/<ticker>", methods=["GET"])
def get_ai_analysis(ticker):
    try:
        stock = yf.Ticker(ticker)
        info = stock.info

        pe = info.get("trailingPE")
        pb = info.get("priceToBook")
        ev_ebitda = info.get("enterpriseToEbitda")
        debt_eq = info.get("debtToEquity")
        fcf = info.get("freeCashflow")

        # Properly call get_indicators()
        indicators_resp = get_indicators(ticker)
        if indicators_resp.status_code != 200:
            return indicators_resp
        indicators = indicators_resp.get_json()

        rsi = indicators.get("rsi")
        macd = indicators.get("macd")

        # Format the prompt
        prompt = f"""
        You are a financial analyst. Given the following data, provide a short summary of the stock's outlook for {ticker}:
        - PE Ratio: {pe}
        - PB Ratio: {pb}
        - EV/EBITDA: {ev_ebitda}
        - Debt to Equity: {debt_eq}
        - Free Cash Flow: {fcf}
        - RSI: {rsi}
        - MACD: {macd}

        Evaluate valuation, risk, and momentum. Provide 2–3 sentences.
        End with one of: Strong Buy, Buy, Sell, Strong Sell.
        """

        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
        )

        analysis = response.choices[0].message.content
        return jsonify({"analysis": analysis})

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    

if __name__ == "__main__":
    app.run(debug=True)