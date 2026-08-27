'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from './api';

interface QueryState<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  refetch: () => void;
}

/** Small fetch-on-mount hook (loading/error/data + refetch) - deliberately not a caching
 * library like react-query, since every page here needs exactly "fetch once, show a spinner,
 * show an error with retry" and nothing more. */
export function useApiQuery<T>(fetcher: () => Promise<T>, deps: React.DependencyList = []): QueryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(() => {
    setIsLoading(true);
    setError(null);
    fetcherRef
      .current()
      .then((result) => setData(result))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load data'))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    load();
  }, [load]);

  return { data, error, isLoading, refetch: load };
}
