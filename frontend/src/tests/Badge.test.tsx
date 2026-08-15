import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '@/components/ui/Badge';

describe('Badge Component', () => {
  it('renders success badge with correct styles', () => {
    render(<Badge variant="success">Approved</Badge>);
    const badge = screen.getByText('Approved');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('text-emerald-300');
  });

  it('renders danger badge for critical risk', () => {
    render(<Badge variant="danger">Critical</Badge>);
    const badge = screen.getByText('Critical');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('text-rose-300');
  });

  it('renders dot indicator when enabled', () => {
    const { container } = render(<Badge variant="warning" dot>Pending</Badge>);
    const dot = container.querySelector('.rounded-full');
    expect(dot).toBeInTheDocument();
  });
});
