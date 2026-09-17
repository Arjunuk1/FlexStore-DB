const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

// Allows backend to read JSON sent from frontend
app.use(express.json());

// Import routes
const dataRoutes = require("./routes/dataRoutes");
const authRoutes = require("./routes/authRoutes");
app.use("/api", dataRoutes);
app.use("/auth", authRoutes);

const frontendPath = path.join(__dirname, "frontend", "dist");
app.use(express.static(frontendPath));

app.get("/{*splat}", (req, res) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/auth")) {
        return res.status(404).json({ error: "API endpoint not found" });
    }

    return res.sendFile(path.join(frontendPath, "index.html"));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});