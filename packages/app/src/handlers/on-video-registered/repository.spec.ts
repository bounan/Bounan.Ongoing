// eslint-disable-next-line simple-import-sort/imports
import { putInputMock, updateInputMock } from '../../test/mocks/aws-sdk-lib-dynamodb-mock';

import { PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { addAnime, addEpisodes } from './repository';

const sendMock = vi.hoisted(() => vi.fn());
const getAnimeKeyMock = vi.hoisted(() => vi.fn());

vi.mock('../../shared/repository', () => ({
  docClient: { send: sendMock },
  getAnimeKey: getAnimeKeyMock,
}));

vi.mock('../../config/config', () => ({
  config: {
    value: {
      database: {
        tableName: 'anime-table',
      },
    },
  },
}));

describe('repository', () => {
  beforeEach(() => {
    sendMock.mockReset();
    putInputMock.mockReset();
    updateInputMock.mockReset();
    getAnimeKeyMock.mockReset();

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  describe('addAnime', () => {
    it('puts a new anime item with correct attributes', async () => {
      getAnimeKeyMock.mockReturnValueOnce('123#dub');
      sendMock.mockResolvedValueOnce({});

      const episodes = new Set<number>([1, 2, 3]);

      await addAnime({ myAnimeListId: 123, dub: 'dub' }, episodes);

      expect(getAnimeKeyMock).toHaveBeenCalledWith({
        myAnimeListId: 123,
        dub: 'dub',
      });

      expect(putInputMock).toHaveBeenCalledTimes(1);

      expect(putInputMock.mock.calls[0]?.[0]).toMatchObject({
        TableName: 'anime-table',
        Item: {
          animeKey: '123#dub',
          myAnimeListId: 123,
          dub: 'dub',
          episodes,
        },
        ConditionExpression: 'attribute_not_exists(AnimeKey)',
      });

      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(sendMock.mock.calls[0]?.[0]).toBeInstanceOf(PutCommand);
    });

    it('propagates DynamoDB errors', async () => {
      getAnimeKeyMock.mockReturnValueOnce('1#sub');
      sendMock.mockRejectedValueOnce(new Error('ddb down'));

      await expect(
        addAnime({ myAnimeListId: 1, dub: 'sub' }, new Set<number>([1])),
      ).rejects.toThrow('ddb down');
    });
  });

  describe('addEpisodes', () => {
    it('updates episodes and updatedAt for an existing anime', async () => {
      getAnimeKeyMock.mockReturnValueOnce('999#dub');
      sendMock.mockResolvedValueOnce({});

      const episodes = new Set<number>([4, 5]);

      await addEpisodes({ myAnimeListId: 999, dub: 'dub' }, episodes);

      expect(getAnimeKeyMock).toHaveBeenCalledWith({
        myAnimeListId: 999,
        dub: 'dub',
      });

      expect(updateInputMock).toHaveBeenCalledTimes(1);

      const input = updateInputMock.mock.calls[0]?.[0];
      expect(input).toMatchObject({
        TableName: 'anime-table',
        Key: { animeKey: '999#dub' },
        UpdateExpression: 'ADD episodes :episodes SET updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':episodes': episodes,
        },
        ReturnValues: 'NONE',
        ConditionExpression: 'attribute_exists(animeKey)',
      });

      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(sendMock.mock.calls[0]?.[0]).toBeInstanceOf(UpdateCommand);

      const updatedAt = input.ExpressionAttributeValues[':updatedAt'];
      expect(typeof updatedAt).toBe('string');
      expect(updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('propagates DynamoDB errors', async () => {
      getAnimeKeyMock.mockReturnValueOnce('5#sub');
      sendMock.mockRejectedValueOnce(new Error('ddb down'));

      await expect(
        addEpisodes({ myAnimeListId: 5, dub: 'sub' }, new Set<number>([2])),
      ).rejects.toThrow('ddb down');
    });
  });
});
