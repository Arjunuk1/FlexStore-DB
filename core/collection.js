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
        const nextDocuments = [...documents, document];

        this.indexManager.insert(document);

        try {
            this.storage.write(nextDocuments);
        } catch (error) {
            this.indexManager.remove(document);
            throw error;
        }

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

        return updatedDocument;
    }

    createIndex(field, options = {}) {
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

        return index.getMetadata();
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
