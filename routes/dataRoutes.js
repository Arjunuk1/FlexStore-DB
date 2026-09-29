const express = require("express");
const path = require("node:path");
const DatabaseManager = require("../core/databaseManager");

const router = express.Router();
const databaseManager = new DatabaseManager(
    path.join(__dirname, "..", "data", "databases"),
    path.join(__dirname, "..", "schemas", "databases")
);

function database(req) {
    return databaseManager.getDatabase(req.params.database || req.body.database || req.query.database);
}

function collection(req) {
    const name = req.params.collection || req.body.collection;
    if (!name) throw new Error("A collection is required");
    return database(req).collection(name);
}

function failure(res, error, status = 400) {
    return res.status(status).json({ message: error.message, details: error.details });
}

router.get("/databases", (req, res) => res.json({ databases: databaseManager.listDatabases() }));
router.post("/databases", (req, res) => { try { return res.status(201).json(databaseManager.createDatabase(req.body.name)); } catch (error) { return failure(res, error); } });
router.delete("/databases/:database", (req, res) => { try { return res.json(databaseManager.dropDatabase(req.params.database)); } catch (error) { return failure(res, error); } });

router.get("/databases/:database/collections", (req, res) => { try { return res.json({ collections: database(req).listCollections() }); } catch (error) { return failure(res, error); } });
router.post("/databases/:database/collections", (req, res) => { try { return res.status(201).json(database(req).createCollection(req.body.name || req.body.collection)); } catch (error) { return failure(res, error); } });
router.delete("/databases/:database/collections/:collection", (req, res) => { try { return res.json(database(req).dropCollection(req.params.collection)); } catch (error) { return failure(res, error); } });

router.get("/databases/:database/collections/:collection/documents", (req, res) => {
    try {
        const query = collection(req).find(req.query.filter ? JSON.parse(req.query.filter) : {});
        const data = query.exec();
        return res.json({ count: data.length, data });
    } catch (error) { return failure(res, error); }
});
router.post("/databases/:database/collections/:collection/documents", (req, res) => {
    try {
        const document = { ...req.body, id: req.body.id ?? Date.now() };
        return res.status(201).json({ message: "Document inserted", data: collection(req).insert(document) });
    } catch (error) { return failure(res, error); }
});
router.put("/databases/:database/collections/:collection/documents/:id", (req, res) => {
    try { const id = Number(req.params.id); return res.json({ message: "Document updated", data: collection(req).updateById(id, { ...req.body, id }) }); } catch (error) { return failure(res, error); }
});
router.delete("/databases/:database/collections/:collection/documents/:id", (req, res) => {
    try { return res.json({ message: "Document deleted", data: collection(req).deleteById(Number(req.params.id)) }); } catch (error) { return failure(res, error); }
});

router.get("/databases/:database/collections/:collection/indexes", (req, res) => { try { return res.json({ indexes: collection(req).listIndexes() }); } catch (error) { return failure(res, error); } });
router.post("/databases/:database/collections/:collection/indexes", (req, res) => { try { return res.status(201).json({ message: "Index created", index: collection(req).createIndex(req.body.field, req.body.options || {}) }); } catch (error) { return failure(res, error); } });
router.delete("/databases/:database/collections/:collection/indexes/:field", (req, res) => { try { collection(req).dropIndex(req.params.field); return res.json({ message: "Index deleted" }); } catch (error) { return failure(res, error); } });
router.get("/databases/:database/collections/:collection/schema", (req, res) => { try { return res.json({ schema: database(req).getSchema(req.params.collection) }); } catch (error) { return failure(res, error); } });
router.put("/databases/:database/collections/:collection/schema", (req, res) => { try { return res.json({ schema: database(req).updateSchema(req.params.collection, req.body.schema || req.body) }); } catch (error) { return failure(res, error); } });

router.post("/query", (req, res) => {
    try {
        const query = collection(req).find(req.body.filter || {});
        if (req.body.sort) query.sort(req.body.sort);
        if (req.body.skip !== undefined) query.skip(req.body.skip);
        if (req.body.limit !== undefined) query.limit(req.body.limit);
        if (req.body.select) query.select(req.body.select);
        const data = query.exec();
        return res.json({ count: data.length, data, stats: query.getStats() });
    } catch (error) { return failure(res, error); }
});
router.post("/query/explain", (req, res) => { try { return res.json(collection(req).find(req.body.filter || {}).explain()); } catch (error) { return failure(res, error); } });

router.get("/transactions", (req, res) => { try { return res.json({ transactions: database(req).transactionManager.listActiveTransactions() }); } catch (error) { return failure(res, error); } });
router.post("/transactions", (req, res) => { try { const transaction = database(req).beginTransaction(); return res.status(201).json({ message: "Transaction started", transaction: transaction.getInfo() }); } catch (error) { return failure(res, error); } });
router.get("/transactions/wal", (req, res) => { try { const records = database(req).transactionManager.wal.readAll(); return res.json({ count: records.length, records }); } catch (error) { return failure(res, error); } });
router.post("/transactions/:id/operations", (req, res) => {
    try {
        const transaction = database(req).transactionManager.getTransaction(req.params.id);
        if (!transaction) return res.status(404).json({ message: "Transaction not found" });
        const { type, collection: name, document, filter, update, id } = req.body;
        if (type === "INSERT") transaction.insert(name, document);
        else if (type === "UPDATE") transaction.update(name, filter || { id }, update || document);
        else if (type === "DELETE") transaction.delete(name, filter || { id });
        else return res.status(400).json({ message: "Unsupported transaction operation" });
        return res.json({ message: "Operation staged", transaction: transaction.getInfo() });
    } catch (error) { return failure(res, error); }
});
router.post("/transactions/:id/commit", (req, res) => { try { const transaction = database(req).transactionManager.getTransaction(req.params.id); if (!transaction) return res.status(404).json({ message: "Transaction not found" }); return res.json({ message: "Transaction committed", transaction: transaction.commit() }); } catch (error) { return failure(res, error); } });
router.post("/transactions/:id/rollback", (req, res) => { try { const transaction = database(req).transactionManager.getTransaction(req.params.id); if (!transaction) return res.status(404).json({ message: "Transaction not found" }); return res.json({ message: "Transaction rolled back", transaction: transaction.rollback() }); } catch (error) { return failure(res, error); } });

router.get("/status", (req, res) => res.json({ server: "ONLINE", storage: "JSON", wal: true, transactions: true, recovery: "ENABLED", databases: databaseManager.listDatabases() }));
router.get("/info", (req, res) => res.json({ name: "FlexStore DB", version: "1.0", storageEngine: "JSON", queryEngine: "Custom", index: "Hash Index", transactions: true, wal: true, crashRecovery: true }));

module.exports = router;
module.exports.databaseManager = databaseManager;