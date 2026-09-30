# FlexStore DB

FlexStore DB is a schema-flexible JSON document database with one persistent
storage layout shared by the REST API, TCP server, CLI, and React management
console. Data lives under `data/databases/<database>` and schemas live under
`schemas/databases/<database>`.

Express and the TCP server use the same `DatabaseManager` path configuration,
so writes made through either interface are visible to the other after reload.

## Installation

```sh
npm install
npm --prefix frontend install
```

## Standalone database server and CLI

The database engine can also run independently of Express as a newline-delimited
JSON protocol over TCP. Start it with:

```sh
npm run db
```

In another terminal, start the client with:

```sh
npm run cli
```

The CLI supports database and collection management, CRUD, hash-index planning,
session transactions, WAL inspection, and server information:

```text
CREATE DATABASE demo
USE demo
CREATE COLLECTION users
INSERT users {"id":1,"name":"Arjun","age":21}
FIND users {"age":21}
CREATE INDEX users age
EXPLAIN users {"age":21}
BEGIN
UPDATE users 1 {"$inc":{"age":1}}
COMMIT
SHOW WAL
STATUS
```

Each TCP connection has its own selected database and transaction session. The
Express application and CLI use the same database directories and core engine.

## REST API

All `/api/*` routes require the authenticated HTTP-only session cookie created
by `/auth/login`. Database-aware resources include databases, collections,
documents, indexes, schemas, queries, and transactions under `/api`.

## Querying documents

Collections support a query pipeline built from `find(query)`. Call `exec()` to
run the query:

```js
const adults = users
    .find({ age: { $gte: 18 }, active: true })
    .sort({ age: -1 })
    .skip(0)
    .limit(10)
    .select(["name", "age"])
    .exec();
```

Supported operators are `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$exists`, `$and`, `$or`, and `$not`. Nested fields use dot notation, for example `{ "address.city": "Rajpura" }`.

The API exposes the same filtering at `POST /api/query`:

```sh
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"database":"demo","collection":"users","filter":{"age":{"$gte":18}},"sort":{"age":-1},"skip":0,"limit":10}'
```

The pipeline order is filter, sort, skip, limit, and projection. The response
contains both the resulting documents and their count. `skip` and `limit` must
be non-negative integers; sort directions must be `1` (ascending) or `-1`
(descending).

## Index Engine

FlexStore supports hash-based indexes for fast equality lookups. The query
planner automatically selects an `INDEX_SCAN` when a suitable index exists and
otherwise uses a `COLLECTION_SCAN`. Hash indexes do not optimize range queries.

### Create an index

```js
users.createIndex("email");
```

### Create a unique index

```js
users.createIndex("email", { unique: true });
```

Unique indexes reject duplicate values and collection writes preserve index and
storage consistency if the constraint fails. `listIndexes()` returns each
index's field, type, uniqueness setting, and number of entries.

### Query and inspect a plan

```js
const query = users.find({ email: "user@example.com" });

query.explain();
// { filter, plan, totalDocuments, estimatedCandidates, indexUsed }

query.exec();
query.getStats();
// { plan, totalDocuments, documentsScanned, resultsReturned, executionTimeMs }
```

For HTTP clients, create an index with
`POST /api/databases/demo/collections/users/indexes` using
`{ "field": "email", "options": { "unique": true } }`, and inspect a plan
with `POST /api/query/explain` using `{ "filter": { "email": "user@example.com" } }`.

### Benchmark

Run the 100,000-document comparison locally with:

```sh
node benchmarks/indexBenchmark.js
```

It reports collection-scan time, index-build time, and indexed-lookup time.
Index definitions are persisted beside each collection and rebuilt when the
database is reopened.

## Tests

Run all tests with:

```sh
npm test
```

## React management console

FlexStore now includes a React and Vite frontend for managing the database
through a browser. The dashboard uses the existing Express API and supports:

- Login through the existing authentication API
- Database and collection navigation
- Document browsing, filtering, insertion, editing, and deletion
- Query execution and query-plan inspection
- Hash-index creation, inspection, and deletion
- Schema validation tools
- Transaction creation, staged operations, commit, and rollback
- WAL and transaction log inspection

### Start the frontend

From the project root, install the frontend dependencies:

```sh
npm --prefix frontend install
```

Keep the backend running in one terminal:

```sh
npm start
```

In a second terminal, from the project root, start the Vite development server:

```sh
npm run frontend
```

Open the `Local` URL printed by Vite, normally `http://localhost:5173/`. If
port `5173` is already in use, Vite automatically uses `http://localhost:5174/`
instead. The backend must remain running on `http://localhost:3000/`; otherwise
the frontend will show proxy errors such as `ECONNREFUSED` or `Request failed
(502)`.

The React frontend provides a backend-verified login screen at `/login`,
database and collection selectors, dynamic JSON documents, schema and index
management, query plans, transactions, and WAL inspection. The UI redirects
to `/login` when the authenticated session expires.

### Frontend checks

Run the frontend linter and production build from the project root:

```sh
npm --prefix frontend run lint
npm run frontend:build
```

The main dashboard routes are `/dashboard`, `/databases`, `/collections`,
`/documents`, `/query`, `/indexes`, `/schema`, `/transactions`, and `/logs`.
