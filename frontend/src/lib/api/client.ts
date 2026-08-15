import { normalizeApiError, getStatusFallbackMessage } from './error';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    const cleanMessage = normalizeApiError({ status, message, data }, message);
    super(cleanMessage);
    this.status = status;
    this.data = data;
    this.name = 'ApiError';
  }
}

class ApiClient {
  private getHeaders(customHeaders: HeadersInit = {}): Headers {
    const headers = new Headers(customHeaders);
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const token = localStorage.getItem('secureflow_access_token');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const activeOrgId = localStorage.getItem('secureflow_active_org_id');
    if (activeOrgId) {
      headers.set('X-Organization-Id', activeOrgId);
    }

    return headers;
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers = this.getHeaders(options.headers || {});

    const config: RequestInit = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);

      if (response.status === 401) {
        // If 401 and not already on auth page, clear token
        if (!window.location.pathname.startsWith('/auth')) {
          localStorage.removeItem('secureflow_access_token');
        }
      }

      if (!response.ok) {
        let errorData: any;
        try {
          errorData = await response.json();
        } catch {
          errorData = { detail: response.statusText };
        }

        const normalizedMessage = normalizeApiError(
          { status: response.status, data: errorData },
          getStatusFallbackMessage(response.status)
        );

        throw new ApiError(response.status, normalizedMessage, errorData);
      }

      if (response.status === 204) {
        return {} as T;
      }

      return await response.json();
    } catch (err: any) {
      if (err instanceof ApiError) {
        throw err;
      }
      const normalized = normalizeApiError(
        err,
        'Unable to connect to SecureFlow. Check that the service is running.'
      );
      throw new ApiError(0, normalized, err);
    }
  }

  get<T>(endpoint: string, headers?: HeadersInit): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', headers });
  }

  post<T>(endpoint: string, body?: any, headers?: HeadersInit): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers,
    });
  }

  put<T>(endpoint: string, body?: any, headers?: HeadersInit): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers,
    });
  }

  delete<T>(endpoint: string, headers?: HeadersInit): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE', headers });
  }
}

export const api = new ApiClient();
export * from './error';
