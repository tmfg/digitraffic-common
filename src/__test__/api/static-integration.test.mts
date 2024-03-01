import { DigitrafficStaticIntegration } from "../../aws/infra/api/static-integration.mjs";
import { MediaType } from "../../aws/types/mediatypes.mjs";

describe("response tests", () => {
    it("createIntegrationResponse works", () => {
        const integrationResponse = DigitrafficStaticIntegration.createIntegrationResponse("FakeResource", MediaType.APPLICATION_JSON, true, { "test-header": "test-value" });
        expect(integrationResponse).toEqual({
            headers: {
                "test-header": "test-value"
            },
            responseParameters: {
                "method.response.header.Access-Control-Allow-Origin": "'*'"
            },
            responseTemplates: {
                "application/json": "FakeResource"
            },
            statusCode: "200"
        });
    });

    it("createMethodResponse works", () => {
        const methodResponse = DigitrafficStaticIntegration.createMethodResponse(true, { "test-header": "test-alue" });
        expect(methodResponse).toEqual({
            responseParameters: {
                "method.response.header.Access-Control-Allow-Origin": true,
                "method.response.header.test-header": true
            },
            statusCode: "200"
        });
    });
});
