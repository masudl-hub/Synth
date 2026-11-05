import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MicPanel } from './MicPanel.tsx';

describe('MicPanel', () => {
  afterEach(cleanup);

  it('asks for the microphone until it is live', () => {
    const onStart = vi.fn();
    render(<MicPanel isLive={false} onStart={onStart} onBack={vi.fn()} />);
    expect(screen.getByText('Allow the microphone to visualise the sound around you.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Allow microphone' }));
    expect(onStart).toHaveBeenCalled();
  });

  it('says it is listening once live, and the toggle goes back to the synth', () => {
    const onBack = vi.fn();
    render(<MicPanel isLive={true} onStart={vi.fn()} onBack={onBack} />);
    expect(screen.queryByRole('button', { name: 'Allow microphone' })).toBeNull();
    expect(screen.getByText('The visuals react to your environment.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Listening' }));
    expect(onBack).toHaveBeenCalled();
  });
});
