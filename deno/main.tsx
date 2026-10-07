/* 
TODO（NOT DELETE):
- 优化这个后端代码，
- 环境变量有：
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_URL
- PASSWD

- 将 API 的调用替换为 OpenRouter 的 API
 */

import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";
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
      const readmeText = await Deno.readTextFile(
        new URL("./apidoc.md", import.meta.url),
      );
      context.response.headers.set("Content-Type", "text/markdown; charset=utf-8");
      context.response.body = readmeText;
    } catch (err) {
      console.error("Error reading README:", err);
      context.response.status = 500;
      context.response.body = { error: "Could not load documentation" };
    }
  })
  .get("/docs/html", async (context) => {
    try {
      const readmeText = await Deno.readTextFile(
        new URL("./apidoc.md", import.meta.url),
      );

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
  })
  .get("/api/verify_cert", async (context: any) => {
    // Verify a certificate record in agent_lib_cert_master.
    // Query: ?cert_id=<uuid>[&resp_json=true]
    // Return: HTML page with the certificate details, or JSON when resp_json=true.
    const cert_id = context.request.url.searchParams.get("cert_id")?.trim() ?? "";
    const respJson =
      context.request.url.searchParams.get("resp_json")?.trim().toLowerCase() ===
      "true";

    if (!cert_id) {
      context.response.status = 400;
      context.response.body = { success: false, error: "'cert_id' is required" };
      return;
    }

    if (!supabase) {
      context.response.status = 500;
      context.response.body = { error: "Supabase not configured" };
      return;
    }

    const renderHtmlPage = (markdown: string) => {
      // Render markdown to HTML with GFM styles
      const body = render(markdown);

      return `<!DOCTYPE html>
    <html lang="zh">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>DimSum Cert Master 证书验证</title>
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
    };

    try {
      const byId = await supabase
        .from("agent_lib_cert_master")
        .select("*")
        .eq("id", cert_id)
        .maybeSingle();

      let data = byId.data;

      // Fallback to cert_id column when id lookup misses (ignore lookup errors here)
      if (!data) {
        const byCertId = await supabase
          .from("agent_lib_cert_master")
          .select("*")
          .eq("cert_id", cert_id)
          .maybeSingle();
        if (byCertId.data) data = byCertId.data;
      }

      if (!data) {
        if (respJson) {
          context.response.body = {
            success: false,
            error: "cert is not exist",
          };
          return;
        }
        context.response.headers.set("Content-Type", "text/html; charset=utf-8");
        context.response.body = renderHtmlPage("## 验证失败！未查询到该证书\n");
        return;
      }

      if (respJson) {
        context.response.body = { success: true, data };
        return;
      }

      const lines = Object.entries(data as Record<string, unknown>).map(
        ([key, value]) => {
          const text =
            value !== null && typeof value === "object"
              ? JSON.stringify(value)
              : String(value ?? "");
          return `* ${key}: ${text}`;
        },
      );
      const markdown = `## 验证成功！\n该证书具体信息：\n${lines.join("\n")}\n`;

      context.response.headers.set("Content-Type", "text/html; charset=utf-8");
      context.response.body = renderHtmlPage(markdown);
    } catch (err) {
      console.error("verify_cert error:", err);
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
            ? String((err as { message: unknown }).message)
            : JSON.stringify(err);
      context.response.status = 500;
      context.response.body = { error: message };
    }
  })
  ;

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

const port = Number(Deno.env.get("PORT") || Deno.env.get("SERVER_PORT") || "8000");

const isDeploy =
  Boolean(Deno.env.get("DENO_DEPLOYMENT_ID")) || Boolean(Deno.env.get("DENO_REGION"));

if (import.meta.main) {
  if (isDeploy) {
    console.info("Server started (Deno Deploy)");
    Deno.serve({
      handler: async (req) => {
        const resp = await app.handle(req);
        return resp ?? new Response("Not Found", { status: 404 });
      },
    });
  } else {
    console.info(`
  CORS-enabled web server listening on port ${port}

  Visit: http://localhost:${port}
  `);
    await app.listen({ port });
  }
}
