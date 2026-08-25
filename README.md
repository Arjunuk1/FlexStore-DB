# FlexStore

FlexStore is a schema-flexible JSON document database with a standalone Express server.

## Querying documents

Collections support full collection-scan filtering through `find(query)`:

```js
const adults = users.find({
    age: { $gte: 18 },
    active: true
});
```

Supported operators are `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$exists`, `$and`, `$or`, and `$not`. Nested fields use dot notation, for example `{ "address.city": "Rajpura" }`.

The API exposes the same filtering at `POST /api/query`:

```sh
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"filter":{"age":{"$gt":18}}}'
```

The response contains both the matching documents and their count.

## Tests

Run all tests with:

```sh
npm test
```
