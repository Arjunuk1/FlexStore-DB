# FlexStore

FlexStore is a schema-flexible JSON document database with a standalone Express server.

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
  -d '{"filter":{"age":{"$gte":18}},"sort":{"age":-1},"skip":0,"limit":10,"select":["name","age","email"]}'
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

For HTTP clients, create an index with `POST /api/index` using
`{ "field": "email", "options": { "unique": true } }`, and inspect a plan
with `POST /api/query/explain` using `{ "filter": { "email": "user@example.com" } }`.

### Benchmark

Run the 100,000-document comparison locally with:

```sh
node benchmarks/indexBenchmark.js
```

It reports collection-scan time, index-build time, and indexed-lookup time.
Index definitions can be stored through `index/indexMetadataStore.js`; automatic
startup rebuilding is intentionally left for a later persistence integration.

## Tests

Run all tests with:

```sh
npm test
```
