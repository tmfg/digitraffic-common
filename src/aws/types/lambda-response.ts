export class LambdaResponse<T> {
    readonly status: number;
    readonly body: T;
    readonly fileName?: string;

    constructor(status: number, body: T, fileName?: string) {
        this.status = status;
        this.body = body;
        this.fileName = fileName;
    }

    static ok<T>(body: T, fileName?: string) {
        return this.create(200, body, fileName);
    }

    static okJson<T>(json: T, fileName?: string) {
        return this.create(200, JSON.stringify(json, null, 2), fileName);
    }

    static badRequest(body: string) {
        return this.create(400, body);
    }

    static notFound() {
        return this.create(404, "Not found");
    }

    static internalError() {
        return this.create(500, "Internal error");
    }

    static notImplemented() {
        return this.create(501, "Not implemented");
    }

    static create<T>(
        status: number,
        body: T,
        fileName?: string
    ): Promise<LambdaResponse<T>> {
        return Promise.resolve(new LambdaResponse(status, body, fileName));
    }
}
