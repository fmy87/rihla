import AsyncStorage from '@react-native-async-storage/async-storage';

const mockConfirmEvent = jest.fn();
const mockMarkNotConfirmed = jest.fn();
const mockMarkStopArrivedIfResolved = jest.fn();

jest.mock('../../queries/pickup', () => ({
  confirmEvent: (...args: unknown[]) => mockConfirmEvent(...args),
  markNotConfirmed: (...args: unknown[]) => mockMarkNotConfirmed(...args),
  markStopArrivedIfResolved: (...args: unknown[]) => mockMarkStopArrivedIfResolved(...args),
}));

import {
  enqueueConfirmEvent,
  enqueueNotConfirmed,
  pendingAssignmentIds,
  actionQueueLength,
  flushActionQueue,
} from '../actionQueue';

beforeEach(async () => {
  await AsyncStorage.clear();
  mockConfirmEvent.mockReset();
  mockMarkNotConfirmed.mockReset();
  mockMarkStopArrivedIfResolved.mockReset();
});

describe('actionQueue', () => {
  it('starts empty', async () => {
    expect(await actionQueueLength()).toBe(0);
  });

  it('enqueue is local-only — nothing hits the network until flush', async () => {
    await enqueueConfirmEvent('assign-1', 'driver-1', 'pickup', 'stop-1');
    expect(await actionQueueLength()).toBe(1);
    expect(mockConfirmEvent).not.toHaveBeenCalled();
  });

  it('pendingAssignmentIds reflects queued-but-unsynced assignments', async () => {
    await enqueueConfirmEvent('assign-1', 'driver-1', 'pickup', 'stop-1');
    await enqueueNotConfirmed('assign-2', 'student_absent', 'stop-1');
    const pending = await pendingAssignmentIds();
    expect(pending.has('assign-1')).toBe(true);
    expect(pending.has('assign-2')).toBe(true);
    expect(pending.has('assign-3')).toBe(false);
  });

  it('flush replays queued actions and clears the queue on full success', async () => {
    await enqueueConfirmEvent('assign-1', 'driver-1', 'pickup', 'stop-1');
    await enqueueNotConfirmed('assign-2', 'student_absent', 'stop-1');
    mockConfirmEvent.mockResolvedValue({ error: null });
    mockMarkNotConfirmed.mockResolvedValue({ error: null });

    const result = await flushActionQueue();

    expect(result).toEqual({ synced: 2, remaining: 0 });
    expect(await actionQueueLength()).toBe(0);
    expect(mockMarkStopArrivedIfResolved).toHaveBeenCalledWith('stop-1');
  });

  it('stops at the first failure and preserves order — never drops or reorders an action', async () => {
    await enqueueConfirmEvent('assign-1', 'driver-1', 'pickup', 'stop-1');
    await enqueueConfirmEvent('assign-2', 'driver-1', 'pickup', 'stop-1');
    mockConfirmEvent
      .mockResolvedValueOnce({ error: null }) // assign-1 succeeds
      .mockResolvedValueOnce({ error: 'network error' }); // assign-2 fails

    const result = await flushActionQueue();

    expect(result.synced).toBe(1);
    expect(result.remaining).toBe(1);
    const pending = await pendingAssignmentIds();
    expect(pending.has('assign-1')).toBe(false); // synced, no longer pending
    expect(pending.has('assign-2')).toBe(true); // still queued for retry
  });

  it('a subsequent flush retries only the remaining actions, in the same order', async () => {
    await enqueueConfirmEvent('assign-1', 'driver-1', 'pickup', 'stop-1');
    mockConfirmEvent.mockResolvedValueOnce({ error: 'network error' });
    await flushActionQueue();
    expect(await actionQueueLength()).toBe(1);

    mockConfirmEvent.mockResolvedValueOnce({ error: null });
    const secondResult = await flushActionQueue();

    expect(secondResult).toEqual({ synced: 1, remaining: 0 });
    expect(mockConfirmEvent).toHaveBeenCalledTimes(2);
  });
});
