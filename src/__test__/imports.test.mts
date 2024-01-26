test("Importit ok?", async () => {
  const index = import("../index.mjs");
const database = import("../database/database.mjs");
const cached = import("../database/cached.mjs");
const models = import("../database/models.mjs");
const lastUpdated = import("../database/last-updated.mjs");
const urn = import("../types/urn.mjs");
const utilTypes = import("../types/util-types.mjs");
const either = import("../types/either.mjs");
const validator = import("../types/validator.mjs");
const nullable = import("../types/nullable.mjs");
const awsEnv = import("../types/aws-env.mjs");
const asyncTimeoutError = import("../types/async-timeout-error.mjs");
const inputError = import("../types/input-error.mjs");
const httpError = import("../types/http-error.mjs");
const language = import("../types/language.mjs");
const traffictype = import("../types/traffictype.mjs");
const testutils = import("../test/testutils.mjs");
const dbTestutils = import("../test/db-testutils.mjs");
const httpserver = import("../test/httpserver.mjs");
const secretsManager = import("../test/secrets-manager.mjs");
const asserter = import("../test/asserter.mjs");
const rtz = import("../marine/rtz.mjs");
const idUtils = import("../marine/id_utils.mjs");
const apiModel = import("../utils/api-model.mjs");
const logging = import("../utils/logging.mjs");
const base64 = import("../utils/base64.mjs");
const dateUtils = import("../utils/date-utils.mjs");
const geojsonTypes = import("../utils/geojson-types.mjs");
const slack = import("../utils/slack.mjs");
const utils = import("../utils/utils.mjs");
const retry = import("../utils/retry.mjs");
const geometry = import("../utils/geometry.mjs");
const sqsIntegration = import("../aws/infra/sqs-integration.mjs");
const networkStack = import("../aws/infra/stacks/network-stack.mjs");
const dbStack = import("../aws/infra/stacks/db-stack.mjs");
const dbProxyStack = import("../aws/infra/stacks/db-proxy-stack.mjs");
const intraStackConfiguration = import("../aws/infra/stacks/intra-stack-configuration.mjs");
const dbDnsStack = import("../aws/infra/stacks/db-dns-stack.mjs");
const documentation = import("../aws/infra/documentation.mjs");
const usagePlans = import("../aws/infra/usage-plans.mjs");
const scheduler = import("../aws/infra/scheduler.mjs");
const importUtil = import("../aws/infra/import-util.mjs");
const sqsQueue = import("../aws/infra/sqs-queue.mjs");
const response = import("../aws/infra/api/response.mjs");
const staticIntegration = import("../aws/infra/api/static-integration.mjs");
const responses = import("../aws/infra/api/responses.mjs");
const handlerFactory = import("../aws/infra/api/handler-factory.mjs");
const integration = import("../aws/infra/api/integration.mjs");
const stackCheckingAspect = import("../aws/infra/stack/stack-checking-aspect.mjs");
const restApis = import("../aws/infra/stack/rest_apis.mjs");
const lambdaConfigs = import("../aws/infra/stack/lambda-configs.mjs");
const monitoredfunction = import("../aws/infra/stack/monitoredfunction.mjs");
const subscription = import("../aws/infra/stack/subscription.mjs");
const parameters = import("../aws/infra/stack/parameters.mjs");
const stack = import("../aws/infra/stack/stack.mjs");
const securityRule = import("../aws/infra/security-rule.mjs");
//const databaseChecker = import("../aws/infra/canaries/database-checker.mjs");
const canary = import("../aws/infra/canaries/canary.mjs");
//const urlChecker = import("../aws/infra/canaries/url-checker.mjs");
const databaseCanary = import("../aws/infra/canaries/database-canary.mjs");
const canaryAlarm = import("../aws/infra/canaries/canary-alarm.mjs");
const canaryRole = import("../aws/infra/canaries/canary-role.mjs");
const urlCanary = import("../aws/infra/canaries/url-canary.mjs");
const canaryParameters = import("../aws/infra/canaries/canary-parameters.mjs");
const canaryKeys = import("../aws/infra/canaries/canary-keys.mjs");
const proxytypes = import("../aws/types/proxytypes.mjs");
const tags = import("../aws/types/tags.mjs");
const mediatypes = import("../aws/types/mediatypes.mjs");
const modelWithReference = import("../aws/types/model-with-reference.mjs");
const errors= import("../aws/types/errors.mjs");
const lambdaResponse = import("../aws/types/lambda-response.mjs");
const dtLoggerDefault = import("../aws/runtime/dt-logger-default.mjs");
const secret = import("../aws/runtime/secrets/secret.mjs");
const proxyHolder = import("../aws/runtime/secrets/proxy-holder.mjs");
const dbsecret = import("../aws/runtime/secrets/dbsecret.mjs");
const rdsHolder = import("../aws/runtime/secrets/rds-holder.mjs");
const secretHolder = import("../aws/runtime/secrets/secret-holder.mjs");
const dtLogger = import("../aws/runtime/dt-logger.mjs");
const s3 = import("../aws/runtime/s3.mjs");
const messaging = import("../aws/runtime/messaging.mjs");
const apikey = import("../aws/runtime/apikey.mjs");
const environment = import("../aws/runtime/environment.mjs");
const digitrafficIntegrationResponse = import("../aws/runtime/digitraffic-integration-response.mjs");

  await expect(index).resolves.toBeDefined();
  await expect(database).resolves.toBeDefined();
  await expect(cached).resolves.toBeDefined();
  await expect(models).resolves.toBeDefined();
  await expect(lastUpdated).resolves.toBeDefined();
  await expect(urn).resolves.toBeDefined();
  await expect(utilTypes).resolves.toBeDefined();
  await expect(either).resolves.toBeDefined();
  await expect(validator).resolves.toBeDefined();
  await expect(nullable).resolves.toBeDefined();
  await expect(awsEnv).resolves.toBeDefined();
  await expect(asyncTimeoutError).resolves.toBeDefined();
  await expect(inputError).resolves.toBeDefined();
  await expect(httpError).resolves.toBeDefined();
  await expect(language).resolves.toBeDefined();
  await expect(traffictype).resolves.toBeDefined();
  await expect(testutils).resolves.toBeDefined();
  await expect(dbTestutils).resolves.toBeDefined();
  await expect(httpserver).resolves.toBeDefined();
  await expect(secretsManager).resolves.toBeDefined();
  await expect(asserter).resolves.toBeDefined();
  await expect(rtz).resolves.toBeDefined();
  await expect(idUtils).resolves.toBeDefined();
  await expect(apiModel).resolves.toBeDefined();
  await expect(logging).resolves.toBeDefined();
  await expect(base64).resolves.toBeDefined();
  await expect(dateUtils).resolves.toBeDefined();
  await expect(geojsonTypes).resolves.toBeDefined();
  await expect(slack).resolves.toBeDefined();
  await expect(utils).resolves.toBeDefined();
  await expect(retry).resolves.toBeDefined();
  await expect(geometry).resolves.toBeDefined();
  await expect(sqsIntegration).resolves.toBeDefined();
  await expect(networkStack).resolves.toBeDefined();
  await expect(dbStack).resolves.toBeDefined();
  await expect(dbProxyStack).resolves.toBeDefined();
  await expect(intraStackConfiguration).resolves.toBeDefined();
  await expect(dbDnsStack).resolves.toBeDefined();
  await expect(documentation).resolves.toBeDefined();
  await expect(usagePlans).resolves.toBeDefined();
  await expect(scheduler).resolves.toBeDefined();
  await expect(importUtil).resolves.toBeDefined();
  await expect(sqsQueue).resolves.toBeDefined();
  await expect(response).resolves.toBeDefined();
  await expect(staticIntegration).resolves.toBeDefined();
  await expect(responses).resolves.toBeDefined();
  await expect(handlerFactory).resolves.toBeDefined();
  await expect(integration).resolves.toBeDefined();
  await expect(stackCheckingAspect).resolves.toBeDefined();
  await expect(restApis).resolves.toBeDefined();
  await expect(lambdaConfigs).resolves.toBeDefined();
  await expect(monitoredfunction).resolves.toBeDefined();
  await expect(subscription).resolves.toBeDefined();
  await expect(parameters).resolves.toBeDefined();
  await expect(stack).resolves.toBeDefined();
  await expect(securityRule).resolves.toBeDefined();
  //await expect(databaseChecker).resolves.toBeDefined();
  await expect(canary).resolves.toBeDefined();
  //await expect(urlChecker).resolves.toBeDefined();
  await expect(databaseCanary).resolves.toBeDefined();
  await expect(canaryAlarm).resolves.toBeDefined();
  await expect(canaryRole).resolves.toBeDefined();
  await expect(urlCanary).resolves.toBeDefined();
  await expect(canaryParameters).resolves.toBeDefined();
  await expect(canaryKeys).resolves.toBeDefined();
  await expect(proxytypes).resolves.toBeDefined();
  await expect(tags).resolves.toBeDefined();
  await expect(mediatypes).resolves.toBeDefined();
  await expect(modelWithReference).resolves.toBeDefined();
  await expect(errors).resolves.toBeDefined();
  await expect(lambdaResponse).resolves.toBeDefined();
  await expect(dtLoggerDefault).resolves.toBeDefined();
  await expect(secret).resolves.toBeDefined();
  await expect(proxyHolder).resolves.toBeDefined();
  await expect(dbsecret).resolves.toBeDefined();
  await expect(rdsHolder).resolves.toBeDefined();
  await expect(secretHolder).resolves.toBeDefined();
  await expect(dtLogger).resolves.toBeDefined();
  await expect(s3).resolves.toBeDefined();
  await expect(messaging).resolves.toBeDefined();
  await expect(apikey).resolves.toBeDefined();
  await expect(environment).resolves.toBeDefined();
  await expect(digitrafficIntegrationResponse).resolves.toBeDefined();
})