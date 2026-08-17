# Richardson Maturity Model Evaluation
## Task Management API — Roll No: D25AIML080

---

## Evaluation Table

| Level | Criterion | Does your API satisfy this? | Evidence |
|-------|-----------|----------------------------|----------|
| **Level 0** | Single URI, single HTTP method (e.g., all requests via `POST /api`) | ✅ Surpassed | Our API uses multiple distinct resource URIs, not a single "swamp of POX" endpoint. |
| **Level 1** | Multiple resource URIs (one per resource type) | ✅ Yes | `/tasks` (collection) and `/tasks/:id` (individual resource) are clearly separated resource URIs. |
| **Level 2** | Correct HTTP verbs + meaningful status codes on every endpoint | ✅ Yes | `GET /tasks` → 200, `POST /tasks` → 201, `PUT /tasks/:id` → 200/400/404, `DELETE /tasks/:id` → 200/404, undefined routes → 404, validation errors → 400, content-type errors → 415. |
| **Level 3** | HATEOAS — responses include links to related actions | ⚠️ Awareness only | `_links` object included in all task responses (see below), but no full hypermedia engine is implemented. |

---

## Endpoint-by-Endpoint Level 2 Audit

| Endpoint | HTTP Verb Correct? | Status Codes Used | Level 2 Compliant? |
|----------|--------------------|-------------------|--------------------|
| `GET /tasks` | ✅ GET (safe, idempotent) | 200 | ✅ Yes |
| `GET /tasks/:id` | ✅ GET | 200, 400, 404 | ✅ Yes |
| `POST /tasks` | ✅ POST (non-idempotent creation) | 201, 400, 415 | ✅ Yes |
| `PUT /tasks/:id` | ✅ PUT (idempotent full/partial update) | 200, 400, 404, 415 | ✅ Yes |
| `DELETE /tasks/:id` | ✅ DELETE (idempotent removal) | 200, 404 | ✅ Yes |

**Result:** The API fully satisfies **Level 2** of the Richardson Maturity Model.

---

## HATEOAS Awareness (Level 3)

Level 3 requires responses to contain **hypermedia links** that guide the client to the next possible actions — removing the need for clients to hard-code URLs.

### Links already included in every task response

```json
{
  "id": 1,
  "title": "Finish lab report",
  "description": "Complete Practical 4 writeup",
  "completed": false,
  "createdAt": "2026-08-03T15:21:00.000Z",
  "updatedAt": "2026-08-03T15:21:00.000Z",
  "_links": {
    "self":   "/tasks/1",
    "delete": "/tasks/1"
  }
}
```

### Two additional links that would complete a Level 3 implementation

```json
"_links": {
  "self":       { "href": "/tasks/1",  "method": "GET"    },
  "update":     { "href": "/tasks/1",  "method": "PUT"    },
  "delete":     { "href": "/tasks/1",  "method": "DELETE" },
  "collection": { "href": "/tasks",    "method": "GET"    }
}
```

1. **`update`** — tells the client exactly which URL and HTTP verb to use to update this task, without prior knowledge of the API contract.
2. **`collection`** — allows the client to navigate back to the full task list from any individual resource, enabling a discoverable API graph.

> **Note:** Full Level 3 implementation (a true hypermedia engine) is out of scope for this lab; the `_links` structure above demonstrates awareness.

---

## Level 2 Violations Found & Fixed

No Level 2 violations were found in the initial implementation. The API was designed with correct verbs and status codes from the start:

- `POST` used for creation (not `GET` with query params)
- `PUT` used for updates (not `POST /tasks/:id/update`)
- `DELETE` used for deletion (not `POST /tasks/:id/delete`)
- `201 Created` returned for `POST`, not `200`
- `404 Not Found` returned for missing resources, not `200 { error: true }`

---

## Why Most Production APIs Stop at Level 2

The vast majority of real-world REST APIs (e.g., GitHub, Stripe, Twitter/X) are designed to **Level 2** and intentionally go no further. Here is why:

**Client complexity vs. benefit trade-off.** Level 3 (HATEOAS) requires clients to dynamically discover and follow links rather than calling known URLs. In practice, frontend applications, mobile apps, and third-party integrations are always written against a *documented and stable* API contract (OpenAPI / Swagger). A dynamic discovery mechanism adds significant parsing overhead and cognitive load on both client and server teams without providing tangible benefit when the URL structure is already well-documented and stable.

Additionally, frameworks and tooling (code generators, SDK builders, API gateways) are optimised around Level 2 conventions. Adopting full HATEOAS would require custom hypermedia media types (e.g., `application/hal+json`, `application/vnd.siren+json`) and client-side hypermedia parsers, increasing the project's dependency surface for little practical gain. Level 2 provides the right balance of **resource clarity**, **verb semantics**, and **tooling compatibility** for the overwhelming majority of production use cases.

---

## References

- Richardson, L. & Ruby, S. (2007). *RESTful Web Services*. O'Reilly.
- Fowler, M. (2010). [Richardson Maturity Model](https://martinfowler.com/articles/richardsonMaturityModel.html). martinfowler.com.
- IBM Developer: Node.js & MongoDB — Developing Back-end Database Applications, Week 4.
