// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Modal from '../Modal';

describe('Modal', () => {
  it('renders the title and children', () => {
    render(
      <Modal title="Edit Student" onClose={() => {}}>
        <p>Form goes here</p>
      </Modal>
    );
    expect(screen.getByText('Edit Student')).toBeInTheDocument();
    expect(screen.getByText('Form goes here')).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <Modal title="Edit Student" onClose={onClose}>
        <p>Form goes here</p>
      </Modal>
    );
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose just from rendering or clicking inside the modal body', () => {
    const onClose = vi.fn();
    render(
      <Modal title="Edit Student" onClose={onClose}>
        <button>Save</button>
      </Modal>
    );
    fireEvent.click(screen.getByText('Save'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
