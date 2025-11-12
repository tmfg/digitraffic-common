import * as zlib from "node:zlib";
import etag from "etag";
import { StopWatch } from "../../utils/stop-watch.js";
import { logger } from "../runtime/dt-logger-default.js";

export class LambdaResponse {
  readonly status: number;
  readonly body: string;
  readonly fileName?: string;
  readonly timestamp?: string;
  readonly etag: string;
  readonly compressed: boolean;

  constructor(
    status: number,
    body: string,
    fileName?: string,
    timestamp?: Date,
    compressed: boolean = false,
    etagValue: string = etag(body),
  ) {
    this.status = status;
    this.body = body;
    this.fileName = fileName;
    this.timestamp = timestamp?.toUTCString();
    this.etag = etagValue; // create strong etag by default
    this.compressed = compressed;
  }

  withTimestamp(timestamp: Date): LambdaResponse {
    return new LambdaResponse(
      this.status,
      this.body,
      this.fileName,
      timestamp,
      this.compressed,
      this.etag,
    );
  }

  /**
   * Create LambdaResponse for HTTP 200 from json.
   */
  static okJson<T>(json: T, fileName?: string): LambdaResponse {
    return LambdaResponse.ok(JSON.stringify(json), fileName);
  }

  /**
   * Create LambdaResponse for HTTP 200 from string.
   */
  static ok(body: string, fileName?: string): LambdaResponse {
    return LambdaResponse.okBinary(toBase64(body), fileName);
  }

  /**
   * Create LambdaResponse for HTTP 200 from base64-encoded data.
   */
  static okBinary(base64: string, fileName?: string): LambdaResponse {
    return LambdaResponse.createForBase64(200, base64, fileName);
  }

  /**
   * Create LambdaResponse for HTTP 400
   */
  static badRequest(error: string): LambdaResponse {
    return LambdaResponse.createForString(400, error);
  }

  /**
   * Create LambdaResponse for HTTP 404
   */
  static notFound(error: string = "Not found"): LambdaResponse {
    return LambdaResponse.createForString(404, error);
  }

  /**
   * Create LambdaResponse for HTTP 500
   */
  static internalError(error: string = "Internal error"): LambdaResponse {
    return LambdaResponse.createForString(500, error);
  }

  /**
   * Create LambdaResponse for HTTP 401
   */
  static unauthorized(error: string = "Unauthorized"): LambdaResponse {
    return LambdaResponse.createForString(401, error);
  }

  /**
   * Create LambdaResponse for HTTP 413
   */
  static contentTooLarge(error: string = "Content too large"): LambdaResponse {
    return LambdaResponse.createForString(413, error);
  }

  /**
   * Create LambdaResponse for HTTP 501
   */
  static notImplemented(error: string = "Not implemented"): LambdaResponse {
    return LambdaResponse.createForString(501, error);
  }

  private static createForString(
    status: number,
    body: string,
    fileName?: string,
  ): LambdaResponse {
    return LambdaResponse.createForBase64(status, toBase64(body), fileName);
  }

  private static createForBase64(
    status: number,
    base64Body: string,
    fileName?: string,
  ): LambdaResponse {
    return new LambdaResponse(status, base64Body, fileName);
  }
}

function toBase64(body: string): string {
  return Buffer.from(body).toString("base64");
}

/**
 * Default status is 200 and compressed = false.
 */
export class LambdaResponseBuilder {
  body?: string;
  etag?: string;
  fileName?: string;
  timestamp?: Date;
  compressBody: boolean = false;
  status: number = 200;
  debug: boolean = false;
  private sizeUncompressedBase64Bytes?: number;
  private sizeCompressedBase64Bytes?: number;

  static create(body?: object | string): LambdaResponseBuilder {
    const builder = new LambdaResponseBuilder();
    if (body !== undefined) {
      builder.withBody(body);
    }

    return builder;
  }

  withBody<T extends object | string>(body: T) {
    this.body = typeof body === "string" ? body : JSON.stringify(body);
    // create strong etag by default from original body
    this.etag = etag(this.body); // create strong etag by default from original body
    return this;
  }

  withFileName(fileName: string): LambdaResponseBuilder {
    this.fileName = fileName;
    return this;
  }
  withStatus(status: number): LambdaResponseBuilder {
    this.status = status;
    return this;
  }

  withTimestamp(timestamp: Date | string | undefined): LambdaResponseBuilder {
    if (timestamp !== undefined) {
      if (typeof timestamp === "string") {
        // Convert string to Date
        this.timestamp = new Date(timestamp);
      } else {
        this.timestamp = timestamp;
      }
    }
    return this;
  }

  withCompression(enabled: boolean = true): LambdaResponseBuilder {
    this.compressBody = enabled;
    return this;
  }

  withDebug(enabled: boolean = true): LambdaResponseBuilder {
    this.debug = enabled;
    return this;
  }

  build(): LambdaResponse {
    if (!this.body) {
      throw new Error("Body is required for LambdaResponseBuilder");
    }
    const encodedBody = this.encodeBody();

    return new LambdaResponse(
      this.status,
      encodedBody,
      this.fileName,
      this.timestamp,
      this.compressBody,
      this.etag,
    );
  }

  /**
   * Encodes body to base64 string that is compressed if compression was requested only if
   * compressed value is smaller than uncompressed.
   *
   * @private
   * @return Base64 encoded body string and compressed if compression was requested,
   *         and it's smaller than uncompressed value.
   */
  private encodeBody(): string {
    if (!this.body) {
      throw new Error("Body is required for LambdaResponseBuilder");
    }
    const rawBuffer = Buffer.from(this.body, "utf8");
    const sw = StopWatch.createStarted("base64");
    const uncompressedBase64 = rawBuffer.toString("base64");

    if (!this.compressBody) {
      return uncompressedBase64;
    }

    sw.stop("base64").start("compress");
    const compressed = compressBuffer(rawBuffer);
    const compressedBase64 = compressed.toString("base64");
    sw.stop("compress");
    this.sizeUncompressedBase64Bytes = Buffer.byteLength(uncompressedBase64);
    this.sizeCompressedBase64Bytes = Buffer.byteLength(compressedBase64);

    const compressionNeeded =
      this.sizeCompressedBase64Bytes < this.sizeUncompressedBase64Bytes;

    if (this.debug) {
      const compressionRatio = (
        this.sizeUncompressedBase64Bytes / this.sizeCompressedBase64Bytes
      ).toFixed(1);
      const spaceSavingRatio = (
        1 -
        this.sizeCompressedBase64Bytes / this.sizeUncompressedBase64Bytes
      ).toFixed(1);

      logger.info({
        method: "LambdaResponseBuilder.build",
        message: "Compression ratio for LambdaResponse",
        customCompressedBytes: this.sizeCompressedBase64Bytes,
        customUncompressedBytes: this.sizeUncompressedBase64Bytes,
        customCompressionRatio: compressionRatio,
        customSpaceSavingRatio: spaceSavingRatio,
        customCompressionEnabled: compressionNeeded,
        customCompressionTookMs: sw.getDuration("compress"),
        customBase64TookMs: sw.getDuration("base64"),
      });
    }
    if (!compressionNeeded) {
      // deactivate compression and retun uncompressed encoded body
      this.withCompression(false);
      return uncompressedBase64;
    }

    // Compression was better than uncompressed
    return compressedBase64;
  }
}

export function compressBuffer(buffer: Buffer): Buffer {
  return zlib.gzipSync(buffer);
}

/**
 * Just for debugging if needed to decode body.
 * @param base64
 * @param compressed
 */
export function decodeBase64ToString(
  base64: string,
  compressed = false,
): string {
  const buffer = Buffer.from(base64, "base64");
  return compressed
    ? zlib.gunzipSync(buffer).toString("utf8")
    : buffer.toString("utf8");
}
