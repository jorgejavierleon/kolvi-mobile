import * as SQLite from 'expo-sqlite';

import type { NaiveDateTime } from '@/api';

import type { GeoStatus } from './geofence';
import type { QueuedPunch } from './punch-queue';
import { createMemoryPunchQueueStore, createSqlitePunchQueueStore } from './punch-queue-store';
import type { PunchType } from './punch-state';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

/**
 * A fake SQLite driver that understands exactly the three queries
 * `punch-queue-store.ts` issues — an INSERT, a DELETE and one SELECT — and
 * keeps rows in insertion order the way `seq AUTOINCREMENT` would. This is
 * the same shape as `expo-sqlite`'s `SQLiteDatabase`, so
 * `createSqlitePunchQueueStore` runs its real SQL against it rather than
 * against a second, parallel implementation this test would then be
 * trusting blindly.
 */
function fakeDatabase() {
  const rows: Record<string, unknown>[] = [];

  return {
    execAsync: jest.fn(async () => undefined),
    runAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
      if (sql.trim().startsWith('INSERT')) {
        const [id, userId, type, idempotencyKey, deviceDatetime, lat, lng, accuracyM, geoStatus] =
          params;
        rows.push({
          id,
          user_id: userId,
          type,
          idempotency_key: idempotencyKey,
          device_datetime: deviceDatetime,
          lat,
          lng,
          accuracy_m: accuracyM,
          geo_status: geoStatus,
        });

        return { changes: 1 };
      }

      if (sql.trim().startsWith('DELETE')) {
        const [id] = params;
        const index = rows.findIndex((row) => row.id === id);
        if (index !== -1) {
          rows.splice(index, 1);
        }

        return { changes: index === -1 ? 0 : 1 };
      }

      throw new Error(`fakeDatabase does not understand: ${sql}`);
    }),
    getAllAsync: jest.fn(async () => [...rows]),
  };
}

function punch(id: string, overrides: Partial<QueuedPunch> = {}): QueuedPunch {
  return {
    id,
    userId: 1,
    type: 'in' as PunchType,
    fix: null,
    geoStatus: 'unknown' as GeoStatus,
    idempotencyKey: `idem-${id}`,
    deviceDatetime: '2026-08-07 08:03:11' as NaiveDateTime,
    ...overrides,
  };
}

describe('createMemoryPunchQueueStore', () => {
  it('loads empty, then whatever was appended, in order', async () => {
    const store = createMemoryPunchQueueStore();

    expect(await store.load()).toEqual([]);

    await store.append(punch('a'));
    await store.append(punch('b'));

    expect((await store.load()).map((row) => row.id)).toEqual(['a', 'b']);
  });

  it('forgets nothing except what was removed', async () => {
    const store = createMemoryPunchQueueStore();

    await store.append(punch('a'));
    await store.append(punch('b'));
    await store.remove('a');

    expect((await store.load()).map((row) => row.id)).toEqual(['b']);
  });

  it('removing a row that is not there is a no-op', async () => {
    const store = createMemoryPunchQueueStore();

    await expect(store.remove('nope')).resolves.toBeUndefined();
  });
});

describe('createSqlitePunchQueueStore (KMO-23 #1, #2)', () => {
  const openDatabaseAsync = SQLite.openDatabaseAsync as jest.Mock;

  beforeEach(() => {
    openDatabaseAsync.mockReset();
  });

  it('creates the table once, on first use', async () => {
    const db = fakeDatabase();
    openDatabaseAsync.mockResolvedValue(db);

    const store = createSqlitePunchQueueStore('test.db');
    await store.load();

    expect(db.execAsync).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS punch_queue'),
    );
  });

  it('round-trips every field, including a fix', async () => {
    openDatabaseAsync.mockResolvedValue(fakeDatabase());

    const store = createSqlitePunchQueueStore('test.db');
    await store.append(
      punch('a', {
        type: 'out',
        idempotencyKey: '0f9c4e6a-3b21-4d7f-9a58-1c2e7b40d913',
        deviceDatetime: '2026-08-07 08:03:11' as NaiveDateTime,
        fix: { latitude: -33.4569, longitude: -70.5975, accuracyMeters: 12.4 },
        geoStatus: 'inside',
      }),
    );

    expect(await store.load()).toEqual([
      {
        id: 'a',
        userId: 1,
        type: 'out',
        idempotencyKey: '0f9c4e6a-3b21-4d7f-9a58-1c2e7b40d913',
        deviceDatetime: '2026-08-07 08:03:11',
        fix: { latitude: -33.4569, longitude: -70.5975, accuracyMeters: 12.4 },
        geoStatus: 'inside',
      },
    ]);
  });

  it('round-trips a punch made with no fix at all', async () => {
    openDatabaseAsync.mockResolvedValue(fakeDatabase());

    const store = createSqlitePunchQueueStore('test.db');
    await store.append(punch('a', { fix: null, geoStatus: 'unknown' }));

    expect((await store.load())[0]?.fix).toBeNull();
  });

  it('keeps insertion order across a load, like AUTOINCREMENT would', async () => {
    openDatabaseAsync.mockResolvedValue(fakeDatabase());

    const store = createSqlitePunchQueueStore('test.db');
    await store.append(punch('a'));
    await store.append(punch('b'));
    await store.append(punch('c'));

    expect((await store.load()).map((row) => row.id)).toEqual(['a', 'b', 'c']);
  });

  it('removes exactly the row asked for', async () => {
    openDatabaseAsync.mockResolvedValue(fakeDatabase());

    const store = createSqlitePunchQueueStore('test.db');
    await store.append(punch('a'));
    await store.append(punch('b'));
    await store.remove('a');

    expect((await store.load()).map((row) => row.id)).toEqual(['b']);
  });

  // §4.7 D5 — the column both queue-to-employee readers (`punch-queue.ts`'s
  // `flush` and `usePunchQueue`) filter on has to survive the round trip.
  it('keeps each row’s employee id, across two different employees', async () => {
    openDatabaseAsync.mockResolvedValue(fakeDatabase());

    const store = createSqlitePunchQueueStore('test.db');
    await store.append(punch('a', { userId: 1 }));
    await store.append(punch('b', { userId: 2 }));

    expect((await store.load()).map((row) => [row.id, row.userId])).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
  });

  it('degrades to an empty queue when the database will not answer', async () => {
    // A corrupted database file, or a native module the runtime never linked,
    // must not stop the module singleton from being constructable — see the
    // comment in punch-queue-store.ts. Rows already on disk are unaffected;
    // only this run's read comes back empty.
    openDatabaseAsync.mockRejectedValue(new Error('native module unavailable'));

    const store = createSqlitePunchQueueStore('test.db');

    await expect(store.load()).resolves.toEqual([]);
  });
});
