import { Server, createServer } from "http";
import { parse } from "url";

export const ERROR_NO_MATCH = "NO MATCH";
export const ERRORCODE_NOT_FOUND = 404;

/**
 * A mock HTTP server created for testing connections from a Lambda to an outside integration
 */
export class TestHttpServer {
    private server?: Server;
    private debug: boolean;

    private messageStack: string[];

    constructor() {
        this.debug = false;
        this.messageStack = [];
    }

    getCallCount(): number {
        return this.messageStack.length;
    }

    getRequestBody(callNumber: number): string {
        return this.messageStack[callNumber];
    }

    listen(
        port: number,
        props: ListenProperties,
        debug = false,
        statusCode = 200,
    ) {
        this.debug = debug;
        this.messageStack = [];
        this.debuglog(`Starting test server on port ${port}`);
        this.server = createServer((req, res) => {
            this.debuglog("Mapped urls: ");
            Object.keys(props).forEach((k) => this.debuglog(k));

            if (!req.url) {
                throw new Error("Missing request url!");
            }

            this.debuglog(`Received request to url ${req.url} ..`);
            const path = parse(req.url).pathname;

            if (!path) {
                throw new Error("Missing path from request!");
            }

            let dataStr = "";
            req.on("data", (chunk) => {
                if (chunk) {
                    dataStr += chunk;
                }
            });

            if (path in props) {
                this.debuglog("..url matched");
                res.setHeader("Access-Control-Allow-Origin", "*");
                res.setHeader(
                    "Access-Control-Allow-Headers",
                    "Authorization,X-User-Id,X-Auth-Token",
                );
                res.writeHead(statusCode);

                req.on("end", () => {
                    // assume sent data is in JSON format
                    this.messageStack[this.messageStack.length] = dataStr;
                    res.end(props[path](req.url, dataStr));
                });
            } else {
                this.debuglog(`..no match for ${path}`);
                req.on("end", () => {
                    // assume sent data is in JSON format
                    this.messageStack[this.messageStack.length] =
                        ERROR_NO_MATCH;
                    res.writeHead(ERRORCODE_NOT_FOUND);
                    res.end(ERROR_NO_MATCH);
                });
            }
        });
        this.server.listen(port);
    }

    close(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this.debuglog("Closing test server");
            if (this.server !== undefined) {
                this.server.close((error) =>
                    error != null ? reject(false) : resolve(true),
                );
            } else {
                resolve(true);
            }
        });
    }

    private debuglog(str: string) {
        if (this.debug) {
            console.debug(str);
        }
    }
}

export type ListenProperties = Record<
    string,
    (url?: string, data?: string) => string
>;
