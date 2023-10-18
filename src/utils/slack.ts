import axios from "axios";
import { logger } from "../aws/runtime/dt-logger-default";
import { logException } from "./logging";

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

            await axios.post(this.url, {
                text,
            });
        } catch (error) {
            logException(logger, error);
        }
    }
}
