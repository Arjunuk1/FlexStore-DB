const QueryEngine = require("../query/queryEngine");
const Query = require("../query/query");
const IndexManager = require("../index/indexManager");
const QueryPlanner = require("../query/queryPlanner");

class Collection {
    constructor(name, storage, validator = null) {
        this.name = name;
        this.storage = storage;
        this.validator = validator;
        this.queryEngine = new QueryEngine();
        this.indexManager = new IndexManager();
        this.queryPlanner = new QueryPlanner(this.indexManager);
    }

    findAll() {
        return this.storage.read();
    }

    find(filter = {}) {
        return new Query(this, filter);
    }

    insert(document) {
        this.validateDocument(document);

        const documents = this.storage.read();

        documents.push(document);

        this.storage.write(documents);
        this.indexManager.insert(document);

        return document;
    }

    deleteById(id) {
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
    }

    updateById(id, updatedDocument) {
        this.validateDocument(updatedDocument);

        const documents = this.storage.read();
        const oldDocument = documents.find(document => document.id === id);

        if (!oldDocument) {
            throw new Error(`Document with id ${id} not found`);
        }

        this.indexManager.remove(oldDocument);

        const updatedDocuments = documents.map(document => {
            if (document.id === id) {
                return updatedDocument;
            }

            return document;
        });

        this.storage.write(updatedDocuments);
        this.indexManager.insert(updatedDocument);

        return updatedDocument;
    }

    createIndex(field) {
        const index = this.indexManager.createIndex(field);
        const documents = this.storage.read();

        for (const document of documents) {
            index.insert(document);
        }

        return {
            field,
            type: "hash"
        };
    }

    dropIndex(field) {
        this.indexManager.dropIndex(field);
    }

    listIndexes() {
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
}

module.exports = Collection;
