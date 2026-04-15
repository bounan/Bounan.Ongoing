import { beforeEach, describe, expect, it, vi } from 'vitest';

import { checkIfCompleted } from './is-completed';

const getAnimeByIdMock = vi.hoisted(() => vi.fn());
const useRateLimitMock = vi.hoisted(() => vi.fn((fn: unknown) => fn));

vi.mock('@lightweight-clients/jikan-api-lightweight-client', () => ({ getAnimeById: getAnimeByIdMock }));
vi.mock('./rate-limit', () => ({ useRateLimit: useRateLimitMock }));
vi.mock('../../config/config', () => ({
  config: {
    value: {
      processing: {
        outdatedPeriodHours: 24,
      },
    },
  },
}));

describe('checkIfCompleted', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-24T12:00:00.000Z'));

    getAnimeByIdMock.mockReset();
    useRateLimitMock.mockClear();

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('returns true when the anime is outdated (and does not call the API)', async () => {
    const lastUpdate = new Date('2026-01-20T12:00:00.000Z'); // older than 24h threshold
    const result = await checkIfCompleted(123, lastUpdate, new Set([1, 2, 3]));

    expect(result).toBe(true);
    expect(getAnimeByIdMock).not.toHaveBeenCalled();
  });

  it('returns false when expected last episode is missing/0/null (movie/special/unknown) and warns', async () => {
    getAnimeByIdMock.mockResolvedValueOnce({ data: { episodes: undefined } });

    const lastUpdate = new Date('2026-01-24T11:00:00.000Z'); // not outdated
    const result = await checkIfCompleted(123, lastUpdate, new Set([1, 2]));

    expect(result).toBe(false);
    expect(getAnimeByIdMock).toHaveBeenCalledWith(123);
    expect(console.warn).toHaveBeenCalled();
  });

  it('returns true when observed last episode meets/exceeds expected last episode', async () => {
    getAnimeByIdMock.mockResolvedValueOnce({ data: { episodes: 12 } });

    const lastUpdate = new Date('2026-01-24T11:00:00.000Z');
    const result = await checkIfCompleted(123, lastUpdate, new Set([1, 2, 10, 12]));

    expect(result).toBe(true);
  });

  it('returns true for the single-episode/movie special case: expected=1 and observed=0', async () => {
    getAnimeByIdMock.mockResolvedValueOnce({ data: { episodes: 1 } });

    const lastUpdate = new Date('2026-01-24T11:00:00.000Z');
    const result = await checkIfCompleted(123, lastUpdate, new Set([0]));

    expect(result).toBe(true);
  });

  it('returns false when expected last episode is greater than observed last episode', async () => {
    getAnimeByIdMock.mockResolvedValueOnce({ data: { episodes: 24 } });

    const lastUpdate = new Date('2026-01-24T11:00:00.000Z');
    const result = await checkIfCompleted(123, lastUpdate, new Set([1, 2, 3, 10]));

    expect(result).toBe(false);
  });

  it('treats anime uncompleted when the API call fails and warns', async () => {
    getAnimeByIdMock.mockRejectedValueOnce(new Error('API error'));

    const lastUpdate = new Date('2026-01-24T11:00:00.000Z');
    const result = await checkIfCompleted(123, lastUpdate, new Set([1, 2, 3]));

    expect(result).toBe(false);
    expect(console.warn).toHaveBeenCalled();
  });
});
