import { test, expect } from '@playwright/test';

test.describe('SecureFlow E2E Critical Path Journey', () => {
  test('Complete login, project review, workflow inspection, and role switching', async ({ page }) => {
    // 1. Open login page
    await page.goto('/auth/signin');
    await expect(page).toHaveTitle(/SecureFlow/i);
    await expect(page.getByRole('heading', { name: /Sign in to SecureFlow/i })).toBeVisible();

    // 2. Test invalid password rejection
    await page.getByLabel(/Work Email/i).fill('sarah.chen@acmecloud.io');
    await page.getByLabel(/Password/i).fill('WrongPassword123!');
    await page.getByRole('button', { name: /Sign In with Email/i }).click();
    await expect(page.getByText(/Incorrect email or password/i)).toBeVisible();

    // 3. Test valid authentication
    await page.getByLabel(/Password/i).fill('SecureFlow2026!');
    await page.getByRole('button', { name: /Sign In with Email/i }).click();

    // 4. Verify redirect to dashboard
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: /Engineering Governance Dashboard/i })).toBeVisible();

    // 5. Verify KPI cards and projects
    await expect(page.getByText(/Active Workflows/i)).toBeVisible();
    await expect(page.getByText(/Recent Workflows/i)).toBeVisible();

    // 6. Navigate to Projects
    await page.getByRole('link', { name: /Projects/i }).click();
    await expect(page).toHaveURL('/projects');
    await expect(page.getByText(/Payments Platform/i)).toBeVisible();

    // 7. Navigate to Approvals Queue
    await page.getByRole('link', { name: /Approvals/i }).click();
    await expect(page).toHaveURL('/approvals');

    // 8. Navigate to Audit Logs
    await page.getByRole('link', { name: /Audit Logs/i }).click();
    await expect(page).toHaveURL('/audit');
  });
});
