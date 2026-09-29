const request = async (endpoint, options = {}) => {
    const response = await fetch(endpoint, {
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        },
        ...options
    });

    let data = {};
    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok) {
        const detail = data.details?.length ? `: ${data.details.join(", ")}` : "";
        throw new Error(`${data.error || data.message || `Request failed (${response.status})`}${detail}`);
    }

    return data;
};

export const api = {
    login: (username, password) => request("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
    register: (username, password) => request("/auth/register", { method: "POST", body: JSON.stringify({ username, password }) }),
    me: () => request("/auth/me"),
    logout: () => request("/auth/logout", { method: "POST" }),
    getDatabases: () => request("/api/databases"),
    createDatabase: name => request("/api/databases", { method: "POST", body: JSON.stringify({ name }) }),
    deleteDatabase: database => request(`/api/databases/${encodeURIComponent(database)}`, { method: "DELETE" }),
    getCollections: database => request(`/api/databases/${encodeURIComponent(database)}/collections`),
    createCollection: (database, name) => request(`/api/databases/${encodeURIComponent(database)}/collections`, { method: "POST", body: JSON.stringify({ name }) }),
    deleteCollection: (database, collection) => request(`/api/databases/${encodeURIComponent(database)}/collections/${encodeURIComponent(collection)}`, { method: "DELETE" }),
    getDocuments: (database, collection, options = {}) => request("/api/query", { method: "POST", body: JSON.stringify({ database, collection, ...options }) }),
    insertDocument: (database, collection, document) => request(`/api/databases/${encodeURIComponent(database)}/collections/${encodeURIComponent(collection)}/documents`, { method: "POST", body: JSON.stringify(document) }),
    updateDocument: (database, collection, id, document) => request(`/api/databases/${encodeURIComponent(database)}/collections/${encodeURIComponent(collection)}/documents/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(document) }),
    deleteDocument: (database, collection, id) => request(`/api/databases/${encodeURIComponent(database)}/collections/${encodeURIComponent(collection)}/documents/${encodeURIComponent(id)}`, { method: "DELETE" }),
    query: (database, collection, filter, options = {}) => request("/api/query", { method: "POST", body: JSON.stringify({ database, collection, filter, ...options }) }),
    explain: (database, collection, filter) => request("/api/query/explain", { method: "POST", body: JSON.stringify({ database, collection, filter }) }),
    getIndexes: (database, collection) => request(`/api/databases/${encodeURIComponent(database)}/collections/${encodeURIComponent(collection)}/indexes`),
    createIndex: (database, collection, field, options = {}) => request(`/api/databases/${encodeURIComponent(database)}/collections/${encodeURIComponent(collection)}/indexes`, { method: "POST", body: JSON.stringify({ field, options }) }),
    deleteIndex: (database, collection, field) => request(`/api/databases/${encodeURIComponent(database)}/collections/${encodeURIComponent(collection)}/indexes/${encodeURIComponent(field)}`, { method: "DELETE" }),
    getSchema: (database, collection) => request(`/api/databases/${encodeURIComponent(database)}/collections/${encodeURIComponent(collection)}/schema`),
    updateSchema: (database, collection, schema) => request(`/api/databases/${encodeURIComponent(database)}/collections/${encodeURIComponent(collection)}/schema`, { method: "PUT", body: JSON.stringify({ schema }) }),
    beginTransaction: database => request("/api/transactions", { method: "POST", body: JSON.stringify({ database }) }),
    getTransactions: database => request(`/api/transactions?database=${encodeURIComponent(database)}`),
    stageOperation: (database, id, operation) => request(`/api/transactions/${encodeURIComponent(id)}/operations`, { method: "POST", body: JSON.stringify({ database, ...operation }) }),
    commitTransaction: (database, id) => request(`/api/transactions/${encodeURIComponent(id)}/commit`, { method: "POST", body: JSON.stringify({ database }) }),
    rollbackTransaction: (database, id) => request(`/api/transactions/${encodeURIComponent(id)}/rollback`, { method: "POST", body: JSON.stringify({ database }) }),
    getWal: database => request(`/api/transactions/wal?database=${encodeURIComponent(database)}`),
    getStatus: () => request("/api/status")
};
