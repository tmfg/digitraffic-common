export class LambdaResponse {
    readonly status: number;
    readonly body: string;
    readonly fileName?: string;

    constructor(status: number, body: string, fileName?: string) {
        this.status = status;
        this.body = body;
        this.fileName = fileName;
    }

    /**
     * Create LambdaResponse for HTTP 200 from json.
     */
    static okJson<T>(json: T, fileName?: string) {
        return this.ok(JSON.stringify(json), fileName);
    }

    /**
     * Create LambdaResponse for HTTP 200 from string.
     */
    static ok(body: string, fileName?: string) {
        return this.okBinary(toBase64(body), fileName);
    }

    /**
     * Create LambdaResponse for HTTP 200 from base64-encoded data.
     */
    static okBinary(base64: string, fileName?: string) {
        return createForBase64(200, base64, fileName);
    }

    /**
     * Create LambdaResponse for HTTP 400
     */
    static badRequest(body: string) {
        return createForString(400, body);
    }

    /**
     * Create LambdaResponse for HTTP 404
     */
    static notFound() {
        return createForString(404, "Not found");
    }

    /**
     * Create LambdaResponse for HTTP 500
     */
    static internalError() {
        return createForString(500, "Internal error");
    }

    /**
     * Create LambdaResponse for HTTP 501
     */
    static notImplemented() {
        return createForString(501, "Not implemented");
    }
}

function toBase64(body: string) {
    return Buffer.from(body).toString("base64");
}

function createForString(
    status: number,
    body: string,
    fileName?: string
): LambdaResponse {
    return createForBase64(status, toBase64(body), fileName);
}

function createForBase64(
    status: number,
    base64Body: string,
    fileName?: string
): LambdaResponse {
    return new LambdaResponse(status, base64Body, fileName);
}
