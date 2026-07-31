import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../lib/api';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

const toMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return '알 수 없는 오류가 발생했어요.';
};

/**
 * 마운트 시 한 번 불러오고, 필요할 때 다시 불러올 수 있는 조회 훅.
 * AbortController 로 언마운트 후 상태 갱신을 막는다.
 */
export const useAsync = <T>(
  loader: (signal: AbortSignal) => Promise<T>,
  deps: unknown[] = [],
): AsyncState<T> & { reload: () => void } => {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: true, error: null });
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setState((previous) => ({ ...previous, loading: true, error: null }));

    loader(controller.signal)
      .then((data) => {
        if (active) {
          setState({ data, loading: false, error: null });
        }
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) {
          return;
        }
        setState({ data: null, loading: false, error: toMessage(error) });
      });

    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { ...state, reload };
};

export { toMessage as toErrorMessage };
