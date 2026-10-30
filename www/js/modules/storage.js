'use strict';

function create404Error(id) {
    const err = new Error('missing');
    err.status = 404;
    err.name = 'not_found';
    err.message = 'missing';
    err.error = true;
    if (id !== undefined) {
        err.id = id;
    }
    return err;
}

class WalletDB {
    constructor(name) {
        this.name = name || 'toastwallet';
        this.dbName = this.name + '_kv';
        this.legacyName = '_pouch_' + this.name;
        this._locks = new Map();
        this._db = null;
        this._useFallback = false;
        this._fallbackMem = new Map();
        this._ready = this._init();
    }

    async _init() {
        if (typeof indexedDB === 'undefined') {
            this._useFallback = true;
            return;
        }

        try {
            this._db = await this._openKVDatabase();
            await this._migrateFromLegacyPouch();
        } catch (err) {
            console.warn('WalletDB: IndexedDB initialization failed, falling back to storage:', err);
            this._useFallback = true;
        }
    }

    _openKVDatabase() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(this.dbName, 1);
            req.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('kv')) {
                    db.createObjectStore('kv', { keyPath: '_id' });
                }
            };
            req.onsuccess = (event) => {
                resolve(event.target.result);
            };
            req.onerror = (event) => {
                reject(event.target.error || new Error('Failed to open IndexedDB'));
            };
        });
    }

    async _migrateFromLegacyPouch() {
        if (!this._db) return;

        // Fast path: check if already migrated or initialized
        const alreadyMigrated = await new Promise((resolve) => {
            try {
                const tx = this._db.transaction(['kv'], 'readonly');
                const store = tx.objectStore('kv');
                const req = store.get('_meta:pouch_migrated');
                req.onsuccess = () => {
                    if (req.result) {
                        resolve(true);
                    } else {
                        // Check if store already contains user data
                        const countReq = store.count ? store.count() : null;
                        if (countReq) {
                            countReq.onsuccess = () => resolve(countReq.result > 0);
                            countReq.onerror = () => resolve(false);
                        } else {
                            resolve(false);
                        }
                    }
                };
                req.onerror = () => resolve(false);
            } catch (e) {
                resolve(false);
            }
        });

        if (alreadyMigrated) {
            return;
        }

        // Probe whether legacy PouchDB database exists
        let legacyDbExists = false;
        if (typeof indexedDB.databases === 'function') {
            try {
                const dbs = await indexedDB.databases();
                legacyDbExists = dbs.some((d) => d.name === this.legacyName);
            } catch (e) {
                legacyDbExists = false;
            }
        } else {
            // For browsers without indexedDB.databases():
            // Open cautiously: if onupgradeneeded fires with oldVersion === 0, abort to avoid creating empty DB
            legacyDbExists = await new Promise((resolve) => {
                let aborted = false;
                try {
                    const req = indexedDB.open(this.legacyName);
                    req.onupgradeneeded = (event) => {
                        if (event.oldVersion === 0) {
                            aborted = true;
                            if (event.target.transaction) {
                                try {
                                    event.target.transaction.abort();
                                } catch (_) {}
                            }
                            resolve(false);
                        }
                    };
                    req.onsuccess = (event) => {
                        const db = event.target.result;
                        db.close();
                        if (aborted) {
                            resolve(false);
                        } else {
                            resolve(true);
                        }
                    };
                    req.onerror = () => resolve(false);
                } catch (e) {
                    resolve(false);
                }
            });
        }

        if (!legacyDbExists) {
            return;
        }

        // Open legacy database in read-only mode and read active winning documents
        const docsToMigrate = await new Promise((resolve) => {
            let legacyDb;
            try {
                const req = indexedDB.open(this.legacyName);
                req.onsuccess = (event) => {
                    legacyDb = event.target.result;
                    const storeNames = legacyDb.objectStoreNames;
                    if (!storeNames.contains('document-store') || !storeNames.contains('by-sequence')) {
                        legacyDb.close();
                        return resolve([]);
                    }

                    const tx = legacyDb.transaction(['document-store', 'by-sequence'], 'readonly');
                    const docStore = tx.objectStore('document-store');
                    const seqStore = tx.objectStore('by-sequence');
                    const bySeqIndex = seqStore.indexNames && seqStore.indexNames.contains('_doc_id_rev') ? seqStore.index('_doc_id_rev') : null;

                    const allDocsReq = docStore.getAll ? docStore.getAll() : null;

                    if (allDocsReq) {
                        allDocsReq.onsuccess = async () => {
                            const entries = (allDocsReq.result || []).filter((e) => e && e.deletedOrLocal !== '1');
                            const results = [];
                            for (const entry of entries) {
                                const doc = await new Promise((resDoc) => {
                                    const targetKey = entry.id + '::' + entry.winningRev;
                                    if (bySeqIndex) {
                                        const r = bySeqIndex.get(targetKey);
                                        r.onsuccess = () => {
                                            if (r.result) return resDoc(r.result);
                                            const rSeq = seqStore.get(entry.seq);
                                            rSeq.onsuccess = () => resDoc(rSeq.result || null);
                                            rSeq.onerror = () => resDoc(null);
                                        };
                                        r.onerror = () => {
                                            const rSeq = seqStore.get(entry.seq);
                                            rSeq.onsuccess = () => resDoc(rSeq.result || null);
                                            rSeq.onerror = () => resDoc(null);
                                        };
                                    } else {
                                        const rSeq = seqStore.get(entry.seq);
                                        rSeq.onsuccess = () => resDoc(rSeq.result || null);
                                        rSeq.onerror = () => resDoc(null);
                                    }
                                });

                                if (doc) {
                                    const cleanDoc = { ...doc };
                                    delete cleanDoc._doc_id_rev;
                                    delete cleanDoc._rev;
                                    cleanDoc._id = entry.id;
                                    results.push(cleanDoc);
                                }
                            }
                            legacyDb.close();
                            resolve(results);
                        };
                        allDocsReq.onerror = () => {
                            legacyDb.close();
                            resolve([]);
                        };
                    } else {
                        // Fallback cursor if getAll is unavailable
                        const entries = [];
                        const cursorReq = docStore.openCursor();
                        cursorReq.onsuccess = (e) => {
                            const cursor = e.target.result;
                            if (cursor) {
                                if (cursor.value && cursor.value.deletedOrLocal !== '1') {
                                    entries.push(cursor.value);
                                }
                                cursor.continue();
                            } else {
                                (async () => {
                                    const results = [];
                                    for (const entry of entries) {
                                        const doc = await new Promise((resDoc) => {
                                            const targetKey = entry.id + '::' + entry.winningRev;
                                            if (bySeqIndex) {
                                                const r = bySeqIndex.get(targetKey);
                                                r.onsuccess = () => resDoc(r.result || null);
                                                r.onerror = () => resDoc(null);
                                            } else {
                                                const rSeq = seqStore.get(entry.seq);
                                                rSeq.onsuccess = () => resDoc(rSeq.result || null);
                                                rSeq.onerror = () => resDoc(null);
                                            }
                                        });
                                        if (doc) {
                                            const cleanDoc = { ...doc };
                                            delete cleanDoc._doc_id_rev;
                                            delete cleanDoc._rev;
                                            cleanDoc._id = entry.id;
                                            results.push(cleanDoc);
                                        }
                                    }
                                    legacyDb.close();
                                    resolve(results);
                                })();
                            }
                        };
                        cursorReq.onerror = () => {
                            legacyDb.close();
                            resolve([]);
                        };
                    }
                };
                req.onerror = () => resolve([]);
            } catch (err) {
                if (legacyDb) {
                    try { legacyDb.close(); } catch (_) {}
                }
                resolve([]);
            }
        });

        // Write migrated documents atomically into "kv"
        if (this._db && docsToMigrate.length > 0) {
            await new Promise((resolve, reject) => {
                try {
                    const tx = this._db.transaction(['kv'], 'readwrite');
                    const store = tx.objectStore('kv');
                    for (const doc of docsToMigrate) {
                        store.put(doc);
                    }
                    store.put({
                        _id: '_meta:pouch_migrated',
                        migratedAt: Date.now(),
                        count: docsToMigrate.length
                    });
                    tx.oncomplete = () => resolve();
                    tx.onerror = (e) => reject(e.target.error);
                    tx.onabort = (e) => reject(e.target.error || new Error('Transaction aborted'));
                } catch (e) {
                    reject(e);
                }
            });
        }
    }

    async get(docId) {
        if (typeof docId !== 'string') {
            return Promise.reject(new TypeError('docId must be a string'));
        }
        if (docId === '_meta:pouch_migrated') {
            return Promise.reject(create404Error(docId));
        }

        await this._ready;

        if (this._useFallback || !this._db) {
            return this._getFallback(docId);
        }

        return new Promise((resolve, reject) => {
            try {
                const tx = this._db.transaction(['kv'], 'readonly');
                const store = tx.objectStore('kv');
                const req = store.get(docId);
                req.onsuccess = () => {
                    if (req.result) {
                        const doc = { ...req.result, _id: docId };
                        resolve(doc);
                    } else {
                        reject(create404Error(docId));
                    }
                };
                req.onerror = (e) => {
                    reject(e.target.error || create404Error(docId));
                };
            } catch (e) {
                this._getFallback(docId).then(resolve, reject);
            }
        });
    }

    upsert(docId, diffFn) {
        if (typeof docId !== 'string') {
            return Promise.reject(new TypeError('docId must be a string'));
        }
        if (typeof diffFn !== 'function') {
            return Promise.reject(new TypeError('diffFn must be a function'));
        }

        const prevLock = this._locks.get(docId) || Promise.resolve();
        const currentLock = (async () => {
            try {
                await prevLock;
            } catch (_) {}
            await this._ready;
            return this._doUpsert(docId, diffFn);
        })();

        this._locks.set(docId, currentLock);
        return currentLock;
    }

    async _doUpsert(docId, diffFn) {
        let currentDoc = {};
        try {
            currentDoc = await this.get(docId);
        } catch (err) {
            if (err && err.status === 404) {
                currentDoc = {};
            } else {
                throw err;
            }
        }

        const next = diffFn(currentDoc);
        if (!next) {
            return { updated: false, id: docId };
        }

        const toSave = { ...next, _id: docId };

        if (this._useFallback || !this._db) {
            return this._setFallback(docId, toSave);
        }

        return new Promise((resolve, reject) => {
            try {
                const tx = this._db.transaction(['kv'], 'readwrite');
                const store = tx.objectStore('kv');
                store.put(toSave);
                tx.oncomplete = () => {
                    resolve({ updated: true, id: docId });
                };
                tx.onerror = (e) => {
                    reject(e.target.error || new Error('Upsert write failed'));
                };
                tx.onabort = (e) => {
                    reject(e.target.error || new Error('Upsert transaction aborted'));
                };
            } catch (e) {
                this._setFallback(docId, toSave).then(resolve, reject);
            }
        });
    }

    _getFallback(docId) {
        if (typeof localStorage !== 'undefined') {
            try {
                const key = 'toastwallet_kv:' + this.name + ':' + docId;
                const raw = localStorage.getItem(key);
                if (raw !== null) {
                    return Promise.resolve({ ...JSON.parse(raw), _id: docId });
                }
            } catch (e) {}
        }
        if (this._fallbackMem.has(docId)) {
            return Promise.resolve({ ...this._fallbackMem.get(docId), _id: docId });
        }
        return Promise.reject(create404Error(docId));
    }

    _setFallback(docId, toSave) {
        if (typeof localStorage !== 'undefined') {
            try {
                const key = 'toastwallet_kv:' + this.name + ':' + docId;
                localStorage.setItem(key, JSON.stringify(toSave));
            } catch (e) {}
        }
        this._fallbackMem.set(docId, { ...toSave });
        return Promise.resolve({ updated: true, id: docId });
    }

    close() {
        if (this._db) {
            try {
                this._db.close();
            } catch (_) {}
            this._db = null;
        }
    }
}

if (typeof window !== 'undefined') {
    window.WalletDB = WalletDB;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WalletDB, create404Error };
}
