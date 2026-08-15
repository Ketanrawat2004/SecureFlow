import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/Button';

describe('Button Component', () => {
  it('renders children with default primary variant', () => {
    render(<Button>Submit Workflow</Button>);
    const button = screen.getByRole('button', { name: /Submit Workflow/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('bg-brand-500');
  });

  it('renders danger variant when specified', () => {
    render(<Button variant="danger">Reject</Button>);
    const button = screen.getByRole('button', { name: /Reject/i });
    expect(button).toHaveClass('bg-rose-600');
  });

  it('handles click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click Me</Button>);
    fireEvent.click(screen.getByRole('button', { name: /Click Me/i }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('disables button when isLoading is true', () => {
    render(<Button isLoading>Processing</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });
});
