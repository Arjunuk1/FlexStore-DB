const express = require("express");
const path = require("path");

const Database = require("../core/database");

const router = express.Router();

const db = new Database(
    path.join(__dirname, "..", "data")
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