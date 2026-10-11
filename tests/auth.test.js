const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");

const usersPath = path.join(__dirname, "..", "users.json");
const app = require("../server");

function request(baseUrl, route, options = {}) {
    return fetch(`${baseUrl}${route}`, {
        ...options,
        headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    }).then(async response => ({ response, body: await response.json() }));
}

test("authentication rejects invalid credentials, protects APIs, and invalidates logout", async () => {
    const originalUsers = fs.readFileSync(usersPath, "utf8");
    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    try {
        fs.writeFileSync(usersPath, "[]");
        let result = await request(baseUrl, "/api/status");
        assert.equal(result.response.status, 401);
        result = await request(baseUrl, "/auth/login", { method: "POST", body: JSON.stringify({ username: "no", password: "short" }) });
        assert.equal(result.response.status, 400);
        result = await request(baseUrl, "/auth/register", { method: "POST", body: JSON.stringify({ username: "audit_user", password: "correct-password" }) });
        assert.equal(result.response.status, 201);
        result = await request(baseUrl, "/auth/login", { method: "POST", body: JSON.stringify({ username: "audit_user", password: "wrong-password" }) });
        assert.equal(result.response.status, 401);
        result = await request(baseUrl, "/auth/login", { method: "POST", body: JSON.stringify({ username: "audit_user", password: "correct-password" }) });
        assert.equal(result.response.status, 200);
        const session = result.response.headers.get("set-cookie").split(";")[0];
        assert.match(result.response.headers.get("set-cookie"), /HttpOnly/);
        assert.match(result.response.headers.get("set-cookie"), /SameSite=Lax/);
        result = await request(baseUrl, "/api/status", { headers: { Cookie: session } });
        assert.equal(result.response.status, 200);
        result = await request(baseUrl, "/auth/logout", { method: "POST", headers: { Cookie: session } });
        assert.equal(result.response.status, 200);
        assert.match(result.response.headers.get("set-cookie"), /Max-Age=0/);
        result = await request(baseUrl, "/api/status", { headers: { Cookie: session } });
        assert.equal(result.response.status, 401);
    } finally {
        fs.writeFileSync(usersPath, originalUsers);
        await new Promise(resolve => server.close(resolve));
    }
});

test("production authentication fails clearly without a strong session secret", async () => {
    const previousEnvironment = process.env.NODE_ENV;
    const previousSecret = process.env.FLEXSTORE_SESSION_SECRET;
    delete process.env.FLEXSTORE_SESSION_SECRET;
    process.env.NODE_ENV = "production";
    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    try {
        const result = await request(`http://127.0.0.1:${server.address().port}`, "/auth/login", { method: "POST", body: JSON.stringify({ username: "audit_user", password: "correct-password" }) });
        assert.equal(result.response.status, 500);
        assert.match(result.body.message, /FLEXSTORE_SESSION_SECRET/);
    } finally {
        await new Promise(resolve => server.close(resolve));
        if (previousEnvironment === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previousEnvironment;
        if (previousSecret === undefined) delete process.env.FLEXSTORE_SESSION_SECRET;
        else process.env.FLEXSTORE_SESSION_SECRET = previousSecret;
    }
});
