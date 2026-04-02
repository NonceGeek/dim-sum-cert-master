/* 
TODO（NOT DELETE):
- 优化这个后端代码，
- 环境变量有：
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_URL
- PASSWD

- 将 API 的调用替换为 OpenRouter 的 API
 */

import { oakCors } from "cors";
import { Application, Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { CSS, render } from "@deno/gfm";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Config — reads from environment variables:
//   SUPABASE_URL              – Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY – Supabase service-role key (bypasses RLS)
//   PASSWD                    – password gate for write endpoints
// ---------------------------------------------------------------------------

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const router = new Router();

router
  .get("/", (context) => {
    context.response.body = "Hello from DimSum Cert Master Server";
  })
  .get("/health", (context) => {
    // Health check endpoint
    context.response.body = {
      status: "healthy",
      timestamp: new Date().toISOString(),
    };
  })
  .get("/docs", async (context) => {
    try {
      const readmeText = await Deno.readTextFile("./apidoc.md");
      context.response.body = readmeText;
    } catch (err) {
      console.error("Error reading README:", err);
      context.response.status = 500;
      context.response.body = { error: "Could not load documentation" };
    }
  })
  .get("/docs/html", async (context) => {
    try {
      // Read README.md file
      const readmeText = await Deno.readTextFile("./apidoc.md");

      // Render markdown to HTML with GFM styles
      const body = render(readmeText);

      // Create complete HTML document with GFM CSS
      const html = `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>DimSum Cert Master API Documentation</title>
      <style>
        ${CSS}
        body {
          max-width: 900px;
          margin: 0 auto;
          padding: 20px;
        }
      </style>
    </head>
    <body>
    ${body}
    </body>
    </html>`;

      // Set response headers for HTML
      context.response.headers.set("Content-Type", "text/html; charset=utf-8");
      context.response.body = html;
    } catch (err) {
      console.error("Error reading README:", err);
      context.response.status = 500;
      context.response.body = { error: "Could not load documentation" };
    }
  })
  .post("/api/new_cert", async (context) => {
    // Create a new certificate record in agent_lib_cert_master.
    // Body: { passwd, owner, cert_name }
    const body = await context.request.body({ type: "json" }).value;
    const { passwd, owner, cert_name } = body;

    const expectedPasswd = Deno.env.get("PASSWD") || "";
    if (!passwd || passwd !== expectedPasswd) {
      context.response.status = 401;
      context.response.body = { error: "Unauthorized: invalid passwd" };
      return;
    }

    if (!owner?.trim() || !cert_name?.trim()) {
      context.response.status = 400;
      context.response.body = { error: "'owner' and 'cert_name' are required" };
      return;
    }

    if (!supabase) {
      context.response.status = 500;
      context.response.body = { error: "Supabase not configured" };
      return;
    }

    try {
      const { data, error } = await supabase
        .from("agent_lib_cert_master")
        .insert({ owner: owner.trim(), cert_name: cert_name.trim() })
        .select()
        .single();

      if (error) throw error;

      context.response.body = { success: true, data };
    } catch (err) {
      console.error("new_cert error:", err);
      context.response.status = 500;
      context.response.body = { error: String(err) };
    }
  });

// ---------------------------------------------------------------------------
// Application
// ---------------------------------------------------------------------------

const app = new Application();

// Middleware: Error handling
app.use(async (context, next) => {
  try {
    await next();
  } catch (err) {
    console.error("Error:", err);
    context.response.status = 500;
    context.response.body = {
      success: false,
      error: "Internal server error",
    };
  }
});

// Middleware: Logger
app.use(async (context, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${context.request.method} ${context.request.url} - ${ms}ms`);
});

// Enable CORS for All Routes
app.use(oakCors());

// Middleware: Router
app.use(router.routes());

// Start server
const port = Number(Deno.env.get("SERVER_PORT")) || 4403;

console.info(`
  🚀 CORS-enabled web server listening on port ${port}
  
  🌐 Visit: http://localhost:${port}
  `);

await app.listen({ port });
