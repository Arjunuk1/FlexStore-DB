const QueryEngine = require("../query/queryEngine");
const Query = require("../query/query");

class Collection {
    constructor(name, storage, validator = null) {
        this.name = name;
        this.storage = storage;
        this.validator = validator;
        this.queryEngine = new QueryEngine();
    }

    findAll() {
        return this.storage.read();
    }

    find(query = {}) {
        return new Query(
            this.storage.read(),
            this.queryEngine,
            query
        );
    }

    insert(document) {
        this.validateDocument(document);

        const documents = this.storage.read();

        documents.push(document);

        this.storage.write(documents);

        return document;
    }

    deleteById(id) {
        const documents = this.storage.read();

        const filteredDocuments = documents.filter(
            document => document.id !== id
        );

        this.storage.write(filteredDocuments);
    }

    updateById(id, updatedDocument) {
        this.validateDocument(updatedDocument);

        const documents = this.storage.read();

        const updatedDocuments = documents.map(document => {
            if (document.id === id) {
                return updatedDocument;
            }

            return document;
        });

        this.storage.write(updatedDocuments);

        return updatedDocument;
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
