const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const DBServer = require("../server/dbServer");
const DatabaseManager = require("../core/databaseManager");

function request(client, command) {
    return new Promise((resolve, reject) => {
        const onData = data => {
            const line = data.toString().split("\n")[0];
            if (!line) return;
            client.off("data", onData);
            resolve(JSON.parse(line));
        };
        client.on("data", onData);
        client.write(`${JSON.stringify(command)}\n`, error => {
            if (error) reject(error);
        });
    });
}

test("TCP server executes database, query, index, and transaction commands", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "flexstore-server-"));
    const manager = new DatabaseManager(path.join(directory, "data"), path.join(directory, "schemas"));
    const server = new DBServer({ port: 0, databaseManager: manager, log: () => {} });
    await new Promise(resolve => server.start(resolve));
    const client = net.createConnection({ host: "127.0.0.1", port: server.port });
    await new Promise(resolve => client.once("connect", resolve));

    assert.deepEqual((await request(client, { command: "CREATE_DATABASE", name: "testdb" })).result, { name: "testdb", created: true });
    assert.deepEqual((await request(client, { command: "USE", name: "testdb" })).result, { name: "testdb", selected: true });
    assert.deepEqual((await request(client, { command: "CREATE_COLLECTION", collection: "users" })).result, { name: "users", created: true });
    assert.equal((await request(client, { command: "INSERT", collection: "users", document: { id: 1, email: "a@example.com" } })).success, true);
    assert.deepEqual((await request(client, { command: "FIND", collection: "users", query: { email: "a@example.com" } })).result[0].id, 1);

    await request(client, { command: "CREATE_INDEX", collection: "users", field: "email" });
    const index = await request(client, { command: "EXPLAIN", collection: "users", query: { email: "a@example.com" } });
    assert.equal(index.result.plan.type, "INDEX_SCAN");
    await request(client, { command: "BEGIN" });
    await request(client, { command: "INSERT", collection: "users", document: { id: 2, email: "b@example.com" } });
    await request(client, { command: "ROLLBACK" });
    assert.equal((await request(client, { command: "COUNT", collection: "users", query: {} })).result, 1);
    await request(client, { command: "BEGIN" });
    await request(client, { command: "INSERT", collection: "users", document: { id: 3, email: "c@example.com" } });
    assert.equal((await request(client, { command: "COMMIT" })).result.status, "COMMITTED");
    assert.equal((await request(client, { command: "COUNT", collection: "users", query: {} })).result, 2);

    client.end();
    await server.stop();
    fs.rmSync(directory, { recursive: true, force: true });
});