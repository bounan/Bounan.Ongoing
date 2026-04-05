import { test as baseTest } from 'vitest';

import type { Config } from '../app/src/config/types';
import { DynamoDbTableFixture } from './tools/dynamodb';
import { HttpInterceptor } from './tools/http-interceptor';


export const it = baseTest
  .extend('global-envs', { scope: 'worker', auto: true }, async () => {
    // Register dummy AWS credentials to prevent AWS SDK from throwing "Missing credentials" error.
    process.env.AWS_ACCESS_KEY_ID = 'test';
    process.env.AWS_SECRET_ACCESS_KEY = 'test';
    process.env.AWS_REGION = 'us-east-1';
  })
  // eslint-disable-next-line no-empty-pattern
  .extend('api', { scope: 'test', auto: true }, async ({}, { onCleanup }) => {
    // Create a new HttpInterceptor for each test to ensure clean state and isolation.
    const server = HttpInterceptor.create();
    onCleanup(() => server[Symbol.dispose]());
    return server;
  })
  .extend('table', { scope: 'test', auto: true }, async ({ task }, { onCleanup }) => {
    // Create a unique empty DynamoDB table for each test.
    const tableName = `test-table-${task.id}-${Date.now()}`;
    const fixture = await DynamoDbTableFixture.create(tableName);
    onCleanup(() => fixture.dropTable());
    return fixture;
  })
  .extend('config', { scope: 'test', auto: true }, async ({ task, table }) => {
    // Provide a config. Use non-persistent values that include task.id to ensure nothing is hardcoded.
    return {
      animan: { registerVideosLambdaName: 'animan-register-videos-' + task.id },
      loanApiConfig: { functionArn: 'loan-api-function-arn-' + task.id },
      malApiConfig: { token: 'mal-api-token-' + task.id },
      database: { tableName: table.tableName },
      processing: { outdatedPeriodHours: 24 * (Math.floor(new Date().getTime() % 10) + 1) },
    } satisfies Config;
  })
  .extend('ssmConfig', { scope: 'test', auto: true }, async ({ api, config }) => {
    api.mockSsm('/bounan/ongoing/runtime-config', config);
  });
