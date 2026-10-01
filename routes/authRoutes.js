const express = require("express");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const router = express.Router();
const usersPath = path.join(__dirname, "..", "users.json");
const secret = process.env.FLEXSTORE_SESSION_SECRET || "flexstore-development-session-secret";

function readUsers() { return JSON.parse(fs.readFileSync(usersPath, "utf8")); }
function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) { return `${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`; }
function validPassword(password, stored) {
    if (typeof password !== "string" || typeof stored !== "string") return false;
    if (stored.includes(":")) {
        const [salt, hash] = stored.split(":");
        if (!salt || !/^[0-9a-f]+$/i.test(hash) || hash.length !== 128) return false;
        return crypto.timingSafeEqual(Buffer.from(hash, "hex"), crypto.scryptSync(password, salt, 64));
    }
    return false;
}
function token(username) { const payload = Buffer.from(JSON.stringify({ username, expires: Date.now() + 86400000 })).toString("base64url"); return `${payload}.${crypto.createHmac("sha256", secret).update(payload).digest("base64url")}`; }
function userFromRequest(req) {
    const value = req.headers.cookie?.split(";").map(item => item.trim()).find(item => item.startsWith("flexstore_session="))?.split("=")[1];
    if (!value) return null;
    const [payload, signature] = value.split(".");
    const expected = crypto.createHmac("sha256", secret).update(payload || "").digest("base64url");
    if (!payload || !signature || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    try {
        const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
        return data.expires > Date.now() ? data.username : null;
    } catch {
        return null;
    }
}
function cookie(value, maxAge = 86400) { return `flexstore_session=${value}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}`; }

router.post("/register", (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: "Username and password are required" });
    const users = readUsers();
    if (users.some(user => user.username === username)) return res.status(400).json({ message: "Username already exists" });
    users.push({ username, password: hashPassword(password) });
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
    return res.status(201).json({ message: "Registration successful" });
});

router.post("/login", (req, res) => {
    const { username, password } = req.body;
    const users = readUsers();
    const user = users.find(item => item.username === username);
    if (!user || !validPassword(password, user.password)) return res.status(401).json({ message: "Invalid username or password" });
    if (!user.password.includes(":")) { user.password = hashPassword(password); fs.writeFileSync(usersPath, JSON.stringify(users, null, 2)); }
    res.setHeader("Set-Cookie", cookie(token(username)));
    return res.json({ message: "Login successful", user: { username } });
});

router.post("/logout", (req, res) => { res.setHeader("Set-Cookie", cookie("", 0)); return res.json({ message: "Logged out" }); });
router.get("/me", (req, res) => { const username = userFromRequest(req); return username ? res.json({ authenticated: true, username }) : res.status(401).json({ authenticated: false }); });

function requireAuth(req, res, next) { const username = userFromRequest(req); if (!username) return res.status(401).json({ message: "Authentication required" }); req.user = { username }; return next(); }

module.exports = router;
module.exports.requireAuth = requireAuth;