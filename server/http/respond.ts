import type { Response } from 'express';
import type { ApiFailure, ApiSuccess } from '../../shared/types';

export const ok = <T>(res: Response, data: T, status = 200): void => {
  const body: ApiSuccess<T> = { success: true, data, error: null };
  res.status(status).json(body);
};

export const fail = (
  res: Response,
  params: { status: number; code: string; message: string; fields?: Record<string, string> },
): void => {
  const body: ApiFailure = {
    success: false,
    data: null,
    error: {
      code: params.code,
      message: params.message,
      ...(params.fields ? { fields: params.fields } : {}),
    },
  };
  res.status(params.status).json(body);
};
