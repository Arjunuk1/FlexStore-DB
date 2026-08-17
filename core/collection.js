class Collection {
    constructor(name, storage) {
        this.name = name;
        this.storage = storage;
    }

    findAll() {
        return this.storage.read();
    }

    insert(document) {
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
}

module.exports = Collection;
