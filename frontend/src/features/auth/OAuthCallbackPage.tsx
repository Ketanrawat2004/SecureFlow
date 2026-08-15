import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import { api } from '@/lib/api/client';
import { Button } from '@/components/ui/Button';
import { TokenResponse } from '@/types';

export const OAuthCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code) {
      setError('Missing authorization code from Google OAuth response');
      return;
    }

    const exchangeCode = async () => {
      try {
        const redirectUri = `${window.location.origin}/auth/callback`;
        const res = await api.post<TokenResponse>('/auth/google/callback', {
          code,
          state: state || undefined,
          redirect_uri: redirectUri,
        });
        localStorage.setItem('secureflow_access_token', res.access_token);
        navigate('/', { replace: true });
        window.location.reload();
      } catch (err: any) {
        setError(err.message || 'Failed to complete Google Single Sign-On');
      }
    };

    exchangeCode();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col items-center justify-center p-4">
      <div className="bg-surface-900 border border-surface-800 p-8 rounded-2xl max-w-md w-full text-center shadow-card space-y-4">
        {error ? (
          <>
            <div className="w-12 h-12 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h2 className="text-base font-semibold text-surface-100">SSO Authentication Failed</h2>
            <p className="text-xs text-rose-300">{error}</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/auth/signin')}
              className="mt-4"
            >
              Return to Sign In
            </Button>
          </>
        ) : (
          <>
            <Loader2 className="w-8 h-8 text-brand-400 animate-spin mx-auto" />
            <h2 className="text-base font-semibold text-surface-100">
              Verifying Google Single Sign-On...
            </h2>
            <p className="text-xs text-surface-400">
              Authenticating credentials and establishing secure session
            </p>
          </>
        )}
      </div>
    </div>
  );
};
