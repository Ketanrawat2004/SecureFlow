import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Shield, ArrowRight, Sun, Moon } from 'lucide-react';
import { z } from 'zod';
import { api, normalizeApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/forms/Input';
import { useAuth } from '@/features/auth/AuthContext';
import { useAppStore } from '@/stores/useAppStore';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export const SignInPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, devLogin } = useAuth();
  const { theme, toggleTheme } = useAppStore();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'sarah.chen@acmecloud.io',
      password: 'SecureFlow2026!',
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setErrorMsg(null);
    try {
      await login(values.email, values.password);
      navigate('/');
    } catch (err: any) {
      setErrorMsg(normalizeApiError(err, 'Authentication failed. Please check your credentials.'));
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setIsGoogleLoading(true);
    try {
      const redirectUri = `${window.location.origin}/auth/callback`;
      const res = await api.get<{ url: string; client_id: string }>(
        `/auth/google/url?redirect_uri=${encodeURIComponent(redirectUri)}`
      );
      if (res.client_id.startsWith('mock-')) {
        navigate('/auth/callback?code=mock_google_auth_code_dev');
      } else {
        window.location.href = res.url;
      }
    } catch (err: any) {
      setErrorMsg(normalizeApiError(err, 'Failed to initiate Google SSO.'));
      setIsGoogleLoading(false);
    }
  };

  const handleDevQuickLogin = async (role: string, email: string) => {
    try {
      await devLogin(role, email);
      navigate('/');
    } catch (err: any) {
      setErrorMsg(normalizeApiError(err, 'Demo login failed.'));
    }
  };

  const devDemoProfiles = [
    { role: 'Owner', name: 'Sarah Chen', email: 'sarah.chen@acmecloud.io', desc: 'Full governance & security admin' },
    { role: 'Admin', name: 'Alex Rivera', email: 'alex.rivera@acmecloud.io', desc: 'Authorizes pipelines & invites members' },
    { role: 'Developer', name: 'Elena Rostova', email: 'elena.rostova@acmecloud.io', desc: 'Authors projects & change requests' },
    { role: 'Auditor', name: 'David Kim', email: 'david.kim@acmecloud.io', desc: 'Compliance & audit log review' },
    { role: 'Viewer', name: 'Maya Patel', email: 'maya.patel@acmecloud.io', desc: 'Read-only visibility' },
  ];

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8 relative">
      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          title={`Current theme: ${theme}. Click to switch to ${theme === 'light' ? 'dark' : 'light'} mode.`}
          className="px-2.5 py-1.5 rounded-md bg-surface-900 border border-surface-700 text-surface-300 hover:text-surface-100 hover:bg-surface-800 transition-colors shadow-subtle flex items-center gap-1.5 text-xs font-medium"
        >
          {theme === 'light' ? (
            <>
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[11px] font-medium text-surface-200">Light</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-brand-400" />
              <span className="text-[11px] font-medium text-surface-200">Dark</span>
            </>
          )}
        </button>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-sm text-center">
        <div className="inline-flex items-center justify-center gap-2.5 mb-3">
          <img
            src="/logo.png"
            alt="SecureFlow Shield"
            className="h-10 w-auto object-contain rounded drop-shadow-sm transition-transform hover:scale-105"
          />
          <div className="text-left">
            <span className="text-xl font-bold tracking-tight text-surface-100 block leading-none">
              SECURE<span className="text-brand-500">FLOW</span>
            </span>
            <span className="text-[9px] font-mono text-surface-400 uppercase tracking-widest block mt-1">
              ACCESS GOVERNANCE
            </span>
          </div>
        </div>
        <h1 className="text-base font-semibold tracking-tight text-surface-100">
          Sign in to SecureFlow
        </h1>
        <p className="mt-0.5 text-xs text-surface-400">
          Engineering access governance & workflow authorization
        </p>
      </div>

      <div className="mt-5 sm:mx-auto sm:w-full sm:max-w-sm">
        <div className="bg-surface-900 border border-surface-750 p-5 rounded-md shadow-card space-y-4">
          {errorMsg && (
            <div className="p-2.5 rounded bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Google SSO Button */}
          <Button
            type="button"
            variant="secondary"
            className="w-full justify-center gap-2 font-medium"
            onClick={handleGoogleSignIn}
            isLoading={isGoogleLoading}
            leftIcon={
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
            }
          >
            Continue with Google (SSO)
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-surface-750" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-wider">
              <span className="bg-surface-900 px-2 text-surface-500">
                Or with credentials
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <Input
              label="Work Email"
              type="email"
              placeholder="name@company.io"
              autoComplete="email"
              error={errors.email?.message}
              {...register('email')}
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register('password')}
            />

            <Button type="submit" variant="primary" className="w-full" isLoading={isSubmitting}>
              Sign In with Email
            </Button>
          </form>

          {/* Dev Quick Role Login */}
          <div className="pt-2 border-t border-surface-750">
            <div className="text-[10px] font-mono uppercase text-surface-500 mb-2 tracking-wider">
              Test Role Personas:
            </div>

            <div className="space-y-1">
              {devDemoProfiles.map((p) => (
                <button
                  key={p.role}
                  type="button"
                  onClick={() => handleDevQuickLogin(p.role, p.email)}
                  className="w-full flex items-center justify-between p-1.5 rounded bg-surface-950/60 border border-surface-750/70 hover:border-surface-600 hover:bg-surface-850 transition-colors text-left group"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[9px] bg-surface-800 text-brand-400 px-1 py-0.2 rounded font-bold">
                      {p.role}
                    </span>
                    <span className="text-[11px] text-surface-200 group-hover:text-brand-300">
                      {p.name}
                    </span>
                  </div>
                  <ArrowRight className="w-3 h-3 text-surface-500 group-hover:text-brand-400 transition-transform" />
                </button>
              ))}
            </div>
          </div>

          <div className="text-center text-[11px] text-surface-400 pt-1">
            New organization?{' '}
            <Link to="/auth/signup" className="text-brand-400 hover:text-brand-300 font-medium">
              Create workspace
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
