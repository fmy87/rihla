import AsyncStorage from '@react-native-async-storage/async-storage';

const mockInsert = jest.fn();

jest.mock('../../supabaseClient', () => ({
  supabase: {
    from: jest.fn(() => ({ insert: mockInsert })),
  },
}));

import { enqueuePoint, queueLength, flushQueue, type QueuedPoint } from '../gpsQueue';

const samplePoint: QueuedPoint = {
  daily_route_id: 'route-1',
  bus_id: 'bus-1',
  driver_id: 'driver-1',
  latitude: 23.588,
  longitude: 58.3829,
  speed_kmh: 20,
  accuracy_meters: 5,
  recorded_at: new Date().toISOString(),
};

beforeEach(async () => {
  await AsyncStorage.clear();
  mockInsert.mockReset();
});

describe('gpsQueue', () => {
  it('starts empty', async () => {
    expect(await queueLength()).toBe(0);
  });

  it('enqueue writes the point locally before any network call happens', async () => {
    await enqueuePoint(samplePoint);
    expect(await queueLength()).toBe(1);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('flush clears the queue on success', async () => {
    await enqueuePoint(samplePoint);
    mockInsert.mockResolvedValueOnce({ error: null });

    const result = await flushQueue();

    expect(result).toEqual({ synced: 1, remaining: 0, succeeded: true });
    expect(await queueLength()).toBe(0);
  });

  it('flush leaves the queue intact on failure — no data loss offline', async () => {
    await enqueuePoint(samplePoint);
    mockInsert.mockResolvedValueOnce({ error: { message: 'network error' } });

    const result = await flushQueue();

    expect(result.succeeded).toBe(false);
    expect(result.remaining).toBe(1);
    expect(await queueLength()).toBe(1); // still there for the next attempt
  });

  it('flushing an empty queue is a no-op that reports success', async () => {
    const result = await flushQueue();
    expect(result).toEqual({ synced: 0, remaining: 0, succeeded: true });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('flags points captured well before the sync attempt as offline backfill', async () => {
    const staleTimestamp = new Date(Date.now() - 5 * 60_000).toISOString(); // 5 min ago
    await enqueuePoint({ ...samplePoint, recorded_at: staleTimestamp });
    mockInsert.mockResolvedValueOnce({ error: null });

    await flushQueue();

    const insertedRows = mockInsert.mock.calls[0][0];
    expect(insertedRows[0].is_offline_backfill).toBe(true);
  });
});
