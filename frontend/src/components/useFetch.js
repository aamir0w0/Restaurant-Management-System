import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { errMsg } from '../utils/format';
export function useFetch(url, params, { poll } = {}) {
  const [data, setData] = useState(null); const [meta, setMeta] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(null); const [fetchedAt, setFetchedAt] = useState(Date.now());
  const key = JSON.stringify(params || {});
  const load = useCallback((silent) => { if (!silent) setLoading(true); return api.get(url, { params: JSON.parse(key) }).then((r) => { setData(r.data.data); setMeta(r.data.meta || null); setFetchedAt(Date.now()); setError(null); }).catch((e) => setError(errMsg(e))).finally(() => setLoading(false)); }, [url, key]);
  useEffect(() => { load(); if (!poll) return; const t = setInterval(() => load(true), poll); return () => clearInterval(t); }, [load, poll]);
  return { data, meta, loading, error, reload: load, fetchedAt };
}