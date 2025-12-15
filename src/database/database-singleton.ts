import type { IDatabase, ITask } from "pg-promise";
import { logger } from "../aws/runtime/dt-logger-default.js";
import { logException } from "../utils/logging.js";
import { getEnvVariable, getEnvVariableOrElse } from "../utils/utils.js";
import { initDbConnection } from "./database.js";

export enum DatabaseEnvironmentKeys {
  DB_USER = "DB_USER",
  DB_PASS = "DB_PASS",
  DB_URI = "DB_URI",
  DB_RO_URI = "DB_RO_URI",
  DB_APPLICATION = "DB_APPLICATION",
}

const dbSingletons: Map<string, DTDatabase> = new Map();

export type DTDatabase = IDatabase<unknown>;

export type DTTransaction = ITask<unknown>;

function getDbSingleton(
  readonly: boolean,
  convertNullsToUndefined: boolean,
  options?: object,
): DTDatabase {
  const username = getEnvVariable(DatabaseEnvironmentKeys.DB_USER);
  const password = getEnvVariable(DatabaseEnvironmentKeys.DB_PASS);

  const dbUrl = readonly
    ? getEnvVariable(DatabaseEnvironmentKeys.DB_RO_URI)
    : getEnvVariable(DatabaseEnvironmentKeys.DB_URI);

  const applicationName = getEnvVariableOrElse(
    DatabaseEnvironmentKeys.DB_APPLICATION,
    "unknown-cdk-application",
  );

  const key = JSON.stringify({
    username,
    password,
    applicationName,
    url: dbUrl,
    convertNullsToUndefined,
    options,
  });

  let db = dbSingletons.get(key);
  if (!db) {
    db = initDbConnection(
      username,
      password,
      applicationName,
      dbUrl,
      convertNullsToUndefined,
      options,
    );
    dbSingletons.set(key, db);
  }
  return db;
}

// noinspection JSUnusedGlobalSymbols
export function inTransaction<T>(
  fn: (db: DTTransaction) => Promise<T>,
  convertNullsToUndefined: boolean = false,
): Promise<T> {
  return inDatabase(
    (db) => db.tx((t: DTTransaction) => fn(t)),
    convertNullsToUndefined,
  );
}

export function inDatabase<T>(
  fn: (db: DTDatabase) => Promise<T>,
  convertNullsToUndefined: boolean = false,
): Promise<T> {
  return doInDatabase(false, fn, convertNullsToUndefined);
}

export function inDatabaseReadonly<T>(
  fn: (db: DTDatabase) => Promise<T>,
  convertNullsToUndefined: boolean = false,
): Promise<T> {
  return doInDatabase(true, fn, convertNullsToUndefined);
}

async function doInDatabase<T>(
  readonly: boolean,
  fn: (db: DTDatabase) => Promise<T>,
  convertNullsToUndefined: boolean,
): Promise<T> {
  const db = getDbSingleton(readonly, convertNullsToUndefined);
  try {
    // deallocate all prepared statements to allow for connection pooling
    // DISCARD instead of DEALLOCATE as it didn't always clean all prepared statements
    await db.none("DISCARD ALL");
    return await fn(db);
  } catch (e) {
    logException(logger, e);

    throw e;
  } finally {
    await db.$pool.end();
  }
}

// function convertNullColumnsToUndefined(rows: Record<string, unknown>[]) {
//   rows.forEach((row) => {
//     for (const column in row) {
//       const columnValue = row[column];
//       if (columnValue === null) {
//         row[column] = undefined;
//       }
//     }
//   });
// }
