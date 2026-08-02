import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { VideoRegisteredNotification } from '../../../../../third-party/common/ts/interfaces';
import { process } from './processor';

const getEpisodesMock = vi.hoisted(() => vi.fn());
const addAnimeMock = vi.hoisted(() => vi.fn());
const addEpisodesMock = vi.hoisted(() => vi.fn());

vi.mock('../../shared/repository', () => ({ getEpisodes: getEpisodesMock }));

vi.mock('./repository', () => ({ addAnime: addAnimeMock, addEpisodes: addEpisodesMock }));

describe('processor.process', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  it('returns early when items is missing', async () => {
    await process({ items: undefined! });

    expect(getEpisodesMock).not.toHaveBeenCalled();
    expect(addAnimeMock).not.toHaveBeenCalled();
    expect(addEpisodesMock).not.toHaveBeenCalled();
  });

  it('returns early when items is empty', async () => {
    await process({ items: [] });

    expect(getEpisodesMock).not.toHaveBeenCalled();
    expect(addAnimeMock).not.toHaveBeenCalled();
    expect(addEpisodesMock).not.toHaveBeenCalled();
  });

  it('groups by (myAnimeListId, dub) and adds anime when not found', async () => {
    const v1 = { myAnimeListId: 10, dub: 'dub', episode: 1 };
    const v2 = { myAnimeListId: 10, dub: 'dub', episode: 2 };

    // new anime => getEpisodes returns undefined
    getEpisodesMock.mockResolvedValueOnce(undefined);

    const req: VideoRegisteredNotification = {
      items: [{ videoKey: v1 }, { videoKey: v2 }],
    };

    await process(req);

    expect(getEpisodesMock).toHaveBeenCalledTimes(1);
    expect(getEpisodesMock).toHaveBeenCalledWith(v1); // processAnime uses videos[0] as animeKey

    expect(addAnimeMock).toHaveBeenCalledTimes(1);
    expect(addAnimeMock).toHaveBeenCalledWith(v1, new Set<number>([1, 2]));

    expect(addEpisodesMock).not.toHaveBeenCalled();
  });

  it('does nothing when anime exists and there are no new episodes', async () => {
    const v1 = { myAnimeListId: 11, dub: 'sub', episode: 1 };
    const v2 = { myAnimeListId: 11, dub: 'sub', episode: 2 };

    // Existing anime already has episodes 1 and 2
    getEpisodesMock.mockResolvedValueOnce({
      episodes: new Set<number>([1, 2]),
    });

    const req: VideoRegisteredNotification = {
      items: [{ videoKey: v1 }, { videoKey: v2 }],
    };

    await process(req);

    expect(getEpisodesMock).toHaveBeenCalledTimes(1);
    expect(addAnimeMock).not.toHaveBeenCalled();
    expect(addEpisodesMock).not.toHaveBeenCalled();
  });

  it('adds only new episodes when anime exists and some episodes are missing', async () => {
    const v1 = { myAnimeListId: 12, dub: 'dub', episode: 1 };
    const v2 = { myAnimeListId: 12, dub: 'dub', episode: 2 };
    const v3 = { myAnimeListId: 12, dub: 'dub', episode: 3 };

    // Existing anime already has 1 and 3; new should be {2}
    getEpisodesMock.mockResolvedValueOnce({
      episodes: new Set<number>([1, 3]),
    });

    const req: VideoRegisteredNotification = {
      items: [{ videoKey: v1 }, { videoKey: v2 }, { videoKey: v3 }],
    };

    await process(req);

    expect(addAnimeMock).not.toHaveBeenCalled();
    expect(addEpisodesMock).toHaveBeenCalledTimes(1);
    expect(addEpisodesMock).toHaveBeenCalledWith(v1, new Set<number>([2]));
  });

  it('processes multiple unique animes independently', async () => {
    const a1e1 = { myAnimeListId: 100, dub: 'sub', episode: 1 };
    const a1e2 = { myAnimeListId: 100, dub: 'sub', episode: 2 };
    const a2e1 = { myAnimeListId: 200, dub: 'dub', episode: 1 };

    // First anime not found -> addAnime
    getEpisodesMock.mockResolvedValueOnce(undefined);
    // Second anime exists with no episodes -> addEpisodes with {1}
    getEpisodesMock.mockResolvedValueOnce({ episodes: new Set<number>([]) });

    const req: VideoRegisteredNotification = {
      items: [{ videoKey: a1e1 }, { videoKey: a2e1 }, { videoKey: a1e2 }],
    };

    await process(req);

    expect(getEpisodesMock).toHaveBeenCalledTimes(2);

    expect(addAnimeMock).toHaveBeenCalledTimes(1);
    expect(addAnimeMock).toHaveBeenCalledWith(a1e1, new Set<number>([1, 2]));

    expect(addEpisodesMock).toHaveBeenCalledTimes(1);
    expect(addEpisodesMock).toHaveBeenCalledWith(a2e1, new Set<number>([1]));
  });

  it('propagates errors from getEpisodes/addAnime/addEpisodes', async () => {
    const v1 = { myAnimeListId: 13, dub: 'sub', episode: 1 };

    getEpisodesMock.mockRejectedValueOnce(new Error('ddb down'));

    await expect(process({ items: [{ videoKey: v1 }] })).rejects.toThrow('ddb down');
  });
});
