import { PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

import { createLogger } from '../../../../../third-party/common/ts/runtime/logger';
import { config } from '../../config/config';
import type { AnimeEntity, AnimeKey } from '../../models/anime-entity';
import { docClient, getAnimeKey } from '../../shared/repository';

const logger = createLogger('@app/handlers/on-video-registered/repository');

export const addAnime = async (animeKey: AnimeKey, episodes: Set<number>): Promise<void> => {
  const command = new PutCommand({
    TableName: config.value.database.tableName,
    Item: {
      animeKey: getAnimeKey(animeKey),
      myAnimeListId: animeKey.myAnimeListId,
      dub: animeKey.dub,
      episodes: episodes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as AnimeEntity,
    ConditionExpression: 'attribute_not_exists(AnimeKey)',
  });

  const result = await docClient.send(command);
  logger.info('Added anime', { animeKey, episodes: [...episodes], result });
}

export const addEpisodes = async (animeKey: AnimeKey, episodes: Set<number>): Promise<void> => {
  const command = new UpdateCommand({
    TableName: config.value.database.tableName,
    Key: { animeKey: getAnimeKey(animeKey) },
    UpdateExpression: 'ADD episodes :episodes SET updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':episodes': episodes,
      ':updatedAt': new Date().toISOString(),
    },
    ReturnValues: 'NONE',
    ConditionExpression: 'attribute_exists(animeKey)',
  });

  const result = await docClient.send(command);
  logger.info('Added episodes', { animeKey, episodes: [...episodes], result });
}
