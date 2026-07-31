import type { ApiResponse } from '@shared/types';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields: Record<string, string>;

  constructor(params: {
    code: string;
    message: string;
    status: number;
    fields?: Record<string, string>;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.code = params.code;
    this.status = params.status;
    this.fields = params.fields ?? {};
  }
}

const NETWORK_ERROR_MESSAGE = '네트워크 연결을 확인해 주세요.';

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  accessToken?: string;
  signal?: AbortSignal;
}

/**
 * 서버 응답 봉투를 풀어 data 만 돌려주고, 실패는 ApiError 로 통일한다.
 * 화면 코드가 응답 구조를 다시 해석하지 않도록 여기서 한 번만 처리한다.
 */
export const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const headers: Record<string, string> = {};

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }

  let response: Response;

  try {
    response = await fetch(`/api${path}`, {
      method: options.method ?? 'GET',
      headers,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw new ApiError({ code: 'NETWORK_ERROR', message: NETWORK_ERROR_MESSAGE, status: 0 });
  }

  let payload: ApiResponse<T> | null = null;

  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    payload = null;
  }

  if (!payload) {
    throw new ApiError({
      code: 'INVALID_RESPONSE',
      message: '서버 응답을 이해할 수 없어요. 잠시 후 다시 시도해 주세요.',
      status: response.status,
    });
  }

  if (!payload.success) {
    throw new ApiError({
      code: payload.error.code,
      message: payload.error.message,
      status: response.status,
      ...(payload.error.fields ? { fields: payload.error.fields } : {}),
    });
  }

  return payload.data;
};

/** CSV 등 봉투가 아닌 응답을 받을 때 사용한다. */
export const requestBlob = async (path: string, accessToken: string): Promise<Blob> => {
  const response = await fetch(`/api${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new ApiError({
      code: 'DOWNLOAD_FAILED',
      message: '다운로드에 실패했어요.',
      status: response.status,
    });
  }

  return response.blob();
};
