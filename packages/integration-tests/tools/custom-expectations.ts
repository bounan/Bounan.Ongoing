import { expect } from 'vitest';

import type { AnimeEntity } from '../../app/src/models/anime-entity';
import type { DynamoDbTableFixture } from './dynamodb';

export const performCommonChecks = async (table: DynamoDbTableFixture): Promise<void> => {
  const items = await table.getAllRecords();
  for (const item of items) {
    expect(item.createdAt).toBeDefined();
    expect(item.updatedAt).toBeDefined();
    expect(new Date(item.createdAt).getTime()).toBeLessThanOrEqual(Date.now());
    expect(new Date(item.updatedAt).getTime()).toBeLessThanOrEqual(Date.now());
    expect(new Date(item.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(item.createdAt).getTime());
  }
}

export const expectNoDbChanges = async (initialState: AnimeEntity[], table: DynamoDbTableFixture): Promise<void> => {
  const finalState = await table.getAllRecords();
  for (const item of initialState) {
    const matchingItem = finalState.find(i => i.animeKey === item.animeKey);
    expect(matchingItem).toEqual(item);
  }
}
