import { describe, it, expect } from 'vitest';
import {
  normalizeApiError,
  formatPydanticErrors,
  getStatusFallbackMessage,
} from '@/lib/api/error';
import { ApiError } from '@/lib/api/client';

describe('SecureFlow Error Normalization Suite', () => {
  it('never outputs [object Object] when passed raw object or array', () => {
    const rawObj = { status: 400, data: { detail: { code: 'INVALID', custom: 123 } } };
    const result = normalizeApiError(rawObj);
    expect(result).not.toContain('[object Object]');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('correctly extracts string detail from FastAPI error response', () => {
    const apiError = new ApiError(400, 'Current password verification failed', {
      detail: 'Current password verification failed',
    });
    expect(normalizeApiError(apiError)).toBe('Current password verification failed');
  });

  it('correctly formats FastAPI/Pydantic 422 validation error arrays', () => {
    const pydanticErrors = [
      {
        type: 'string_too_short',
        loc: ['body', 'new_password'],
        msg: 'String should have at least 8 characters',
        input: 'short',
        ctx: { min_length: 8 },
      },
      {
        type: 'value_error',
        loc: ['body', 'full_name'],
        msg: 'Full name cannot be blank',
        input: '',
      },
    ];

    const formatted = formatPydanticErrors(pydanticErrors);
    expect(formatted).toContain('New Password: String should have at least 8 characters');
    expect(formatted).toContain('Full Name: Full name cannot be blank');
    expect(formatted).not.toContain('[object Object]');

    const normalized = normalizeApiError({
      status: 422,
      data: { detail: pydanticErrors },
    });
    expect(normalized).toBe(formatted);
  });

  it('handles HTTP status codes with meaningful fallback messages', () => {
    expect(getStatusFallbackMessage(400)).toBe('Invalid request parameters. Please verify your input.');
    expect(getStatusFallbackMessage(401)).toBe('Your session has expired. Please sign in again.');
    expect(getStatusFallbackMessage(403)).toBe('You do not have permission to perform this action.');
    expect(getStatusFallbackMessage(404)).toBe('The requested resource was not found.');
    expect(getStatusFallbackMessage(409)).toBe('A resource conflict occurred. Please refresh and try again.');
    expect(getStatusFallbackMessage(422)).toBe('Please check the highlighted form fields.');
    expect(getStatusFallbackMessage(429)).toBe('Rate limit exceeded. Please wait a moment before trying again.');
    expect(getStatusFallbackMessage(500)).toBe('Something went wrong on the server. Please try again.');
  });

  it('normalizes network and connection failure errors', () => {
    const fetchError = new TypeError('Failed to fetch');
    expect(normalizeApiError(fetchError)).toBe(
      'Unable to connect to SecureFlow. Check that the service is running.'
    );

    const connRefused = new Error('connect ECONNREFUSED 127.0.0.1:8000');
    expect(normalizeApiError(connRefused)).toBe(
      'Unable to connect to SecureFlow. Check that the service is running.'
    );
  });

  it('sanitizes internal stack traces, database details, and secret tokens', () => {
    const dbError = new Error(
      'Traceback (most recent call last): sqlalchemy.exc.OperationalError: no such table: users'
    );
    const sanitized = normalizeApiError(dbError);
    expect(sanitized).toBe(
      'A database error occurred while processing your request. Please try again.'
    );
    expect(sanitized).not.toContain('sqlalchemy');
    expect(sanitized).not.toContain('Traceback');

    const tokenLeakError = new Error('Invalid signature for Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(normalizeApiError(tokenLeakError)).toBe('Authentication error. Please sign in again.');
  });

  it('provides safe fallback for null, undefined, and empty errors', () => {
    expect(normalizeApiError(null)).toBe('Something went wrong. Please try again.');
    expect(normalizeApiError(undefined)).toBe('Something went wrong. Please try again.');
    expect(normalizeApiError('')).toBe('Something went wrong. Please try again.');
  });
});
