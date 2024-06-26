import ky from "ky";
import { logger } from "../aws/runtime/dt-logger-default.mjs";
import { logException } from "./logging.mjs";

export class SlackApi {
    private readonly url: string;

    constructor(url: string) {
        this.url = url;
    }

    async notify(text: string) {
        try {
            logger.info({
                method: "SlackApi.notify",
                message: "Sending slack notification",
            });

            await ky.post(this.url, {
                json: { text: text },
            });
        } catch (error) {
            logException(logger, error);
        }
    }
}
