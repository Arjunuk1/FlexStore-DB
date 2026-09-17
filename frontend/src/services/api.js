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
    getDocuments: (query = {}, options = {}) => request("/api/query", { method: "POST", body: JSON.stringify({ filter: query, ...options }) }),
    insertDocument: document => request("/api/create", { method: "POST", body: JSON.stringify(document) }),
    updateDocument: (id, document) => request(`/api/edit/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(document) }),
    deleteDocument: id => request(`/api/delete/${encodeURIComponent(id)}`, { method: "DELETE" }),
    getAll: () => request("/api/all"),
    query: (filter, options = {}) => request("/api/query", { method: "POST", body: JSON.stringify({ filter, ...options }) }),
    explain: filter => request("/api/query/explain", { method: "POST", body: JSON.stringify({ filter }) }),
    getIndexes: () => request("/api/indexes"),
    createIndex: (field, options = {}) => request("/api/index", { method: "POST", body: JSON.stringify({ field, options }) }),
    deleteIndex: field => request(`/api/index/${encodeURIComponent(field)}`, { method: "DELETE" }),
    beginTransaction: () => request("/api/transactions", { method: "POST" }),
    getTransactions: () => request("/api/transactions"),
    getTransaction: id => request(`/api/transactions/${encodeURIComponent(id)}`),
    stageOperation: (id, operation) => request(`/api/transactions/${encodeURIComponent(id)}/operations`, { method: "POST", body: JSON.stringify(operation) }),
    commitTransaction: id => request(`/api/transactions/${encodeURIComponent(id)}/commit`, { method: "POST" }),
    rollbackTransaction: id => request(`/api/transactions/${encodeURIComponent(id)}/rollback`, { method: "POST" }),
    getWal: () => request("/api/transactions/wal")
};
