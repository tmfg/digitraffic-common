export class LambdaResponse {
    readonly status: number;
    readonly binary: string;
    readonly fileName?: string;

    constructor(status: number, body: string, fileName?: string) {
        this.status = status;
        this.binary = body;
        this.fileName = fileName;
    }

    static okJson<T>(json: T, fileName?: string) {
        return this.ok(JSON.stringify(json, null, 2), fileName);
    }

    static ok(body: string, fileName?: string) {
        return this.okBinary(Buffer.from(body).toString("base64"), fileName);
    }

    static okBinary(base64: string, fileName?: string) {
        return this.createForBase64(200, base64, fileName);
    }

    static badRequest(body: string) {
        return this.createForString(400, body);
    }

    static notFound() {
        return this.createForString(404, "Not found");
    }

    static internalError() {
        return this.createForString(500, "Internal error");
    }

    static notImplemented() {
        return this.createForString(501, "Not implemented");
    }

    static toBase64(body: string) {
        return Buffer.from(body).toString("base64");
    }

    static createForString(
        status: number,
        body: string,
        fileName?: string
    ): LambdaResponse {
        return this.createForBase64(status, this.toBase64(body), fileName);
    }

    static createForBase64(
        status: number,
        base64Body: string,
        fileName?: string
    ): LambdaResponse {
        return new LambdaResponse(status, base64Body, fileName);
    }
}
