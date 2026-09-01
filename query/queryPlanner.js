class QueryPlanner {
    constructor(indexManager) {
        this.indexManager = indexManager;
    }

    createPlan(filter = {}) {
        const fields = Object.keys(filter);

        if (fields.length === 0) {
            return {
                type: "COLLECTION_SCAN",
                reason: "No filter provided"
            };
        }

        for (const field of fields) {
            const condition = filter[field];
            const isEqualityQuery =
                typeof condition !== "object" || condition === null;

            if (isEqualityQuery && this.indexManager.hasIndex(field)) {
                return {
                    type: "INDEX_SCAN",
                    index: field,
                    field,
                    value: condition,
                    reason: "Indexed equality lookup"
                };
            }
        }

        return {
            type: "COLLECTION_SCAN",
            reason: "No suitable index found for query"
        };
    }
}

module.exports = QueryPlanner;
