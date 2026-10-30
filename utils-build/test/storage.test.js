'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { WalletDB } = require('../../www/js/modules/storage.js');
const fixturePath = path.resolve(__dirname, 'fixtures/pouchdb-idb-v5.json');
const goldenPouchFixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

// Lightweight in-memory IndexedDB mock for testing WalletDB and PouchDB migration
function createMockIndexedDB() {
    const databases = new Map(); // name -> { version, stores: Map(storeName -> { keyPath, autoIncrement, records: Map(), indexes: Map() }) }

    class MockIndex {
        constructor(store, indexName, keyPath, unique) {
            this.store = store;
            this.indexName = indexName;
            this.keyPath = keyPath;
            this.unique = unique;
        }

        get(key) {
            const req = { onsuccess: null, onerror: null, result: undefined };
            queueMicrotask(() => {
                let found = null;
                for (const item of this.store.records.values()) {
                    if (item[this.keyPath] === key) {
                        found = JSON.parse(JSON.stringify(item));
                        break;
                    }
                }
                req.result = found || undefined;
                if (req.onsuccess) req.onsuccess({ target: req });
            });
            return req;
        }
    }

    class MockObjectStore {
        constructor(dbData, storeData, tx) {
            this.dbData = dbData;
            this.storeData = storeData;
            this.tx = tx;
        }

        get indexNames() {
            return {
                contains: (name) => this.storeData.indexes.has(name)
            };
        }

        index(name) {
            return this.storeData.indexes.get(name);
        }

        createIndex(name, keyPath, opts = {}) {
            const idx = new MockIndex(this.storeData, name, keyPath, !!opts.unique);
            this.storeData.indexes.set(name, idx);
            return idx;
        }

        get(key) {
            const req = { onsuccess: null, onerror: null, result: undefined };
            queueMicrotask(() => {
                const item = this.storeData.records.get(key);
                req.result = item ? JSON.parse(JSON.stringify(item)) : undefined;
                if (req.onsuccess) req.onsuccess({ target: req });
            });
            return req;
        }

        getAll() {
            const req = { onsuccess: null, onerror: null, result: undefined };
            queueMicrotask(() => {
                req.result = Array.from(this.storeData.records.values()).map((v) => JSON.parse(JSON.stringify(v)));
                if (req.onsuccess) req.onsuccess({ target: req });
            });
            return req;
        }

        count() {
            const req = { onsuccess: null, onerror: null, result: undefined };
            queueMicrotask(() => {
                req.result = this.storeData.records.size;
                if (req.onsuccess) req.onsuccess({ target: req });
            });
            return req;
        }

        put(value, key) {
            const req = { onsuccess: null, onerror: null, result: undefined };
            const effectiveKey = this.storeData.keyPath ? value[this.storeData.keyPath] : (key !== undefined ? key : ++this.storeData.autoIncrementId);
            this.storeData.records.set(effectiveKey, JSON.parse(JSON.stringify(value)));
            queueMicrotask(() => {
                req.result = effectiveKey;
                if (req.onsuccess) req.onsuccess({ target: req });
            });
            return req;
        }

        delete(key) {
            const req = { onsuccess: null, onerror: null, result: undefined };
            this.storeData.records.delete(key);
            queueMicrotask(() => {
                if (req.onsuccess) req.onsuccess({ target: req });
            });
            return req;
        }
    }

    class MockTransaction {
        constructor(dbData, storeNames, mode) {
            this.dbData = dbData;
            this.storeNames = storeNames;
            this.mode = mode;
            this.oncomplete = null;
            this.onerror = null;
            this.onabort = null;
            this._aborted = false;

            queueMicrotask(() => {
                if (!this._aborted && this.oncomplete) {
                    this.oncomplete({ target: this });
                }
            });
        }

        objectStore(name) {
            const storeData = this.dbData.stores.get(name);
            if (!storeData) throw new Error(`NotFoundError: object store "${name}" not found`);
            return new MockObjectStore(this.dbData, storeData, this);
        }

        abort() {
            this._aborted = true;
            if (this.onabort) this.onabort({ target: this });
        }
    }

    class MockDatabase {
        constructor(dbData) {
            this.dbData = dbData;
        }

        get objectStoreNames() {
            return {
                contains: (name) => this.dbData.stores.has(name)
            };
        }

        createObjectStore(name, opts = {}) {
            const storeData = {
                keyPath: opts.keyPath || null,
                autoIncrement: !!opts.autoIncrement,
                autoIncrementId: 0,
                records: new Map(),
                indexes: new Map()
            };
            this.dbData.stores.set(name, storeData);
            return new MockObjectStore(this.dbData, storeData, null);
        }

        transaction(storeNames, mode = 'readonly') {
            const names = Array.isArray(storeNames) ? storeNames : [storeNames];
            return new MockTransaction(this.dbData, names, mode);
        }

        close() {}
    }

    const mockIDB = {
        _databases: databases,
        async databases() {
            const list = [];
            for (const [name, data] of databases.entries()) {
                list.push({ name, version: data.version });
            }
            return list;
        },
        open(name, version) {
            const req = { onsuccess: null, onerror: null, onupgradeneeded: null, result: null, error: null };
            queueMicrotask(() => {
                let dbData = databases.get(name);
                const oldVersion = dbData ? dbData.version : 0;
                const newVersion = version !== undefined ? version : (oldVersion || 1);

                if (!dbData) {
                    dbData = {
                        version: newVersion,
                        stores: new Map()
                    };
                    databases.set(name, dbData);
                }

                const dbInstance = new MockDatabase(dbData);
                req.result = dbInstance;

                if (newVersion > oldVersion && req.onupgradeneeded) {
                    const upgradeTx = new MockTransaction(dbData, Array.from(dbData.stores.keys()), 'versionchange');
                    const event = {
                        target: req,
                        oldVersion,
                        newVersion,
                        transaction: upgradeTx
                    };
                    req.onupgradeneeded(event);
                    if (upgradeTx._aborted) {
                        databases.delete(name);
                        req.error = new Error('AbortError: Upgrade aborted');
                        if (req.onerror) req.onerror({ target: req });
                        return;
                    }
                    dbData.version = newVersion;
                }

                if (req.onsuccess) {
                    req.onsuccess({ target: req });
                }
            });
            return req;
        }
    };

    return mockIDB;
}

function seedMockPouchDb(mockIDB, fixture) {
    const dbData = {
        version: fixture.version,
        stores: new Map()
    };
    mockIDB._databases.set(fixture.database, dbData);

    // Document store
    const docStoreData = {
        keyPath: 'id',
        autoIncrement: false,
        autoIncrementId: 0,
        records: new Map(),
        indexes: new Map()
    };
    for (const doc of fixture.stores['document-store']) {
        docStoreData.records.set(doc.id, doc);
    }
    dbData.stores.set('document-store', docStoreData);

    // By sequence store
    const seqStoreData = {
        keyPath: 'seq',
        autoIncrement: true,
        autoIncrementId: 100,
        records: new Map(),
        indexes: new Map()
    };
    for (const seqDoc of fixture.stores['by-sequence']) {
        seqStoreData.records.set(seqDoc.seq, seqDoc);
    }
    dbData.stores.set('by-sequence', seqStoreData);

    // Create _doc_id_rev index
    const bySeqIdx = {
        get: (targetKey) => {
            const req = { onsuccess: null, onerror: null, result: undefined };
            queueMicrotask(() => {
                for (const record of seqStoreData.records.values()) {
                    if (record._doc_id_rev === targetKey) {
                        req.result = JSON.parse(JSON.stringify(record));
                        break;
                    }
                }
                if (req.onsuccess) req.onsuccess({ target: req });
            });
            return req;
        }
    };
    seqStoreData.indexes.set('_doc_id_rev', bySeqIdx);
}

function setGlobal(name, value) {
    const originalDesc = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, {
        value,
        configurable: true,
        writable: true
    });
    return () => {
        if (originalDesc) {
            Object.defineProperty(globalThis, name, originalDesc);
        } else {
            delete globalThis[name];
        }
    };
}

test('WalletDB: 100% lossless migration of all 8 keys from pouchdb fixture', async () => {
    const mockIDB = createMockIndexedDB();
    seedMockPouchDb(mockIDB, goldenPouchFixture);

    const restoreIDB = setGlobal('indexedDB', mockIDB);

    try {
        const db = new WalletDB('toastwallet');

        // Verify all 8 keys migrated with exact winning revisions
        const pindata = await db.get('pindata');
        assert.ok(pindata.data.includes('123f17cc0146821236803c050f88aae968c76a1322b6521bfbc04c8b9fd0ebd55ae4388b'), 'pindata must match rev2');
        assert.equal(pindata._id, 'pindata');
        assert.equal(pindata._doc_id_rev, undefined);
        assert.equal(pindata._rev, undefined);

        const ppdata = await db.get('ppdata');
        assert.ok(ppdata.data.includes('3286cb4db351dd599be5c17a67d97d604fa25abbd9503cf156886f5704d425e235a91c49'));

        const rpdata = await db.get('rpdata');
        assert.ok(rpdata.data.includes('b55328d26a021e798577b9280adee35e0688c179171acedc35c7240a7026ad82e5f8bb42'));

        const accounts = await db.get('accounts');
        assert.ok(accounts.data.includes('Test Secp256k1'), 'accounts must be rev3 (Test Secp256k1), not rev1 or rev2');
        assert.ok(!accounts.data.includes('Intermediate'));

        const gateways = await db.get('savedgateways');
        assert.ok(gateways.data.includes('s1.ripple.com'));

        const settings = await db.get('interfacesettings');
        assert.ok(settings.data.includes('USD'), 'settings must be rev2 (USD), not rev1 (EUR)');

        const reminder = await db.get('lastbackupreminder');
        assert.ok(reminder.data.includes('1600000000'));

        const donated = await db.get('lastdonated');
        assert.ok(donated.data.includes('1500000000'));

        // Deleted doc in PouchDB must NOT be migrated
        await assert.rejects(
            async () => db.get('deleted_sample_doc'),
            (err) => err.status === 404 && err.name === 'not_found'
        );

        // _meta:pouch_migrated must not be directly readable as a user doc
        await assert.rejects(
            async () => db.get('_meta:pouch_migrated'),
            (err) => err.status === 404
        );

        // Verify _pouch_toastwallet was left completely untouched on disk
        const legacyDb = mockIDB._databases.get('_pouch_toastwallet');
        assert.ok(legacyDb, '_pouch_toastwallet database must still exist');
        assert.equal(legacyDb.stores.get('document-store').records.size, 9);
        assert.equal(legacyDb.stores.get('by-sequence').records.size, 14);

        // Idempotency: subsequent boot skips migration without re-writing
        const db2 = new WalletDB('toastwallet');
        const pindata2 = await db2.get('pindata');
        assert.equal(pindata2.data, pindata.data);

        db.close();
        db2.close();
    } finally {
        restoreIDB();
    }
});

test('WalletDB: fresh install creates zero _pouch_toastwallet ghost database', async () => {
    const mockIDB = createMockIndexedDB();
    const restoreIDB = setGlobal('indexedDB', mockIDB);

    try {
        const db = new WalletDB('freshwallet');
        await db.upsert('pindata', () => ({ data: 'test_pin' }));

        const doc = await db.get('pindata');
        assert.equal(doc.data, 'test_pin');

        // Confirm _pouch_freshwallet was NOT created
        assert.equal(mockIDB._databases.has('_pouch_freshwallet'), false, 'Fresh install must never create ghost PouchDB database');

        db.close();
    } finally {
        restoreIDB();
    }
});

test('WalletDB: db.get(key) missing-key rejection contract', async () => {
    const mockIDB = createMockIndexedDB();
    const restoreIDB = setGlobal('indexedDB', mockIDB);

    try {
        const db = new WalletDB('testdb');

        // 1. Rejection properties
        let caughtErr = null;
        try {
            await db.get('does_not_exist');
        } catch (err) {
            caughtErr = err;
        }

        assert.ok(caughtErr !== null, 'Missing key must reject');
        assert.equal(caughtErr.status, 404);
        assert.equal(caughtErr.name, 'not_found');
        assert.equal(caughtErr.error, true);
        assert.equal(caughtErr.data, undefined);

        // 2. Dual .then(f).catch(f) contract check
        let callbackArg = null;
        const cb = (arg) => { callbackArg = arg; };
        await db.get('does_not_exist').then(cb).catch(cb);
        assert.equal(callbackArg.data, undefined, 'arg.data must be undefined so if (arg.data == undefined) works');

        db.close();
    } finally {
        restoreIDB();
    }
});

test('WalletDB: concurrent upserts serialize atomically with zero lost updates', async () => {
    const mockIDB = createMockIndexedDB();
    const restoreIDB = setGlobal('indexedDB', mockIDB);

    try {
        const db = new WalletDB('concurrencydb');

        // Initialize key
        await db.upsert('counter', () => ({ count: 0 }));

        // Fire 20 parallel upserts
        const promises = [];
        for (let i = 0; i < 20; i++) {
            promises.push(
                db.upsert('counter', (doc) => ({
                    count: (doc.count || 0) + 1
                }))
            );
        }

        const results = await Promise.all(promises);
        assert.equal(results.length, 20);
        for (const res of results) {
            assert.equal(res.updated, true);
            assert.equal(res.id, 'counter');
        }

        const finalDoc = await db.get('counter');
        assert.equal(finalDoc.count, 20, 'All 20 concurrent increments must serialize without lost updates');

        // Upsert returning null/false does not update
        const noopRes = await db.upsert('counter', () => null);
        assert.equal(noopRes.updated, false);

        db.close();
    } finally {
        restoreIDB();
    }
});

test('WalletDB: fallback mode operates without IndexedDB', async () => {
    // Force fallback by setting indexedDB = undefined
    const restoreIDB = setGlobal('indexedDB', undefined);

    try {
        const db = new WalletDB('fallbackdb');

        // Missing key 404
        await assert.rejects(
            async () => db.get('missing'),
            (err) => err.status === 404 && err.name === 'not_found'
        );

        // Upsert & get
        await db.upsert('accounts', () => ({ data: 'fallback_account_data' }));
        const doc = await db.get('accounts');
        assert.equal(doc.data, 'fallback_account_data');
        assert.equal(doc._id, 'accounts');

        db.close();
    } finally {
        restoreIDB();
    }
});

test('WalletDB: upsert supports async diffFn', async () => {
    const mockIDB = createMockIndexedDB();
    const restoreIDB = setGlobal('indexedDB', mockIDB);

    try {
        const db = new WalletDB('asynctest');
        const res = await db.upsert('asyncDoc', async (doc) => {
            await new Promise((r) => setTimeout(r, 5));
            return { asyncVal: 'resolvedValue' };
        });

        assert.equal(res.updated, true);
        const doc = await db.get('asyncDoc');
        assert.equal(doc.asyncVal, 'resolvedValue');

        db.close();
    } finally {
        restoreIDB();
    }
});

test('WalletDB: empty legacy PouchDB sets _meta:pouch_migrated with count 0', async () => {
    const mockIDB = createMockIndexedDB();
    // Pre-populate empty legacy PouchDB
    const legacyDB = {
        version: 5,
        stores: new Map([
            ['document-store', { keyPath: 'id', autoIncrement: false, autoIncrementId: 0, records: new Map(), indexes: new Map() }],
            ['by-sequence', { keyPath: 'seq', autoIncrement: true, autoIncrementId: 0, records: new Map(), indexes: new Map() }]
        ])
    };
    mockIDB._databases.set('_pouch_emptytest', legacyDB);

    const restoreIDB = setGlobal('indexedDB', mockIDB);
    try {
        const db = new WalletDB('emptytest');
        // Wait for ready
        await db.upsert('k1', () => ({ v: 1 }));

        // Check that kv contains _meta:pouch_migrated
        const kvDb = mockIDB._databases.get('emptytest_kv');
        const kvRecords = kvDb.stores.get('kv').records;
        const meta = kvRecords.get('_meta:pouch_migrated');
        assert.ok(meta, '_meta:pouch_migrated must be written even when legacy DB had 0 records');
        assert.equal(meta.count, 0);

        db.close();
    } finally {
        restoreIDB();
    }
});

