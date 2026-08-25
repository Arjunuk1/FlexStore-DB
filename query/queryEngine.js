class QueryEngine {
    find(documents, query = {}) {
        return documents.filter(document => this.matches(document, query));
    }

    matches(document, query) {
        for (const [field, condition] of Object.entries(query)) {
            if (field === "$and") {
                if (!this.matchAnd(document, condition)) {
                    return false;
                }

                continue;
            }

            if (field === "$or") {
                if (!this.matchOr(document, condition)) {
                    return false;
                }

                continue;
            }

            if (field === "$not") {
                if (this.matches(document, condition)) {
                    return false;
                }

                continue;
            }

            const value = this.getValue(document, field);

            if (!this.matchesCondition(value, condition)) {
                return false;
            }
        }

        return true;
    }

    matchAnd(document, conditions) {
        if (!Array.isArray(conditions)) {
            throw new Error("$and expects an array of query conditions");
        }

        return conditions.every(condition => this.matches(document, condition));
    }

    matchOr(document, conditions) {
        if (!Array.isArray(conditions)) {
            throw new Error("$or expects an array of query conditions");
        }

        return conditions.some(condition => this.matches(document, condition));
    }

    matchesCondition(value, condition) {
        if (
            condition === null ||
            typeof condition !== "object" ||
            Array.isArray(condition)
        ) {
            return value === condition;
        }

        for (const [operator, expected] of Object.entries(condition)) {
            switch (operator) {
                case "$eq":
                    if (value !== expected) {
                        return false;
                    }
                    break;

                case "$ne":
                    if (value === expected) {
                        return false;
                    }
                    break;

                case "$gt":
                    if (!(value > expected)) {
                        return false;
                    }
                    break;

                case "$gte":
                    if (!(value >= expected)) {
                        return false;
                    }
                    break;

                case "$lt":
                    if (!(value < expected)) {
                        return false;
                    }
                    break;

                case "$lte":
                    if (!(value <= expected)) {
                        return false;
                    }
                    break;

                case "$in":
                    if (!Array.isArray(expected)) {
                        throw new Error("$in expects an array");
                    }

                    if (!expected.includes(value)) {
                        return false;
                    }
                    break;

                case "$nin":
                    if (!Array.isArray(expected)) {
                        throw new Error("$nin expects an array");
                    }

                    if (expected.includes(value)) {
                        return false;
                    }
                    break;

                case "$exists":
                    if (typeof expected !== "boolean") {
                        throw new Error("$exists expects a boolean");
                    }

                    if (expected !== (value !== undefined)) {
                        return false;
                    }
                    break;

                default:
                    throw new Error(`Unsupported query operator: ${operator}`);
            }
        }

        return true;
    }

    getValue(document, field) {
        return field.split(".").reduce((value, part) => {
            if (value === null || value === undefined) {
                return undefined;
            }

            return value[part];
        }, document);
    }
}

module.exports = QueryEngine;
