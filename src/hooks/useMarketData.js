import { useState, useEffect, useCallback, useRef } from 'react';

const SYMBOLS = 'BZ=F,CL=F,NG=F,FRO,STNG,RTX,LMT';
const YAHOO_URL = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${SYMBOLS}`;
const PROXY_URL = `https://corsproxy.io/?url=${encodeURIComponent(YAHOO_URL)}`;
const POLL_INTERVAL = 60_000;
const MAX_BACKOFF = 600_000; // 10 min

export function useMarketData() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);
  const backoffRef = useRef(POLL_INTERVAL);
  const timerRef = useRef(null);

  const scheduleNext = useCallback((delay) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchData(), delay);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(PROXY_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      const quotes = json.quoteResponse?.result || [];
      const mapped = {};
      for (const q of quotes) {
        mapped[q.symbol] = {
          symbol: q.symbol,
          price: q.regularMarketPrice,
          change: q.regularMarketChange,
          changePercent: q.regularMarketChangePercent,
          previousClose: q.regularMarketPreviousClose,
          name: q.shortName,
          marketState: q.marketState,
        };
      }

      setData(mapped);
      setLastUpdated(new Date());
      setError(null);
      backoffRef.current = POLL_INTERVAL;
      scheduleNext(POLL_INTERVAL);
    } catch (err) {
      console.error('Market data fetch failed:', err);
      setError(err.message);
      // Exponential backoff: 2min -> 5min -> 10min cap
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF);
      scheduleNext(backoffRef.current);
    } finally {
      setLoading(false);
    }
  }, [scheduleNext]);

  useEffect(() => {
    fetchData();
    return () => clearTimeout(timerRef.current);
  }, [fetchData]);

  const refetch = useCallback(() => {
    setLoading(true);
    backoffRef.current = POLL_INTERVAL;
    clearTimeout(timerRef.current);
    fetchData();
  }, [fetchData]);

  return { data, error, lastUpdated, loading, refetch };
}
