const express = require("express");
const path = require("path");

const Database = require("../core/database");

const router = express.Router();

const db = new Database(
    path.join(__dirname, "..", "data"),
    path.join(__dirname, "..", "schemas")
);

const users = db.collection("users");

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
