import { vi } from 'vitest';

const sendMock = vi.hoisted(() => vi.fn());
const putInputMock = vi.hoisted(() => vi.fn());
const updateInputMock = vi.hoisted(() => vi.fn());
const getInputMock = vi.hoisted(() => vi.fn());

vi.mock('@aws-sdk/lib-dynamodb', () => {
  class PutCommand {
    constructor(input: unknown) {
      putInputMock(input);
    }
  }

  class UpdateCommand {
    constructor(input: unknown) {
      updateInputMock(input);
    }
  }

  class GetCommand {
    constructor(input: unknown) {
      getInputMock(input);
    }
  }

  return {
    PutCommand, UpdateCommand, GetCommand,
    DynamoDBDocumentClient: {
      from: () => ({
        send: sendMock,
      }),
    },
  };
});

export { getInputMock, putInputMock, sendMock, updateInputMock };