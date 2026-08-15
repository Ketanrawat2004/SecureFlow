import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Lock, Shield } from 'lucide-react';
import { z } from 'zod';
import { api, normalizeApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/forms/Input';
import { useAuth } from '@/features/auth/AuthContext';

const signUpSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  organizationName: z.string().min(2, 'Workspace name must be at least 2 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type SignUpFormValues = z.infer<typeof signUpSchema>;

export const SignUpPage: React.FC = () => {
  const navigate = useNavigate();
  const { register: registerAuth } = useAuth();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      fullName: '',
      email: '',
      organizationName: '',
      password: '',
    },
  });

  const onSubmit = async (values: SignUpFormValues) => {
    setErrorMsg(null);
    try {
      await registerAuth(
        values.email,
        values.password,
        values.fullName,
        values.organizationName
      );
      navigate('/');
    } catch (err: any) {
      setErrorMsg(normalizeApiError(err, 'Registration failed. Please check your information.'));
    }
  };

  const handleGoogleSignUp = async () => {
    setErrorMsg(null);
    setIsGoogleLoading(true);
    try {
      const res = await api.get<{ url: string; client_id: string }>('/auth/google/url');
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

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm text-center">
        <div className="w-8 h-8 rounded bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400 mx-auto mb-3">
          <Lock className="w-4 h-4" />
        </div>
        <h1 className="text-lg font-semibold tracking-tight text-surface-100">
          Create SecureFlow Workspace
        </h1>
        <p className="mt-0.5 text-xs text-surface-400">
          Enterprise access management and workflow governance
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
            onClick={handleGoogleSignUp}
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
            Sign up with Google (SSO)
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
              label="Full Name"
              placeholder="Sarah Chen"
              error={errors.fullName?.message}
              {...register('fullName')}
            />

            <Input
              label="Work Email"
              type="email"
              placeholder="name@company.io"
              error={errors.email?.message}
              {...register('email')}
            />

            <Input
              label="Workspace Name"
              placeholder="Acme Engineering"
              error={errors.organizationName?.message}
              {...register('organizationName')}
            />

            <Input
              label="Password (min 8 characters)"
              type="password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />

            <Button type="submit" variant="primary" className="w-full" isLoading={isSubmitting}>
              Create Workspace & Start
            </Button>
          </form>

          <div className="text-center text-[11px] text-surface-400 pt-1">
            Already have an account?{' '}
            <Link to="/auth/signin" className="text-brand-400 hover:text-brand-300 font-medium">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
