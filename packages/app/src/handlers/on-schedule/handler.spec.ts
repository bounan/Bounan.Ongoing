import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handler } from './handler';

const initConfigMock = vi.hoisted(() => vi.fn());
const setUserAgentMock = vi.hoisted(() => vi.fn());
const configValue = vi.hoisted(() => ({
  loanApiConfig: { token: 'test-token' },
}));
const getEpisodesMock = vi.hoisted(() => vi.fn());

const sendRegisterVideosRequestMock = vi.hoisted(() => vi.fn());
const checkIfCompletedMock = vi.hoisted(() => vi.fn());

const getAllMock = vi.hoisted(() => vi.fn());
const deleteAnimeMock = vi.hoisted(() => vi.fn());

vi.mock('@lightweight-clients/shikimori-graphql-api-lightweight-client', () => ({
  client_setUserAgent: setUserAgentMock,
}));

vi.mock('../../config/config', () => ({
  initConfig: initConfigMock,
  config: {
    get value() {
      return configValue;
    },
  },
}));

vi.mock('../../api-clients/loan-api-client', () => ({
  getEpisodes: getEpisodesMock,
}));

vi.mock('../../api-clients/animan-client', () => ({
  sendRegisterVideosRequest: sendRegisterVideosRequestMock,
}));

vi.mock('../../shared/helpers/is-completed', () => ({
  checkIfCompleted: checkIfCompletedMock,
}));

vi.mock('./repository', () => ({
  getAll: getAllMock,
  deleteAnime: deleteAnimeMock,
}));

describe('handler', () => {
  beforeEach(() => {
    initConfigMock.mockReset();
    setUserAgentMock.mockReset();
    getEpisodesMock.mockReset();
    sendRegisterVideosRequestMock.mockReset();
    checkIfCompletedMock.mockReset();
    getAllMock.mockReset();
    deleteAnimeMock.mockReset();

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  it('initializes config, registers new videos, and deletes completed anime', async () => {
    // Two animes registered
    getAllMock.mockResolvedValue([
      {
        myAnimeListId: 1,
        dub: false,
        updatedAt: '2026-01-23T10:00:00.000Z',
        episodes: new Set([1]), // already have ep 1
      },
      {
        myAnimeListId: 2,
        dub: true,
        updatedAt: '2026-01-23T10:00:00.000Z',
        episodes: new Set([1, 2, 3]),
      },
    ]);

    // Loan API returns episodes for each anime (numbers)
    getEpisodesMock
      .mockResolvedValueOnce([1, 2]) // anime 1 has episodes 1 and 2
      .mockResolvedValueOnce([1, 2, 3]); // anime 2

    // Cleanup pass: first anime not completed, second completed
    checkIfCompletedMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await handler({} as never);

    expect(initConfigMock).toHaveBeenCalledTimes(1);
    expect(setUserAgentMock).toHaveBeenCalledWith('Bounan.Ongoing');

    // new videos only includes episode 2 for anime 1
    expect(sendRegisterVideosRequestMock).toHaveBeenCalledTimes(1);
    expect(sendRegisterVideosRequestMock).toHaveBeenCalledWith([{ myAnimeListId: 1, dub: false, episode: 2 }]);

    expect(checkIfCompletedMock).toHaveBeenCalledTimes(2);
    expect(deleteAnimeMock).toHaveBeenCalledTimes(1);
    expect(deleteAnimeMock).toHaveBeenCalledWith(expect.objectContaining({ myAnimeListId: 2, dub: true }));
  });

  it('does not call sendRegisterVideosRequest when there are no new videos', async () => {
    getAllMock.mockResolvedValue([
      {
        myAnimeListId: 1,
        dub: false,
        updatedAt: '2026-01-23T10:00:00.000Z',
        episodes: new Set([1, 2]),
      },
    ]);

    getEpisodesMock.mockResolvedValueOnce([1, 2]);

    checkIfCompletedMock.mockResolvedValueOnce(false);

    await handler({} as never);

    expect(sendRegisterVideosRequestMock).not.toHaveBeenCalled();
    expect(deleteAnimeMock).not.toHaveBeenCalled();
  });

  it('does not delete anime when not completed', async () => {
    getAllMock.mockResolvedValue([
      {
        myAnimeListId: 10,
        dub: false,
        updatedAt: '2026-01-23T10:00:00.000Z',
        episodes: new Set([1]),
      },
    ]);

    getEpisodesMock.mockResolvedValueOnce([1]);
    checkIfCompletedMock.mockResolvedValueOnce(false);

    await handler({} as never);

    expect(deleteAnimeMock).not.toHaveBeenCalled();
  });

  it('propagates initConfig errors', async () => {
    initConfigMock.mockRejectedValueOnce(new Error('config down'));

    await expect(handler({} as never)).rejects.toThrow('config down');
  });

  it('propagates sendRegisterVideosRequest errors', async () => {
    getAllMock.mockResolvedValueOnce([
      {
        myAnimeListId: 1,
        dub: false,
        updatedAt: '2026-01-23T10:00:00.000Z',
        episodes: new Set([1]),
      },
    ]);

    getEpisodesMock.mockResolvedValueOnce([1, 2]); // new

    sendRegisterVideosRequestMock.mockRejectedValueOnce(new Error('lambda down'));
    checkIfCompletedMock.mockResolvedValueOnce(false);

    await expect(handler({} as never)).rejects.toThrow('lambda down');
  });
});
