# DimSum Cert Master — API Documentation

> Deno backend server for creating and verifying certificates, backed by Supabase.

## Base URL

```
https://api.cert.app.aidimsum.com
```

Local development:

```
http://localhost:8000
```

---

## Public Endpoints

### `GET /`

Server greeting.

**Response:**
```
Hello from DimSum Cert Master Server
```

---

### `GET /health`

Health check endpoint for monitoring and load balancers.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-10-07T04:00:00.000Z"
}
```

---

### `GET /docs`

Get API documentation in Markdown format.

**Response:** Raw Markdown content of this documentation (`text/markdown`).

---

### `GET /docs/html`

Get API documentation rendered as HTML with GitHub Flavored Markdown styling.

**Response:** HTML page with rendered documentation.

---

## Certificate Endpoints

Certificates are stored in the Supabase table `agent_lib_cert_master`.

### `POST /api/new_cert`

Create a new certificate record. Requires the server password.

**Request Body:**
```json
{
  "passwd": "your-password",
  "owner": "cool guy",
  "cert_name": "语料贡献者证书"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `passwd` | string | Yes | Must match the `PASSWD` environment variable |
| `owner` | string | Yes | Certificate owner (trimmed before saving) |
| `cert_name` | string | Yes | Certificate name (trimmed before saving) |

**Success Response (200):** returns the inserted row. Its `id` is the certificate ID used by `/api/verify_cert`.
```json
{
  "success": true,
  "data": {
    "id": "573ebfbd-e0ea-4728-96f0-00c860c25a6d",
    "owner": "cool guy",
    "cert_name": "语料贡献者证书"
  }
}
```

**Error Responses:**

- `401` — Missing or wrong password
```json
{ "error": "Unauthorized: invalid passwd" }
```

- `400` — Missing `owner` or `cert_name`
```json
{ "error": "'owner' and 'cert_name' are required" }
```

- `500` — Supabase not configured, or the insert failed
```json
{ "error": "Supabase not configured" }
```

**Example:**
```bash
curl -X POST http://localhost:8000/api/new_cert \
  -H "Content-Type: application/json" \
  -d '{"passwd":"your-password","owner":"cool guy","cert_name":"语料贡献者证书"}'
```

---

### `GET /api/verify_cert`

Verify a certificate by its ID. The certificate is looked up by the `id` column first, then by a `cert_id` column. No password is required, so this URL can be shared as a QR code.

By default the response is an HTML page for people opening the link in a browser. Add `resp_json=true` to get JSON instead.

**Query Parameters:**

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `cert_id` | string | Yes | — | Certificate ID (UUID returned by `/api/new_cert`) |
| `resp_json` | string | No | — | Set to `true` to return JSON instead of HTML |

#### HTML response (default)

**Found (200):** an HTML page rendered from this markdown, with one line per column of the certificate row:
```markdown
## 验证成功！
该证书具体信息：
* id: 573ebfbd-e0ea-4728-96f0-00c860c25a6d
* owner: cool guy
* cert_name: 语料贡献者证书
```

**Not found (200):** an HTML page with:
```markdown
## 验证失败！未查询到该证书
```

#### JSON response (`resp_json=true`)

**Found (200):**
```json
{
  "success": true,
  "data": {
    "id": "573ebfbd-e0ea-4728-96f0-00c860c25a6d",
    "owner": "cool guy",
    "cert_name": "语料贡献者证书"
  }
}
```

**Not found (200):**
```json
{ "success": false, "error": "cert is not exist" }
```

#### Errors (JSON in both modes)

- `400` — Missing `cert_id`
```json
{ "success": false, "error": "'cert_id' is required" }
```

- `500` — Supabase not configured, or an unexpected error
```json
{ "error": "Supabase not configured" }
```

**Examples:**
```bash
# HTML page
curl "http://localhost:8000/api/verify_cert?cert_id=573ebfbd-e0ea-4728-96f0-00c860c25a6d"

# JSON
curl "http://localhost:8000/api/verify_cert?cert_id=573ebfbd-e0ea-4728-96f0-00c860c25a6d&resp_json=true"
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SUPABASE_URL` | Yes | — | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | — | Supabase service-role key (bypasses RLS) |
| `PASSWD` | Yes | — | Password required by `POST /api/new_cert` |
| `PORT` / `SERVER_PORT` | No | `8000` | Local listen port (ignored on Deno Deploy) |

---

**Built with Deno, Oak, and Supabase**
