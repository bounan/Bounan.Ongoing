import type { SNSEvent } from 'aws-lambda';
import { describe, expect, vi } from 'vitest';

import type { VideoKey } from '../../../../third-party/common/ts/interfaces';
import { handler } from '../../../app/src/handlers/on-video-registered/handler';
import { it } from '../../fixtures';
import { expectNoDbChanges, performCommonChecks } from '../../tools/custom-expectations';
import { makeSnsEvent } from '../../tools/payload-generators';

const DEFAULT_VIDEO_KEY = { myAnimeListId: 1, dub: 'a dub', episode: 1 } as const;

const makeOnVideoRegisteredEvent = (...items: VideoKey[]): SNSEvent => {
  return makeSnsEvent({ items: items.map(videoKey => ({ videoKey })) });
}

describe('on-video-registered', () => {
  it.aroundEach(async (runTest, { table }) => {
    await table.putRecords(
      {
        animeKey: '998#dub',
        myAnimeListId: 998,
        dub: 'dub',
        episodes: new Set([1, 2]),
        createdAt: '2025-02-01T00:00:00Z',
        updatedAt: '2025-02-08T00:00:00Z',
      },
      {
        animeKey: '999#initial-item',
        myAnimeListId: 999,
        dub: 'initial-item',
        episodes: new Set([1]),
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-08T00:00:00Z',
      },
    );
    const initialState = await table.getAllRecords();

    await runTest();
    await performCommonChecks(table);
    await expectNoDbChanges(initialState, table);
  })

  it('should do nothing when no videos are passed', async ({ table }) => {
    // Arrange
    const initialState = await table.getAllRecords();
    const event = makeOnVideoRegisteredEvent();

    // Act
    await handler(event);

    // Assert
    await expectNoDbChanges(initialState, table);
  });

  it('should do nothing when episode is registered', async ({ table }) => {
    // Arrange
    await handler(makeOnVideoRegisteredEvent(DEFAULT_VIDEO_KEY));
    const arrangedState = await table.getAllRecords();

    // Act
    await handler(makeOnVideoRegisteredEvent(DEFAULT_VIDEO_KEY));

    // Assert
    const finalState = await table.getAllRecords();
    expect(finalState[0].updatedAt).toBeDefined();
    expect(finalState).toEqual(arrangedState);
  });

  it('should add episode to existing anime', async ({ table }) => {
    // Arrange
    const initialState = await table.getAllRecords();
    await handler(makeOnVideoRegisteredEvent(DEFAULT_VIDEO_KEY));
    const arrangedState = await table.getAllRecords();
    const arrangedRecord = arrangedState.find(i => i.myAnimeListId === DEFAULT_VIDEO_KEY.myAnimeListId)!;

    // Act
    const newVideoKey = { ...DEFAULT_VIDEO_KEY, episode: 2 } as const;
    await handler(makeOnVideoRegisteredEvent(newVideoKey));

    // Assert
    const finalState = await table.getAllRecords();
    const finalRecord = finalState.find(i => i.myAnimeListId === DEFAULT_VIDEO_KEY.myAnimeListId)!;
    expect(finalRecord.updatedAt > arrangedRecord.updatedAt).toBeTruthy();

    const expectedState = [
      ...initialState,
      {
        ...arrangedRecord,
        episodes: new Set([1, 2]),
        updatedAt: finalRecord.updatedAt,
      },
    ]
    expect(finalState).toEqual(expectedState);
  });

  it('should add new anime', async ({ table }) => {
    // Act
    await handler(makeOnVideoRegisteredEvent(DEFAULT_VIDEO_KEY));

    // Assert
    const finalState = await table.getAllRecords();

    const newItem = finalState.find(i => i.myAnimeListId === DEFAULT_VIDEO_KEY.myAnimeListId)!;
    expect(Object.keys(newItem))
      .to.have.members(['animeKey', 'myAnimeListId', 'dub', 'episodes', 'createdAt', 'updatedAt']);
    expect(newItem.animeKey).toEqual('1#a dub');
    expect(newItem.myAnimeListId).toEqual(1);
    expect(newItem.dub).toEqual('a dub');
    expect(newItem.episodes).toEqual(new Set([1]));
    expect(newItem.updatedAt).toEqual(newItem.createdAt);
    expect(new Date(newItem.createdAt).getTime()).toBeCloseTo(new Date().getTime(), -3);
  });

  it('should retry on transient error using build-in ddb retries', async ({ table, api }) => {
    api.blockDynamoDbOnce();

    await handler(makeOnVideoRegisteredEvent(DEFAULT_VIDEO_KEY));

    const finalState = await table.getAllRecords();
    const newItem = finalState.find(i => i.myAnimeListId === DEFAULT_VIDEO_KEY.myAnimeListId)!;
    expect(newItem).toBeDefined();
  });

  it('should retry on transient error using custom retries', async ({ table }) => {
    // Arrange
    const initialState = await table.getAllRecords();
    const brokenEvent = makeOnVideoRegisteredEvent()
    const brokenMessage = JSON.stringify({ items: { length: 1 } });
    vi.spyOn(brokenEvent.Records[0].Sns, 'Message', 'get')
      .mockImplementation(() => brokenMessage);

    // Act & Assert - should propagate error
    await expect(handler(brokenEvent)).rejects.toThrow();

    // Message retrieved exactly 5 times (one fully serialized log + 4 tries)
    const spyOn = vi.spyOn(brokenEvent.Records[0].Sns, 'Message', 'get');
    expect(spyOn).toHaveBeenCalledTimes(5);

    await expectNoDbChanges(initialState, table);
  });
});