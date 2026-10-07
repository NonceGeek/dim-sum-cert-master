# DimSum Cert Master

> [https://cert.app.aidimsum.com/](https://cert.app.aidimsum.com/)
>
>
> A lightweight tool for generating certificates from image templates, with verifiable certificate IDs and QR codes.
>
> 基于模板快速生成证书，并为每张证书生成可验证的唯一码与二维码。

## 🎯 Overview

DimSum Cert Master lets you pick a certificate template, fill in its fields (name, dataset name, date, QR code), adjust the layout, and download the result as a self-contained HTML file. It can also register each certificate with the backend to get a unique certificate ID and a verification link, which you can turn into a QR code.

### Key Features

- 🖼️ **Template-based Certificates** — Templates are images in `main/public/templates/` with configurable text and QR code fields
- ✏️ **Live Editing** — Edit field values, positions, and font sizes with a live preview
- 💾 **Session Memory** — Layout settings, QR color/size, and the cert password are kept in `sessionStorage`
- 📥 **HTML Download** — Exports `{owner}_{dataset_name}_{cert_name}.html` with the template image embedded
- 🔐 **Certificate IDs** — Password-protected endpoint stores certificates in Supabase and returns a unique ID
- 📱 **Verification QR Code** — Generates a QR code for the verification link, with custom color, downloadable as `{owner}_certqrcode.png`

## ⚙️ Configuration

### Frontend

Site-level text (homepage name, description, footer links) is defined in the **Configuration** section of [`main/README.md`](./main/README.md#configuration).

> **Edit the values in `main/README.md` — the app reads them automatically at build / runtime.**
>
> 只需编辑 `main/README.md` 中 Configuration 部分的 value 值，程序会自动读取。

Certificate templates and their fields are defined in the `TEMPLATES` array in [`main/app/page.tsx`](./main/app/page.tsx). Each field has a `var_name`, `default_value`, `type` (`text` or `qr_code`), `font_size`, and `position`. The `cert_date` field defaults to today's date in UTC+8.

The backend URL is currently hardcoded as `https://api.cert.app.aidimsum.com` in [`main/components/template-selector.tsx`](./main/components/template-selector.tsx).

### Backend

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service-role key (bypasses RLS) |
| `PASSWD` | Yes | Password required by `POST /api/new_cert` |
| `PORT` / `SERVER_PORT` | No | Local listen port, defaults to `8000` |

Certificates are stored in the Supabase table `agent_lib_cert_master` (columns `owner`, `cert_name`).

## 📁 Project Structure

```
dim-sum-cert-master/
├── main/                          # Next.js frontend application
│   ├── app/
│   │   └── page.tsx               # Homepage + certificate TEMPLATES config
│   ├── components/
│   │   └── template-selector.tsx  # Certificate editor, download, cert ID + QR code
│   ├── lib/                       # Utilities (README config loader, etc.)
│   ├── public/templates/          # Certificate template images
│   └── README.md                  # ⭐ Frontend configuration file
│
├── deno/                          # Deno backend server
│   ├── main.tsx                   # Server entry point
│   ├── deno.json                  # Tasks, imports, Deno Deploy config
│   └── apidoc.md                  # Served at /docs and /docs/html
│
└── LICENSE                        # Apache 2.0 License
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Deno** 1.37+ (for backend server)

### 1. Start the Backend Server

```bash
cd deno

# Set environment variables
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
export PASSWD="your-password"
export PORT=8000  # Optional, defaults to 8000

# Run the server (watch mode)
deno task dev
```

### 2. Start the Frontend

```bash
cd main

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will start on [http://localhost:3000](http://localhost:3000).

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Server greeting |
| GET | `/health` | Health check JSON |
| GET | `/docs` | Raw markdown API docs (`apidoc.md`) |
| GET | `/docs/html` | Rendered HTML docs |
| POST | `/api/new_cert` | Create a certificate record |

`POST /api/new_cert` request body:

```json
{
  "passwd": "your-password",
  "owner": "cool guy",
  "cert_name": "语料贡献者证书"
}
```

Success response:

```json
{
  "success": true,
  "data": { "id": 1, "owner": "cool guy", "cert_name": "语料贡献者证书" }
}
```

Errors: `401` for a wrong password, `400` if `owner` or `cert_name` is missing, `500` if Supabase is not configured.

```bash
curl -X POST http://localhost:8000/api/new_cert \
  -H "Content-Type: application/json" \
  -d '{"passwd":"your-password","owner":"cool guy","cert_name":"语料贡献者证书"}'
```

## 🏗️ Architecture

### Frontend (`main/`)

- **Framework**: Next.js 15 with App Router
- **UI**: Tailwind CSS + shadcn/ui components
- **QR Codes**: `qrcode`
- **Config**: Parsed at runtime from `main/README.md`

### Backend (`deno/`)

- **Runtime**: Deno
- **Framework**: Oak
- **Database**: Supabase
- **CORS**: oakCors with full cross-origin support

## 🚀 Deployment

### Frontend (Vercel)

1. Push code to GitHub
2. Import project in Vercel, with `main/` as the root directory
3. Deploy automatically

Live at [https://cert.app.aidimsum.com/](https://cert.app.aidimsum.com/).

### Backend (Deno Deploy)

1. Push code to GitHub
2. Create project on [Deno Deploy](https://dash.deno.com) (configured in `deno/deno.json` as app `dim-sum-cert-master`)
3. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `PASSWD`
4. Deploy from `deno/main.tsx`

On Deno Deploy, `main.tsx` serves requests through `Deno.serve`; locally it uses `app.listen`.

## 📚 Documentation

- **Frontend Config**: [main/README.md](./main/README.md#configuration)
- **Certificate Templates**: [main/app/page.tsx](./main/app/page.tsx)
- **Server Entry**: [deno/main.tsx](./deno/main.tsx)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is licensed under the Apache License 2.0 — see the [LICENSE](./LICENSE) file for details.

## 📧 Contact

Created by [leeduckgo@NonceGeek](https://x.com/0xleeduckgo)

---

**Built with ❤️ using Next.js, Deno, and Supabase**
