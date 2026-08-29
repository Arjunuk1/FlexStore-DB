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

## Tests

Run all tests with:

```sh
npm test
```
