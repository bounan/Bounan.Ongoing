import { bypass, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

type RequestsRegistry<Request> = {
  requests: Request[];
}

export class HttpInterceptor implements Disposable {
  private static readonly DEFAULT_HANDLERS = [
    http.post('https://dynamodb.us-east-1.amazonaws.com/', async ({ request }) => {
      const proxyUrl = new URL('http://localhost:8001/');
      const proxyRequest = new Request(proxyUrl, request);
      return await fetch(bypass(proxyRequest));
    }),
  ];

  private readonly _server: ReturnType<typeof setupServer>;

  private constructor() {
    this._server = setupServer(...HttpInterceptor.DEFAULT_HANDLERS);
  }

  public static create() {
    const server = new HttpInterceptor();
    server.init();
    return server;
  }

  [Symbol.dispose](): void {
    this._server.close();
  }

  public mockLambda<Request>(lambdaName: string, response: object): RequestsRegistry<Request> {
    const registry: RequestsRegistry<Request> = { requests: [] };

    this._server.use(
      http.post(
        `https://lambda.us-east-1.amazonaws.com/2015-03-31/functions/${lambdaName}/invocations`,
        async ({ request }) => {
          const body = await request.clone().json();
          registry.requests.push(body as Request);
          return new Response(JSON.stringify(response), { status: 200 })
        },
      ),
    );

    return registry;
  }

  public mockSsm(parameterName: string, parameterValue: object) {
    this._server.use(
      http.post('https://ssm.us-east-1.amazonaws.com/', async ({ request }) => {
        const body = await request.clone().text();
        if (body !== `{"Name":"${parameterName}"}`)
          throw new Error(`Unexpected request body: ${request.body}`);

        return HttpResponse.json({
          Parameter: {
            Value: JSON.stringify(parameterValue),
          },
        });
      }),
    );
  }

  public mockJikan(myAnimeListId: number, episodes: number) {
    this._server.use(
      http.get(`https://api.jikan.moe/v4/anime/${myAnimeListId}`, () =>
        HttpResponse.json({ data: { episodes } }),
      ),
    );
  }

  public blockDynamoDbOnce(): void {
    this._server.use(
      http.post(
        'https://dynamodb.us-east-1.amazonaws.com/',
        async () =>
          HttpResponse.json({ __type: 'ProvisionedThroughputExceededException' }, { status: 400 }),
        { once: true },
      ),
    );
  }

  private init() {
    this._server.listen({ onUnhandledRequest: 'error' });
  }
}