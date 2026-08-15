import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from '@/components/ui/Modal';

describe('Modal Component', () => {
  it('does not render when isOpen is false', () => {
    render(
      <Modal isOpen={false} onClose={() => {}} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    );
    expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
  });

  it('renders title and content when isOpen is true', () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Create Workflow">
        <div>Form Fields</div>
      </Modal>
    );
    expect(screen.getByText('Create Workflow')).toBeInTheDocument();
    expect(screen.getByText('Form Fields')).toBeInTheDocument();
  });

  it('calls onClose when clicking close button', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose} title="Review Modal">
        <div>Details</div>
      </Modal>
    );
    fireEvent.click(screen.getByLabelText(/close modal/i));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
