class QueryPlanner {
    constructor(indexManager) {
        this.indexManager = indexManager;
    }

    createPlan(filter) {
        const fields = Object.keys(filter);

        if (fields.length !== 1) {
            return { type: "COLLECTION_SCAN" };
        }

        const field = fields[0];
        const condition = filter[field];

        if (typeof condition === "object" && condition !== null) {
            return { type: "COLLECTION_SCAN" };
        }

        if (this.indexManager.hasIndex(field)) {
            return {
                type: "INDEX_SCAN",
                field,
                value: condition
            };
        }

        return { type: "COLLECTION_SCAN" };
    }
}

module.exports = QueryPlanner;
