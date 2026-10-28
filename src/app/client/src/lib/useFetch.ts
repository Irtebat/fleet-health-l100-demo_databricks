import { useEffect, useState } from 'react';
import { errorMessage, request } from './api';

interface State<T> {
  url: string;
  token: number;
  data: T | null;
  error: string | null;
  updatedAt: Date | null;
}

// Loads a GET endpoint. Keeps the previous data on screen while a new load runs.
export function useFetch<T>(url: string) {
  const [token, setToken] = useState(0);
  const [state, setState] = useState<State<T> | null>(null);

  useEffect(() => {
    let cancelled = false;
    request<T>('GET', url).then(
      (data) => {
        if (!cancelled) setState({ url, token, data, error: null, updatedAt: new Date() });
      },
      (err: unknown) => {
        if (!cancelled) {
          setState((prev) => ({
            url,
            token,
            data: prev?.data ?? null,
            error: errorMessage(err),
            updatedAt: prev?.updatedAt ?? null,
          }));
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [url, token]);

  return {
    data: state?.data ?? null,
    error: state?.error ?? null,
    updatedAt: state?.updatedAt ?? null,
    // True while the first load, a filter change or a manual refresh is still running.
    refreshing: state === null || state.url !== url || state.token !== token,
    reload: () => setToken((t) => t + 1),
  };
}
