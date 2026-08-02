import type { SNSEvent, SNSEventRecord } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handler } from './handler';

const initConfigMock = vi.hoisted(() => vi.fn());
const processMock = vi.hoisted(() => vi.fn());
const retryMock = vi.hoisted(() =>
  vi.fn(async (fn: () => Promise<void>, _retries: number, _shouldRetry: () => boolean) => {
    await fn();
  }),
);

vi.mock('../../config/config', () => ({ initConfig: initConfigMock }));
vi.mock('./processor', () => ({ process: processMock }));
vi.mock('../../../../../third-party/common/ts/runtime/retry', () => ({ retry: retryMock }));

const makeSnsEvent = (...records: unknown[]): SNSEvent => ({
  Records: records.map(
    (x) =>
      ({
        Sns: { Message: JSON.stringify(x) },
      }) as SNSEventRecord,
  ),
});

describe('handler (SNS)', () => {
  beforeEach(() => {
    initConfigMock.mockReset();
    processMock.mockReset();
    retryMock.mockReset();

    // Default: retry executes the function once
    retryMock.mockImplementation(async (fn: () => Promise<void>, _retries: number, _shouldRetry: () => boolean) => {
      await fn();
    });

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  it('initializes config and processes each SNS record via retry', async () => {
    const event = makeSnsEvent({ myAnimeListId: 1, dub: 'dub' }, { myAnimeListId: 2, dub: 'sub' });

    await handler(event);

    expect(initConfigMock).toHaveBeenCalledTimes(1);

    expect(retryMock).toHaveBeenCalledTimes(2);
    for (const call of retryMock.mock.calls) {
      const retriesArg = call[1];
      expect(retriesArg).toBe(3);
      expect(typeof call[2]).toBe('function');
      expect(call[2]()).toBe(true);
    }

    expect(processMock).toHaveBeenCalledTimes(2);
    expect(processMock).toHaveBeenNthCalledWith(1, {
      myAnimeListId: 1,
      dub: 'dub',
    });
    expect(processMock).toHaveBeenNthCalledWith(2, {
      myAnimeListId: 2,
      dub: 'sub',
    });
  });

  it('propagates initConfig errors and does not process records', async () => {
    initConfigMock.mockRejectedValueOnce(new Error('config down'));

    const event = makeSnsEvent([]);

    await expect(handler(event)).rejects.toThrow('config down');

    expect(retryMock).not.toHaveBeenCalled();
    expect(processMock).not.toHaveBeenCalled();
  });

  it('propagates retry errors (and stops at the failing record)', async () => {
    retryMock.mockRejectedValueOnce(new Error('retry failed'));

    const event = makeSnsEvent({ x: 1 }, { x: 2 });

    await expect(handler(event)).rejects.toThrow('retry failed');

    expect(retryMock).toHaveBeenCalledTimes(1);
    expect(processMock).not.toHaveBeenCalled();
  });

  it('propagates JSON parse / processor errors via retry execution', async () => {
    processMock.mockRejectedValueOnce(new Error('processor down'));

    const event = makeSnsEvent({ myAnimeListId: 3, dub: 'dub' });

    await expect(handler(event)).rejects.toThrow('processor down');

    expect(retryMock).toHaveBeenCalledTimes(1);
    expect(processMock).toHaveBeenCalledTimes(1);
  });
});
