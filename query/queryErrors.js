class QueryOptionError extends Error {
    constructor(message) {
        super(message);
        this.name = "QueryOptionError";
    }
}

module.exports = { QueryOptionError };
