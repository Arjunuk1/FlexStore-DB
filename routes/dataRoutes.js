const express = require("express");
const path = require("path");

const Database = require("../core/database");

const router = express.Router();

const db = new Database(
    path.join(__dirname, "..", "data"),
    path.join(__dirname, "..", "schemas")
);

const users = db.collection("users");

router.post("/transactions", (req, res) => {
    try {
        const transaction = db.beginTransaction();
        res.status(201).json({
            message: "Transaction started",
            transaction: transaction.getInfo()
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get("/transactions", (req, res) => {
    res.json({
        transactions: db.transactionManager.listActiveTransactions()
    });
});

router.get("/transactions/wal", (req, res) => {
    try {
        const records = db.transactionManager.wal.readAll();
        res.json({ count: records.length, records });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post("/transactions/checkpoint", (req, res) => {
    try {
        db.transactionManager.checkpoint();
        res.json({ message: "WAL checkpoint completed" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post("/transactions/:id/operations", (req, res) => {
    try {
        const transaction = db.transactionManager.getTransaction(req.params.id);

        if (!transaction) {
            return res.status(404).json({ message: "Transaction not found" });
        }

        const { type, collection, document, filter, update, id } = req.body;

        if (type === "INSERT") {
            transaction.insert(collection, document);
        } else if (type === "UPDATE") {
            transaction.update(collection, filter || { id }, update || document);
        } else if (type === "DELETE") {
            transaction.delete(collection, filter || { id });
        } else {
            return res.status(400).json({ message: "Unsupported transaction operation" });
        }

        return res.json({ message: "Operation staged", transaction: transaction.getInfo() });
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
});

router.post("/transactions/:id/commit", async (req, res) => {
    try {
        const transaction = db.transactionManager.getTransaction(req.params.id);

        if (!transaction) {
            return res.status(404).json({ message: "Transaction not found" });
        }

        return res.json({
            message: "Transaction committed",
            transaction: await transaction.commit()
        });
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
});

router.post("/transactions/:id/rollback", (req, res) => {
    try {
        const transaction = db.transactionManager.getTransaction(req.params.id);

        if (!transaction) {
            return res.status(404).json({ message: "Transaction not found" });
        }

        return res.json({
            message: "Transaction rolled back",
            transaction: transaction.rollback()
        });
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
});

router.get("/transactions/:id", (req, res) => {
    const transaction = db.transactionManager.getTransaction(req.params.id);

    if (!transaction) {
        return res.status(404).json({ message: "Transaction not found or already completed" });
    }

    return res.json(transaction.getInfo());
});

router.post("/index", (req, res) => {
    try {
        const { field, options = {} } = req.body;

        if (!field || typeof field !== "string") {
            return res.status(400).json({
                message: "A valid index field is required"
            });
        }

        const index = users.createIndex(field, options);

        res.status(201).json({
            message: "Index created",
            index
        });
    } catch (error) {
        console.error(error);

        res.status(400).json({
            message: error.message
        });
    }
});

router.get("/indexes", (req, res) => {
    try {
        res.json({
            indexes: users.listIndexes()
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to list indexes"
        });
    }
});

router.delete("/index/:field", (req, res) => {
    try {
        users.dropIndex(req.params.field);

        res.json({
            message: `Index dropped: ${req.params.field}`
        });
    } catch (error) {
        console.error(error);

        res.status(400).json({
            message: error.message
        });
    }
});

router.post("/query/explain", (req, res) => {
    try {
        const { filter = {} } = req.body;
        const explanation = users.find(filter).explain();

        res.json(explanation);
    } catch (error) {
        console.error(error);

        res.status(400).json({
            message: error.message
        });
    }
});

// GET all data
router.get("/all", (req, res) => {
    try {
        const data = users.findAll();

        res.json(data);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to read data"
        });
    }
});

// Query collection data without changing the existing UI search behavior.
router.post("/query", (req, res) => {
    try {
        const {
            filter = {},
            sort,
            skip = 0,
            limit,
            select
        } = req.body;

        let query = users.find(filter);

        if (sort) {
            query = query.sort(sort);
        }

        query = query.skip(skip);

        if (limit !== undefined) {
            query = query.limit(limit);
        }

        if (select) {
            query = query.select(select);
        }

        const results = query.exec();

        res.json({
            count: results.length,
            data: results
        });
    } catch (error) {
        console.error(error);

        res.status(400).json({
            message: error.message
        });
    }
});

// CREATE new data
router.post("/create", (req, res) => {
    try {
        const record = {
            id: Date.now(),
            ...req.body
        };

        users.insert(record);

        res.status(201).json({
            message: "Record added successfully",
            data: record
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to create record"
        });
    }
});

// DELETE data
router.delete("/delete/:id", (req, res) => {
    try {
        const id = Number(req.params.id);

        users.deleteById(id);

        res.json({
            message: "Data deleted"
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to delete data"
        });
    }
});

router.put("/edit/:id", (req, res) => {
    try {
        const id = Number(req.params.id);

        const updatedRecord = {
            id,
            ...req.body
        };

        users.updateById(id, updatedRecord);

        res.json({
            message: "Record updated",
            data: updatedRecord
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to update record"
        });
    }
});

module.exports = router;
