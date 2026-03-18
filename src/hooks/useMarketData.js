import { useState, useEffect, useCallback, useRef } from 'react';

const MARKET_URL = `${import.meta.env.BASE_URL}data-market.json`;
const POLL_INTERVAL = 60_000;
const MAX_BACKOFF = 600_000; // 10 min

export function useMarketData() {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState(null);
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
      const res = await fetch(MARKET_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      const mapped = {};
      for (const [sym, q] of Object.entries(json.quotes || {})) {
        mapped[sym] = {
          symbol: q.symbol,
          price: q.price,
          change: q.change,
          changePercent: q.changePercent,
          previousClose: q.previousClose,
          name: q.name,
        };
      }

      setData(mapped);
      setHistory(json.history || null);
      setLastUpdated(json.updated ? new Date(json.updated) : new Date());
      setError(null);
      backoffRef.current = POLL_INTERVAL;
      scheduleNext(POLL_INTERVAL);
    } catch (err) {
      console.error('Market data fetch failed:', err);
      setError(err.message);
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

  return { data, history, error, lastUpdated, loading, refetch };
}
