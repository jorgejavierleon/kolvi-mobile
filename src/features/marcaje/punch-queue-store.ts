/**
 * Where a queued punch actually lives when nothing else is holding it (KMO-23
 * #1, #2).
 *
 * `punch-queue.ts` owns the in-memory state and the flush orchestration;
 * everything below is the seam that makes that state survive a force-quit, a
 * battery death or an OS restart, because the alternative is an employee who
 * worked and has no record of it.
 *
 * Two implementations, and they are not a fallback pair — the app uses exactly
 * one and tests use exactly the other. `createSqlitePunchQueueStore` is real
 * durability, one row per punch in a SQLite database under the app's own
 * storage, and it is what `punch-queue.ts`'s module singleton is built on.
 * `createMemoryPunchQueueStore` is what every test and every bare
 * `createPunchQueue()` call gets instead — an array that forgets everything the
 * moment the process does, which is exactly what a unit test wants and exactly
 * what AC#2 says the real store must never be.
 */

import * as SQLite from 'expo-sqlite';

import type { GeoStatus, LocationFix } from './geofence';
import type { QueuedPunch } from './punch-queue';
import type { PunchType } from './punch-state';

export type PunchQueueStore = {
  /** Every row, oldest first — the order `flush` transmits in (#4). */
  load(): Promise<QueuedPunch[]>;
  /** Add one row. Resolves only once it is actually on disk. */
  append(punch: QueuedPunch): Promise<void>;
  /** Remove one row, by `QueuedPunch.id`. A no-op if it is already gone. */
  remove(id: string): Promise<void>;
};

/**
 * The test and default-argument store. An ordinary array, kept in insertion
 * order, with nothing behind it — a fresh `createPunchQueue()` with no store
 * argument gets one of these, so every existing test that never heard of
 * SQLite keeps working unchanged.
 */
export function createMemoryPunchQueueStore(): PunchQueueStore {
  let rows: QueuedPunch[] = [];

  return {
    load: async () => rows,
    append: async (punch) => {
      rows = [...rows, punch];
    },
    remove: async (id) => {
      rows = rows.filter((row) => row.id !== id);
    },
  };
}

const DATABASE_NAME = 'kolvi-punch-queue.db';

/**
 * The real store. One row per queued punch in its own SQLite database, so the
 * queue survives whatever the process does not — a force-quit, a battery
 * death, an OS restart, an app update. `id` is the primary key and `seq` is an
 * autoincrement `punch-queue.ts` never reads except through `ORDER BY`, which
 * is what keeps "oldest first" (#4) true across a restart without this module
 * having to understand what oldest means.
 */
export function createSqlitePunchQueueStore(databaseName: string = DATABASE_NAME): PunchQueueStore {
  const db = openDatabase(databaseName);

  return {
    load: async () => {
      // Read failures degrade to an empty queue rather than taking the module
      // singleton down with them — a corrupted database file or a native
      // module Jest never linked must not stop `punch-queue.ts` from being
      // importable at all, which a rejected `hydrated` promise would do for
      // every screen in the app, not only Marcaje. Rows already on disk are
      // still on disk; the next successful hydration finds them again. Write
      // failures (`append`, `remove`) are the opposite call: those propagate,
      // because pretending a punch is queued when the write never landed is
      // the one failure mode AC#1 exists to rule out.
      try {
        const rows = await (
          await db
        ).getAllAsync<PunchQueueRow>(
          'SELECT id, user_id, type, idempotency_key, device_datetime, lat, lng, accuracy_m, geo_status FROM punch_queue ORDER BY seq ASC',
        );

        return rows.map(fromRow);
      } catch {
        return [];
      }
    },

    append: async (punch) => {
      const { id, userId, type, idempotencyKey, deviceDatetime, fix, geoStatus } = punch;

      await (
        await db
      ).runAsync(
        `INSERT INTO punch_queue
           (id, user_id, type, idempotency_key, device_datetime, lat, lng, accuracy_m, geo_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        userId,
        type,
        idempotencyKey,
        deviceDatetime,
        fix?.latitude ?? null,
        fix?.longitude ?? null,
        fix?.accuracyMeters ?? null,
        geoStatus,
      );
    },

    remove: async (id) => {
      await (await db).runAsync('DELETE FROM punch_queue WHERE id = ?', id);
    },
  };
}

type PunchQueueRow = {
  id: string;
  user_id: number;
  type: string;
  idempotency_key: string;
  device_datetime: string;
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  geo_status: string;
};

function fromRow(row: PunchQueueRow): QueuedPunch {
  const fix: LocationFix | null =
    row.lat === null || row.lng === null
      ? null
      : { latitude: row.lat, longitude: row.lng, accuracyMeters: row.accuracy_m ?? null };

  return {
    id: row.id,
    userId: row.user_id,
    type: row.type as PunchType,
    idempotencyKey: row.idempotency_key,
    // Cast rather than `naiveDateTime()`: this module wrote the column itself,
    // through `readDeviceDateTime`, so a value that failed the wire format
    // would be this store corrupting its own write — a bug to see in a crash
    // report, not a shape to defend against on every read.
    deviceDatetime: row.device_datetime as QueuedPunch['deviceDatetime'],
    fix,
    geoStatus: row.geo_status as GeoStatus,
  };
}

/**
 * Opened once per store and reused — `expo-sqlite` keeps one native connection
 * per database name regardless, so this only saves the `await` on every call
 * after the first, plus keeping the schema creation to a single race-free spot.
 */
function openDatabase(databaseName: string): Promise<SQLite.SQLiteDatabase> {
  return SQLite.openDatabaseAsync(databaseName).then(async (db) => {
    // `user_id` (§4.7 D5) is part of this `CREATE TABLE` rather than a
    // migration bolted on after it: no pilot or production install of this
    // app exists yet — KMO-23 shipped the table itself on the same basis —
    // so there is no row anywhere that predates the column.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS punch_queue (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL UNIQUE,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        device_datetime TEXT NOT NULL,
        lat REAL,
        lng REAL,
        accuracy_m REAL,
        geo_status TEXT NOT NULL
      );
    `);

    return db;
  });
}
