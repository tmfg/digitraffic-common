import {
    TestHttpServer,
    ListenProperties,
    ERROR_NO_MATCH,
    ERRORCODE_NOT_FOUND,
} from "../../src/test/httpserver.mjs";
import { IncomingMessage } from "http";
import {Socket} from "net";
import { AsyncLocalStorage } from "node:async_hooks";
import * as http from "http";
import {expect} from "@jest/globals";

const threadLocalPort = new AsyncLocalStorage();

const DEFAULT_PATH = "/";

const DEFAULT_PROPS: ListenProperties = {
    "/": () => "",
};

const findOpenPort = async (excludedPorts: Set<number>) => {
    const ephemeralPorts = Array.from(
        { length: 65535 - 1024 + 1 },
        (v, i) => 1024 + i,
    );
    const allSocketEvents = [
        "close",
        "connect",
        "data",
        "drain",
        "end",
        "error",
        "lookup",
        "ready",
        "timeout",
    ];
    let openPort: number | null = null;
    for (const testPort of ephemeralPorts) {
        if (openPort !== null) {
            break;
        }
        if (excludedPorts.has(testPort)) {
            continue;
        }
        const portConnected: Promise<number | null> = new Promise((resolve) => {
            const socket = new Socket();
            socket.setTimeout(500);
            for (const socketEvent of allSocketEvents) {
                if (socketEvent === "error") {
                    socket.on(
                        socketEvent,
                        (error: Error & { code: string }) => {
                            socket.destroy();
                            if (error.code === "ECONNREFUSED") {
                                resolve(testPort);
                            } else {
                                resolve(null);
                            }
                        },
                    );
                } else {
                    socket.on(socketEvent, () => {
                        socket.destroy();
                        resolve(null);
                    });
                }
            }
            // connect method is asynchronous. That is why we wrap this thing inside of a promise.
            socket.connect({ port: testPort, host: "127.0.0.1" });
        });
        openPort = await portConnected;
    }
    if (openPort === null) {
        throw Error("All ephemeral ports in use!");
    }
    return openPort;
};
const usedPorts = new Set<number>();
async function withServer(
    fn: (server: TestHttpServer) => unknown,
    props: ListenProperties = DEFAULT_PROPS,
    statusCode = 200,
) {
    const server = new TestHttpServer();
    let openPort;
    while (!openPort) {
        const foundPort = await findOpenPort(usedPorts);
        console.info(`foundPort ${foundPort}`);
        if (!usedPorts.has(foundPort)) {
            usedPorts.add(foundPort);
            openPort = foundPort;
        }
    }
    console.info(`Using port ${openPort} to run the test`);
    server.listen(openPort, props, false, statusCode);
    threadLocalPort.enterWith(openPort);
    try {
        await fn(server);
    } finally {
        await server.close();
        console.info("Server closed");
    }
}

function sendGetRequest(path = DEFAULT_PATH): Promise<IncomingMessage> {
    return sendRequest("GET", path);
}

function sendPostRequest(
    path = DEFAULT_PATH,
    body: string,
): Promise<IncomingMessage> {
    return sendRequest("POST", path, body);
}

function sendRequest(
    method: string,
    path: string,
    body?: string,
): Promise<IncomingMessage> {
    return new Promise((resolve, reject) => {
        const port = threadLocalPort.getStore() as number;
        const request = http.request(
            {
                path,
                port,
                method,
            },
            (response: IncomingMessage) => {
                response.on("data", () => {
                    // do nothing
                });

                //the whole response has been received, so we just print it out here
                response.on("end", () => {
                    resolve(response);
                });

                response.on("error", (error: Error) => {
                    reject(error);
                });
            },
        );

        if (method === "POST") {
            request.write(body);
        }
        request.end();
    });
}

test("no calls", () => {
    return withServer((server: TestHttpServer) => {
        expect(server.getCallCount()).toEqual(0);
    });
});

test("one get", async () => {
    await withServer(async (server: TestHttpServer) => {
        await sendGetRequest();

        expect(server.getCallCount()).toEqual(1);
    });
});

test("one get - no MATCH", async () => {
    await withServer(async (server: TestHttpServer) => {
        const response = await sendGetRequest("/no-match");

        expect(server.getCallCount()).toEqual(1);
        expect(server.getRequestBody(0)).toEqual(ERROR_NO_MATCH);
        expect(response.statusCode).toEqual(ERRORCODE_NOT_FOUND);
    });
});

test("get - error 405", async () => {
    const ERROR_CODE = 405;

    await withServer(
        async (server: TestHttpServer) => {
            const response = await sendGetRequest();

            expect(server.getCallCount()).toEqual(1);
            expect(response.statusCode).toEqual(ERROR_CODE);
        },
        DEFAULT_PROPS,
        ERROR_CODE,
    );
});

test("one post", async () => {
    await withServer(async (server: TestHttpServer) => {
        const testBody = "Testing123!";
        await sendPostRequest(DEFAULT_PATH, testBody);

        expect(server.getCallCount()).toEqual(1);
        expect(server.getRequestBody(0)).toEqual(testBody);
    });
});
