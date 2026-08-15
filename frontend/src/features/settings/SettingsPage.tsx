import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Check,
  Copy,
  Key,
  Save,
  Shield,
  User,
  Users,
} from 'lucide-react';
import { z } from 'zod';
import { api, normalizeApiError } from '@/lib/api/client';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { Input } from '@/components/forms/Input';
import { Textarea } from '@/components/forms/Textarea';
import { useAuth } from '@/features/auth/AuthContext';
import { useAppStore } from '@/stores/useAppStore';
import { Organization } from '@/types';

const profileSchema = z
  .object({
    full_name: z.string().min(2, 'Full name must be at least 2 characters'),
    current_password: z.string().optional(),
    new_password: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.new_password && data.new_password.trim().length > 0) {
        return data.new_password.length >= 8;
      }
      return true;
    },
    {
      message: 'New password must be at least 8 characters',
      path: ['new_password'],
    }
  )
  .refine(
    (data) => {
      if (data.new_password && data.new_password.trim().length > 0) {
        return !!data.current_password && data.current_password.length > 0;
      }
      return true;
    },
    {
      message: 'Current password is required to change password',
      path: ['current_password'],
    }
  );

type ProfileFormValues = z.infer<typeof profileSchema>;

export const SettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { activeOrgId } = useAppStore();

  const [activeTab, setActiveTab] = useState('profile');
  const [copiedKey, setCopiedKey] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Fetch Organization Details
  const { data: organization } = useQuery<Organization>({
    queryKey: ['organization', 'current', activeOrgId],
    queryFn: () => api.get<Organization>('/organizations/current'),
  });

  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    reset: resetProfileForm,
    formState: { errors: profileErrors, isSubmitting: isProfileSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    values: {
      full_name: user?.full_name || '',
      current_password: '',
      new_password: '',
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: (payload: { full_name?: string; current_password?: string; new_password?: string }) =>
      api.put('/users/me', payload),
    onSuccess: () => {
      setProfileSuccess('Profile updated successfully.');
      setProfileError(null);
      resetProfileForm({
        full_name: user?.full_name || '',
        current_password: '',
        new_password: '',
      });
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
    onError: (err: any) => {
      setProfileError(normalizeApiError(err, 'Failed to update profile. Please try again.'));
      setProfileSuccess(null);
    },
  });

  const onProfileSubmit = (values: ProfileFormValues) => {
    setProfileSuccess(null);
    setProfileError(null);

    const payload: { full_name?: string; current_password?: string; new_password?: string } = {
      full_name: values.full_name.trim(),
    };

    if (values.new_password && values.new_password.trim().length > 0) {
      payload.new_password = values.new_password;
      payload.current_password = values.current_password;
    }

    updateProfileMutation.mutate(payload);
  };

  const handleCopyApiKey = () => {
    navigator.clipboard.writeText('sf_live_99f2b804c816e25b902187bda90237fa');
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const settingsTabs = [
    { id: 'profile', label: 'My Profile', icon: <User className="w-3.5 h-3.5" /> },
    { id: 'workspace', label: 'Workspace Details', icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'security', label: 'Security & Auth', icon: <Shield className="w-3.5 h-3.5" /> },
    { id: 'apikeys', label: 'API Keys', icon: <Key className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="pb-3 border-b border-surface-750">
        <div className="flex items-center gap-2">
          <h1 className="text-base sm:text-lg font-semibold tracking-tight text-surface-100">
            Account & Workspace Settings
          </h1>
        </div>
        <p className="text-xs text-surface-400 mt-0.5">
          Manage credentials, workspace governance policies, and automation tokens
        </p>
      </div>

      {/* Tabs */}
      <Tabs tabs={settingsTabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab 1: Profile */}
      {activeTab === 'profile' && (
        <div className="bg-surface-900 border border-surface-750 rounded-md p-4 max-w-xl space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-surface-100 uppercase font-mono tracking-wider">
              Profile & Authentication
            </h3>
            <p className="text-[11px] text-surface-400 mt-0.5">
              Account identity and credentials
            </p>
          </div>

          {profileSuccess && (
            <div className="p-2.5 rounded bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>{profileSuccess}</span>
            </div>
          )}

          {profileError && (
            <div className="p-2.5 rounded bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 shrink-0" />
              <span>{profileError}</span>
            </div>
          )}

          <form onSubmit={handleProfileSubmit(onProfileSubmit)} className="space-y-3">
            <Input
              label="Work Email"
              value={user?.email || ''}
              disabled
              helperText="Managed by workspace identity provider."
            />

            <Input
              label="Full Name"
              required
              error={profileErrors.full_name?.message}
              {...registerProfile('full_name')}
            />

            <div className="pt-2 border-t border-surface-750 space-y-2.5">
              <h4 className="text-xs font-medium text-surface-200">Change Password</h4>

              <Input
                label="Current Password"
                type="password"
                placeholder="••••••••"
                error={profileErrors.current_password?.message}
                {...registerProfile('current_password')}
              />

              <Input
                label="New Password (min 8 characters)"
                type="password"
                placeholder="••••••••"
                error={profileErrors.new_password?.message}
                {...registerProfile('new_password')}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="sm"
              leftIcon={<Save className="w-3.5 h-3.5" />}
              isLoading={isProfileSubmitting}
            >
              Save Changes
            </Button>
          </form>
        </div>
      )}

      {/* Tab 2: Workspace */}
      {activeTab === 'workspace' && (
        <div className="bg-surface-900 border border-surface-750 rounded-md p-4 max-w-xl space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-surface-100 uppercase font-mono tracking-wider">
              Workspace Metadata
            </h3>
            <p className="text-[11px] text-surface-400 mt-0.5">
              Organization name and unique namespace
            </p>
          </div>

          <div className="space-y-3">
            <Input
              label="Organization Name"
              value={organization?.name || 'Acme Cloud Infrastructure'}
              disabled
            />

            <Input
              label="Organization Slug"
              value={organization?.slug || 'acme-cloud'}
              disabled
            />

            <Textarea
              label="Workspace Scope Description"
              value={organization?.description || 'Core engineering and distributed platforms platform.'}
              disabled
            />

            <div className="p-2.5 rounded bg-surface-950 border border-surface-750 text-[11px] text-surface-400">
              Only workspace <span className="font-semibold text-brand-400">Owner</span> can modify namespace slugs or billing parameters.
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Security */}
      {activeTab === 'security' && (
        <div className="bg-surface-900 border border-surface-750 rounded-md p-4 max-w-xl space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-surface-100 uppercase font-mono tracking-wider">
              Security Baseline & Controls
            </h3>
            <p className="text-[11px] text-surface-400 mt-0.5">
              Federated identity, token lifecycle, and rate limits
            </p>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="p-3 rounded bg-surface-950 border border-surface-750 flex items-center justify-between">
              <div>
                <span className="font-medium text-surface-200 block text-xs">Google Single Sign-On (OIDC)</span>
                <span className="text-surface-400 block text-[11px] mt-0.5">
                  OAuth 2.0 PKCE with cryptographic JWT rotation
                </span>
              </div>
              <Badge variant="success" size="xs" dot>ENABLED</Badge>
            </div>

            <div className="p-3 rounded bg-surface-950 border border-surface-750 flex items-center justify-between">
              <div>
                <span className="font-medium text-surface-200 block text-xs">Server-Side RBAC Enforcer</span>
                <span className="text-surface-400 block text-[11px] mt-0.5">
                  Strict permission checks across all API gates
                </span>
              </div>
              <Badge variant="purple" size="xs">ACTIVE</Badge>
            </div>

            <div className="p-3 rounded bg-surface-950 border border-surface-750 flex items-center justify-between">
              <div>
                <span className="font-medium text-surface-200 block text-xs">Redis Sliding Window Rate Limiting</span>
                <span className="text-surface-400 block text-[11px] mt-0.5">
                  120 requests/minute per client IP
                </span>
              </div>
              <Badge variant="info" size="xs">120 RPM</Badge>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: API Keys */}
      {activeTab === 'apikeys' && (
        <div className="bg-surface-900 border border-surface-750 rounded-md p-4 max-w-xl space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-surface-100 uppercase font-mono tracking-wider">
              Automation API Tokens
            </h3>
            <p className="text-[11px] text-surface-400 mt-0.5">
              API keys for CI/CD pipelines, Terraform providers, and GitHub Actions
            </p>
          </div>

          <div className="space-y-2.5">
            <div className="p-3 rounded bg-surface-950 border border-surface-750 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-surface-200">Production Deploy Token</span>
                <Badge variant="success" size="xs">ACTIVE</Badge>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="password"
                  value="sf_live_99f2b804c816e25b902187bda90237fa"
                  readOnly
                  className="flex-1 bg-surface-900 border border-surface-700 rounded px-2.5 h-8 font-mono text-xs text-brand-300 select-all"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  onClick={handleCopyApiKey}
                >
                  {copiedKey ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
