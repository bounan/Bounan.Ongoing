import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

import { assert } from '../../../third-party/common/ts/runtime/assert';
import type { AnimeEntity } from '../../app/src/models/anime-entity';

export class DynamoDbTableFixture {
  private readonly docClient: DynamoDBDocumentClient;

  private constructor(public readonly tableName: string) {
    const dynamoDbClient = new DynamoDBClient();
    this.docClient = DynamoDBDocumentClient.from(dynamoDbClient);
  }

  /**
   * Creates a new DynamoDB table fixture with the specified name and no pre-existing records.
   * Useful for tests that control the entire DB state themselves (e.g. on-schedule handler tests).
   */
  static async createEmpty(tableName: string) {
    assert(tableName.includes('test-table-'));
    const fixture = new DynamoDbTableFixture(tableName);
    await fixture.createTable();
    return fixture;
  }

  /**
   * Creates a new DynamoDB table fixture with the specified name and populates it with initial data.
   * @param tableName The name of the DynamoDB table to create. It should include "test-table-" to prevent accidental deletion of real tables.
   * @returns A promise that resolves to an instance of DynamoDbTableFixture with the created table.
   */
  static async create(tableName: string) {
    assert(tableName.includes('test-table-'));
    const fixture = new DynamoDbTableFixture(tableName);
    await fixture.createTable();

    return fixture;
  }

  async getAllRecords(): Promise<AnimeEntity[]> {
    const scanCommand = new ScanCommand({ TableName: this.tableName });
    const result = await this.docClient.send(scanCommand);
    return (result.Items ?? []) as AnimeEntity[];
  };

  async putRecords(...records: Record<string, unknown>[]): Promise<void> {
    for (const record of records) {
      const command = new PutCommand({
        TableName: this.tableName,
        Item: record,
      });

      await this.docClient.send(command);
    }
  }

  async createTable() {
    const keyProperty: keyof AnimeEntity = 'animeKey';
    const command = new CreateTableCommand({
      TableName: this.tableName,
      AttributeDefinitions: [{ AttributeName: keyProperty, AttributeType: 'S' }],
      KeySchema: [{ AttributeName: keyProperty, KeyType: 'HASH' }],
      BillingMode: 'PAY_PER_REQUEST',
    });

    await this.docClient.send(command);

    const client = this.docClient;
    await waitUntilTableExists(
      { client, maxWaitTime: 60 },
      { TableName: this.tableName },
    );

    console.log('Table created', this.tableName);
  };

  async dropTable() {
    const table = this.tableName;

    if (!table.includes('test-table-')) {
      throw new Error('Table name must include "test-table-" to prevent accidental deletion of real tables');
    }

    await this.docClient.send(new DeleteTableCommand({ TableName: table }));
    console.log('Table deleted', table);
  };
}
