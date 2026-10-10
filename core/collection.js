const QueryEngine = require("../query/queryEngine");
const Query = require("../query/query");
const IndexManager = require("../index/indexManager");
const QueryPlanner = require("../query/queryPlanner");
const fs = require("node:fs");

class Collection {
    constructor(name, storage, validator = null, indexPath = null) {
        this.name = name;
        this.storage = storage;
        this.validator = validator;
        this.queryEngine = new QueryEngine();
        this.indexManager = new IndexManager();
        this.queryPlanner = new QueryPlanner(this.indexManager);
        this.indexPath = indexPath;
        this.loadIndexes();
        this.recordFileState();
    }

    loadIndexes() {
        this.indexManager.clear();
        if (!this.indexPath) return;
        const fs = require("node:fs");
        if (!fs.existsSync(this.indexPath)) return;
        for (const metadata of JSON.parse(fs.readFileSync(this.indexPath, "utf8"))) {
            const index = this.indexManager.createIndex(metadata.field, { unique: metadata.unique });
            for (const document of this.storage.read()) index.insert(document);
        }
    }

    saveIndexes() {
        if (!this.indexPath) return;
        const fs = require("node:fs");
        fs.writeFileSync(this.indexPath, JSON.stringify(this.listIndexes(), null, 2));
        this.recordFileState();
    }

    recordFileState() {
        this.dataMtime = this.fileMtime(this.storage.filePath);
        this.indexMtime = this.fileMtime(this.indexPath);
    }

    fileMtime(filePath) {
        return filePath && fs.existsSync(filePath) ? fs.statSync(filePath).mtimeMs : 0;
    }

    withFileLock(action) {
        const lockPath = `${this.storage.filePath}.lock`;
        let descriptor;
        try {
            for (;;) {
                try {
                    descriptor = fs.openSync(lockPath, "wx");
                    fs.writeFileSync(descriptor, String(process.pid), "utf8");
                    break;
                } catch (error) {
                    if (error.code !== "EEXIST") throw error;
                    try {
                        const owner = fs.readFileSync(lockPath, "utf8").trim();
                        let active = false;
                        try { active = Boolean(owner) && (process.kill(Number(owner), 0), true); } catch {}
                        if (!active) { fs.rmSync(lockPath, { force: true }); continue; }
                    } catch (lockError) {
                        if (lockError.code === "ENOENT") continue;
                        throw lockError;
                    }
                    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
                }
            }
            return action();
        } finally {
            if (descriptor !== undefined) fs.closeSync(descriptor);
            if (descriptor !== undefined) fs.rmSync(lockPath, { force: true });
        }
    }

    refreshFromDisk() {
        const dataMtime = this.fileMtime(this.storage.filePath);
        const indexMtime = this.fileMtime(this.indexPath);
        if (dataMtime !== this.dataMtime || indexMtime !== this.indexMtime) {
            this.loadIndexes();
            this.recordFileState();
        }
    }

    findAll() {
        this.refreshFromDisk();
        return this.storage.read();
    }

    find(filter = {}) {
        return new Query(this, filter);
    }

    insert(document) {
        return this.withFileLock(() => this.insertUnlocked(document));
    }

    insertUnlocked(document) {
        this.refreshFromDisk();
        this.validateDocument(document);

        const documents = this.storage.read();
        const nextDocuments = [...documents, document];

        this.indexManager.insert(document);

        try {
            this.storage.write(nextDocuments);
        } catch (error) {
            this.indexManager.remove(document);
            throw error;
        }

        this.recordFileState();
        return document;
    }

    deleteById(id) {
        return this.withFileLock(() => this.deleteByIdUnlocked(id));
    }

    deleteByIdUnlocked(id) {
        this.refreshFromDisk();
        const documents = this.storage.read();
        const document = documents.find(document => document.id === id);

        if (!document) {
            return;
        }

        const filteredDocuments = documents.filter(
            document => document.id !== id
        );

        this.storage.write(filteredDocuments);
        this.indexManager.remove(document);
        this.recordFileState();

        return document;
    }

    update(filter, update) {
        const documents = this.find(filter).exec();
        const updatedDocuments = documents.map(document =>
            this.applyUpdate(document, update)
        );

        for (const document of updatedDocuments) {
            this.updateById(document.id, document);
        }

        return updatedDocuments;
    }

    delete(filter) {
        const documents = this.find(filter).exec();

        for (const document of documents) {
            this.deleteById(document.id);
        }

        return documents;
    }

    replaceDocuments(documents) {
        return this.withFileLock(() => this.replaceDocumentsUnlocked(documents));
    }

    replaceDocumentsUnlocked(documents) {
        this.refreshFromDisk();
        for (const document of documents) {
            this.validateDocument(document);
        }

        this.storage.write(documents);
        this.indexManager.rebuild(documents);
        this.recordFileState();
    }

    updateById(id, updatedDocument) {
        return this.withFileLock(() => this.updateByIdUnlocked(id, updatedDocument));
    }

    updateByIdUnlocked(id, updatedDocument) {
        this.refreshFromDisk();
        this.validateDocument(updatedDocument);

        const documents = this.storage.read();
        const oldDocument = documents.find(document => document.id === id);

        if (!oldDocument) {
            throw new Error(`Document with id ${id} not found`);
        }

        const updatedDocuments = documents.map(document => {
            if (document.id === id) {
                return updatedDocument;
            }

            return document;
        });

        this.indexManager.remove(oldDocument);

        try {
            this.indexManager.insert(updatedDocument);
        } catch (error) {
            this.indexManager.insert(oldDocument);
            throw error;
        }

        try {
            this.storage.write(updatedDocuments);
        } catch (error) {
            this.indexManager.remove(updatedDocument);
            this.indexManager.insert(oldDocument);
            throw error;
        }

        this.recordFileState();
        return updatedDocument;
    }

    createIndex(field, options = {}) {
        return this.withFileLock(() => this.createIndexUnlocked(field, options));
    }

    createIndexUnlocked(field, options = {}) {
        const index = this.indexManager.createIndex(field, options);
        const documents = this.storage.read();

        try {
            for (const document of documents) {
                index.insert(document);
            }
        } catch (error) {
            this.indexManager.dropIndex(field);
            throw error;
        }

        this.saveIndexes();
        return index.getMetadata();
    }

    dropIndex(field) {
        return this.withFileLock(() => this.dropIndexUnlocked(field));
    }

    dropIndexUnlocked(field) {
        this.indexManager.dropIndex(field);
        this.saveIndexes();
    }

    listIndexes() {
        this.refreshFromDisk();
        return this.indexManager.listIndexes();
    }

    validateDocument(document) {
        if (!this.validator) {
            return;
        }

        const result = this.validator.validate(document);

        if (!result.valid) {
            const error = new Error("Document validation failed");
            error.details = result.errors;
            throw error;
        }
    }

    applyUpdate(document, update) {
        if (Object.keys(update).some(key => key.startsWith("$"))) {
            const result = { ...document };

            if (update.$set) {
                Object.assign(result, update.$set);
            }

            if (update.$inc) {
                for (const [field, amount] of Object.entries(update.$inc)) {
                    result[field] = (result[field] || 0) + amount;
                }
            }

            if (update.$unset) {
                for (const field of Object.keys(update.$unset)) {
                    delete result[field];
                }
            }

            return result;
        }

        return { ...update, id: document.id };
    }
}

module.exports = Collection;
