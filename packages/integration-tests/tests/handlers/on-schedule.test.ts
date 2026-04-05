import { afterEach, describe, expect } from 'vitest';

import { cache } from '../../../../third-party/common/ts/runtime/memorized';
import { handler } from '../../../app/src/handlers/on-schedule/handler';
import { it } from '../../fixtures';
import { expectNoDbChanges } from '../../tools/custom-expectations';

describe('on-schedule', () => {
  const DEFAULT_ENTITY = {
    animeKey: '101#dummy',
    myAnimeListId: 101,
    dub: 'dummy',
    episodes: new Set([1, 2]),
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: new Date().toISOString(),
  };

  afterEach(() => {
    // Cleanup lambda calls cache
    cache.clear();
  });

  // REQ-OS-01: Inactive -> removed regardless of completion status.
  // "Inactive" means updatedAt is older than outdatedPeriodHours (30 days).
  // Note: the handler calls Loan API first (registerNewVideos) even for inactive anime,
  // then deletes them in cleanupCompletedSeries without calling the Jikan API.
  it('REQ-OS-01: removes inactive anime from the database', async ({ table, api, task, config }) => {
    const outdatedPeriodMs = 1000 * 60 * 60 * config.processing.outdatedPeriodHours;
    const inactiveUpdatedAt = new Date(Date.now() - outdatedPeriodMs).toISOString();

    api.mockLambda(`loan-api-function-arn-${task.id}`, [1, 2]);
    await table.putRecords({
      ...DEFAULT_ENTITY,
      updatedAt: inactiveUpdatedAt,
    });

    await handler({} as never);

    const finalState = await table.getAllRecords();
    expect(finalState).toHaveLength(0);
  });

  // REQ-OS-02: Active + Complete -> removed.
  // Jikan API reports total episodes = observed max -> series is complete.
  it('REQ-OS-02: removes complete anime from the database', async ({ table, api, task }) => {
    api.mockLambda(`loan-api-function-arn-${task.id}`, [1, 2, 3, 4, 12]);
    api.mockJikan(DEFAULT_ENTITY.myAnimeListId, 12);
    await table.putRecords({
      ...DEFAULT_ENTITY,
      episodes: new Set([1, 2, 3, 4, 12]),
    });

    await handler({} as never);

    const finalState = await table.getAllRecords();
    expect(finalState).toHaveLength(0);
  });

  // REQ-OS-03: Active + Not complete + 0 new episodes -> no action.
  it('REQ-OS-03: takes no action when there are no new episodes', async ({ table, api, task }) => {
    api.mockLambda(`loan-api-function-arn-${task.id}`, [1, 2, 3]);
    api.mockJikan(DEFAULT_ENTITY.myAnimeListId, 24);
    await table.putRecords({
      ...DEFAULT_ENTITY,
      episodes: new Set([1, 2, 3]),
    });

    await handler({} as never);

    const finalState = await table.getAllRecords();
    expect(finalState).toHaveLength(1);
    expect(finalState[0].animeKey).toEqual(`${DEFAULT_ENTITY.myAnimeListId}#${DEFAULT_ENTITY.dub}`);
  });

  // REQ-OS-04: Active + Not complete + 1 new episode -> single notification sent.
  // The handler notifies downstream (Animan Lambda) but does NOT update the DB itself.
  it('REQ-OS-04: sends a notification for a single new episode', async ({ table, api, task }) => {
    api.mockLambda(`loan-api-function-arn-${task.id}`, [1, 2, 3, 4]);
    const animanRegistry = api.mockLambda(`animan-register-videos-${task.id}`, {});
    api.mockJikan(DEFAULT_ENTITY.myAnimeListId, 24);
    await table.putRecords({
      ...DEFAULT_ENTITY,
      episodes: new Set([1, 2, 3]),
    });
    const initialState = await table.getAllRecords();

    await handler({} as never);

    expect(animanRegistry.requests).toHaveLength(1);
    expect(animanRegistry.requests[0]).toEqual({
      items: [{ videoKey: { myAnimeListId: DEFAULT_ENTITY.myAnimeListId, dub: DEFAULT_ENTITY.dub, episode: 4 } }],
    });

    await expectNoDbChanges(initialState, table);
  });

  // REQ-OS-05: Active + Not complete + multiple new episodes -> all sent in a single notification.
  it('REQ-OS-05: sends a single notification containing all new episodes', async ({ table, api, task }) => {
    api.mockLambda(`loan-api-function-arn-${task.id}`, [1, 2, 3, 4, 5, 6]);
    const animanRegistry = api.mockLambda(`animan-register-videos-${task.id}`, {});
    api.mockJikan(DEFAULT_ENTITY.myAnimeListId, 24);
    await table.putRecords({
      ...DEFAULT_ENTITY,
      episodes: new Set([1, 2, 3]),
    });
    const initialState = await table.getAllRecords();

    await handler({} as never);

    expect(animanRegistry.requests).toHaveLength(1);
    expect(animanRegistry.requests[0]).toEqual({
      items: [
        { videoKey: { myAnimeListId: DEFAULT_ENTITY.myAnimeListId, dub: DEFAULT_ENTITY.dub, episode: 4 } },
        { videoKey: { myAnimeListId: DEFAULT_ENTITY.myAnimeListId, dub: DEFAULT_ENTITY.dub, episode: 5 } },
        { videoKey: { myAnimeListId: DEFAULT_ENTITY.myAnimeListId, dub: DEFAULT_ENTITY.dub, episode: 6 } },
      ],
    });

    await expectNoDbChanges(initialState, table);
  });

  it('treats anime incomplete if expected episodes are not returned by Jikan API', async ({ table, api, task }) => {
    api.mockLambda(`loan-api-function-arn-${task.id}`, [1, 2, 3, 4]);
    const animanRegistry = api.mockLambda(`animan-register-videos-${task.id}`, {});
    // Jikan API returns fewer episodes than the max observed episode -> treat as incomplete and notify about new episode
    api.mockJikan(DEFAULT_ENTITY.myAnimeListId, undefined!);
    await table.putRecords({
      ...DEFAULT_ENTITY,
      episodes: new Set([1, 2, 3]),
    });
    const initialState = await table.getAllRecords();

    await handler({} as never);

    expect(animanRegistry.requests).toHaveLength(1);
    expect(animanRegistry.requests[0]).toEqual({
      items: [{ videoKey: { myAnimeListId: DEFAULT_ENTITY.myAnimeListId, dub: DEFAULT_ENTITY.dub, episode: 4 } }],
    });

    await expectNoDbChanges(initialState, table);
  });

  it('should not delete single-episode anime is with 0 episode', async ({ table, api, task }) => {
    api.mockLambda(`loan-api-function-arn-${task.id}`, [0]);
    api.mockJikan(DEFAULT_ENTITY.myAnimeListId, 1);
    await table.putRecords({
      ...DEFAULT_ENTITY,
      episodes: new Set([0]),
    });

    await handler({} as never);

    const finalState = await table.getAllRecords();
    expect(finalState).toHaveLength(0);
  });
});
