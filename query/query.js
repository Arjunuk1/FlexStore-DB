const { QueryOptionError } = require("./queryErrors");

class Query {
    constructor(collection, filter = {}) {
        this.collection = collection;
        this.filter = filter;

        this.sortOptions = null;
        this.skipCount = 0;
        this.limitCount = null;
        this.projection = null;
    }

    sort(options) {
        if (!this.isPlainObject(options)) {
            throw new QueryOptionError("sort must be an object");
        }

        for (const direction of Object.values(options)) {
            if (direction !== 1 && direction !== -1) {
                throw new QueryOptionError(
                    "sort directions must be either 1 or -1"
                );
            }
        }

        this.sortOptions = options;

        return this;
    }

    skip(count) {
        this.assertNonNegativeInteger(count, "skip");
        this.skipCount = count;

        return this;
    }

    limit(count) {
        this.assertNonNegativeInteger(count, "limit");
        this.limitCount = count;

        return this;
    }

    select(fields) {
        if (!Array.isArray(fields) || fields.some(field => typeof field !== "string")) {
            throw new QueryOptionError("select must be an array of field names");
        }

        this.projection = fields;

        return this;
    }

    exec() {
        const documents = this.collection.storage.read();
        const plan = this.collection.queryPlanner.createPlan(this.filter);
        let candidateDocuments = documents;

        if (plan.type === "INDEX_SCAN") {
            const index = this.collection.indexManager.getIndex(plan.field);
            const ids = index.find(plan.value);
            const idSet = new Set(ids);

            candidateDocuments = documents.filter(document => idSet.has(document.id));
        }

        let results = this.collection.queryEngine.find(
            candidateDocuments,
            this.filter
        );

        if (this.sortOptions) {
            results = this.applySort(results, this.sortOptions);
        }

        if (this.skipCount > 0) {
            results = results.slice(this.skipCount);
        }

        if (this.limitCount !== null) {
            results = results.slice(0, this.limitCount);
        }

        if (this.projection) {
            results = this.applyProjection(results, this.projection);
        }

        return results;
    }

    explain() {
        return this.collection.queryPlanner.createPlan(this.filter);
    }

    applySort(documents, sortOptions) {
        return [...documents].sort((a, b) => {
            for (const [field, direction] of Object.entries(sortOptions)) {
                const aValue = this.getValue(a, field);
                const bValue = this.getValue(b, field);

                if (aValue === bValue) {
                    continue;
                }

                if (aValue === undefined) {
                    return 1;
                }

                if (bValue === undefined) {
                    return -1;
                }

                if (aValue < bValue) {
                    return direction === 1 ? -1 : 1;
                }

                if (aValue > bValue) {
                    return direction === 1 ? 1 : -1;
                }
            }

            return 0;
        });
    }

    applyProjection(documents, fields) {
        return documents.map(document => {
            const projected = {};

            for (const field of fields) {
                const value = this.getValue(document, field);

                if (value !== undefined) {
                    projected[field] = value;
                }
            }

            return projected;
        });
    }

    getValue(document, field) {
        return field.split(".").reduce((value, part) => {
            if (value === null || value === undefined) {
                return undefined;
            }

            return value[part];
        }, document);
    }

    assertNonNegativeInteger(value, optionName) {
        if (!Number.isInteger(value) || value < 0) {
            throw new QueryOptionError(
                `${optionName} must be a non-negative integer`
            );
        }
    }

    isPlainObject(value) {
        return (
            value !== null &&
            typeof value === "object" &&
            !Array.isArray(value)
        );
    }
}

module.exports = Query;
