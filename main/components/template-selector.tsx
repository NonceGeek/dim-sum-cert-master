"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Input } from "@/components/ui/input";

type TemplateSelectorProps = {
  templates: {
    name: string;
    file_name: string;
    vars: {
      var_name: string;
      default_value: string;
      type: string;
      font_size?: number;
      position: { x: number; y: number };
    }[];
  }[];
};

export function TemplateSelector({ templates }: TemplateSelectorProps) {
  const previewWrapRef = useRef<HTMLDivElement | null>(null);
  const [previewNaturalSize, setPreviewNaturalSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const [selectedFileName, setSelectedFileName] = useState(
    templates[0]?.file_name ?? "",
  );
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [varPositions, setVarPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [varFontSizes, setVarFontSizes] = useState<Record<string, number>>({});
  const [qrCodeDataUri, setQrCodeDataUri] = useState<string>("");
  const [qrCodeSize, setQrCodeSize] = useState(120);

  if (templates.length === 0) {
    return (
      <p className="text-muted-foreground text-center">
        No templates available.
      </p>
    );
  }

  const selectedTemplate =
    templates.find((t) => t.file_name === selectedFileName) ?? templates[0];

  const defaultVarValues = useMemo(() => {
    const entries = (selectedTemplate?.vars ?? []).map((v) => [
      v.var_name,
      v.default_value,
    ]);
    return Object.fromEntries(entries) as Record<string, string>;
  }, [selectedTemplate]);

  const defaultVarPositions = useMemo(() => {
    const entries = (selectedTemplate?.vars ?? []).map((v) => [
      v.var_name,
      { x: v.position.x, y: v.position.y },
    ]);
    return Object.fromEntries(entries) as Record<string, { x: number; y: number }>;
  }, [selectedTemplate]);

  const defaultVarFontSizes = useMemo(() => {
    const entries = (selectedTemplate?.vars ?? []).map((v) => [
      v.var_name,
      typeof v.font_size === "number" && Number.isFinite(v.font_size)
        ? v.font_size
        : 24,
    ]);
    return Object.fromEntries(entries) as Record<string, number>;
  }, [selectedTemplate]);

  useEffect(() => {
    setVarValues(defaultVarValues);
  }, [defaultVarValues]);

  useEffect(() => {
    setVarPositions(defaultVarPositions);
  }, [defaultVarPositions]);

  useEffect(() => {
    setVarFontSizes(defaultVarFontSizes);
  }, [defaultVarFontSizes]);

  const generateCertId = () => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const candidateKeys = ["cert_uuid", "cert_id", "cert_code", "cert_uid"];
    const existingKey =
      selectedTemplate?.vars.find((v) => candidateKeys.includes(v.var_name))
        ?.var_name ?? "cert_uuid";

    setVarValues((prev) => ({ ...prev, [existingKey]: id }));
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(id).catch(() => {});
    }
  };

  const downloadHtml = async () => {
    if (!selectedTemplate?.file_name) return;

    const resp = await fetch(`/templates/${selectedTemplate.file_name}`);
    const blob = await resp.blob();
    const dataUri = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });

    const natural = previewNaturalSize ?? { width: 800, height: 600 };
    const fontFamily =
      '"HarmonyOS Sans", ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"';

    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    const textOverlays = selectedTemplate.vars
      .filter((v) => v.type !== "qr_code")
      .map((v) => {
        const text = (varValues[v.var_name] ?? "").trim();
        if (!text) return "";
        const pos = varPositions[v.var_name] ?? v.position;
        const fontSize = varFontSizes[v.var_name] ?? v.font_size ?? 24;
        const cssFontFamily = fontFamily.replace(/"/g, "'");
        return `<div style="position:absolute;left:${pos.x}px;top:${pos.y}px;font-size:${fontSize}px;font-family:${cssFontFamily};color:#fff;white-space:pre-wrap;">${esc(text)}</div>`;
      })
      .filter(Boolean);

    const qrOverlays = qrCodeDataUri
      ? selectedTemplate.vars
          .filter((v) => v.type === "qr_code")
          .map((v) => {
            const pos = varPositions[v.var_name] ?? v.position;
            return `<img src="${qrCodeDataUri}" alt="QR Code" style="position:absolute;left:${pos.x}px;top:${pos.y}px;width:${qrCodeSize}px;height:${qrCodeSize}px;object-fit:contain;" />`;
          })
      : [];

    const overlays = [...textOverlays, ...qrOverlays].join("\n    ");

    const html = `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(selectedTemplate.name)}</title>
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    body { display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #111; }
    .cert { position: relative; width: ${natural.width}px; height: ${natural.height}px; }
    .cert img { display: block; width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div class="cert">
    <img src="${dataUri}" alt="${esc(selectedTemplate.name)}" />
    ${overlays}
  </div>
</body>
</html>`;

    const htmlBlob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(htmlBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedTemplate.name}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-center gap-3">
        <label
          htmlFor="template-select"
          className="text-sm font-medium text-foreground whitespace-nowrap"
        >
          Template
        </label>
        <select
          id="template-select"
          value={selectedFileName}
          onChange={(e) => setSelectedFileName(e.target.value)}
          className="w-full max-w-md rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors hover:border-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {templates.map((t) => (
            <option key={t.file_name} value={t.file_name}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {selectedTemplate?.vars?.length ? (
        <div className="mx-auto w-full max-w-2xl rounded-lg border border-border bg-background p-4 text-left shadow-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {selectedTemplate.vars
              .filter((v) => v.type !== "qr_code")
              .map((v) => {
                const value = varValues[v.var_name] ?? "";
                const pos = varPositions[v.var_name] ?? v.position;
                const fontSize = varFontSizes[v.var_name] ?? v.font_size ?? 24;
                return (
                  <div key={v.var_name} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <label
                        htmlFor={`var-${v.var_name}`}
                        className="text-sm font-medium text-foreground"
                      >
                        {v.var_name}
                      </label>
                      <span
                        className="text-xs text-muted-foreground"
                        style={{
                          fontFamily:
                            '"HarmonyOS Sans", ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
                        }}
                      >
                        {v.type} • ({pos.x}, {pos.y})
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <label
                          htmlFor={`var-${v.var_name}-x`}
                          className="text-xs text-muted-foreground"
                        >
                          x
                        </label>
                        <Input
                          id={`var-${v.var_name}-x`}
                          type="number"
                          value={Number.isFinite(pos.x) ? String(pos.x) : ""}
                          onChange={(e) => {
                            const nextX = Number(e.target.value);
                            if (!Number.isFinite(nextX)) return;
                            setVarPositions((prev) => ({
                              ...prev,
                              [v.var_name]: { x: nextX, y: pos.y },
                            }));
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <label
                          htmlFor={`var-${v.var_name}-y`}
                          className="text-xs text-muted-foreground"
                        >
                          y
                        </label>
                        <Input
                          id={`var-${v.var_name}-y`}
                          type="number"
                          value={Number.isFinite(pos.y) ? String(pos.y) : ""}
                          onChange={(e) => {
                            const nextY = Number(e.target.value);
                            if (!Number.isFinite(nextY)) return;
                            setVarPositions((prev) => ({
                              ...prev,
                              [v.var_name]: { x: pos.x, y: nextY },
                            }));
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <label
                          htmlFor={`var-${v.var_name}-font-size`}
                          className="text-xs text-muted-foreground"
                        >
                          font
                        </label>
                        <Input
                          id={`var-${v.var_name}-font-size`}
                          type="number"
                          value={Number.isFinite(fontSize) ? String(fontSize) : ""}
                          onChange={(e) => {
                            const next = Number(e.target.value);
                            if (!Number.isFinite(next)) return;
                            setVarFontSizes((prev) => ({
                              ...prev,
                              [v.var_name]: next,
                            }));
                          }}
                        />
                      </div>
                    </div>

                    <Input
                      id={`var-${v.var_name}`}
                      value={value}
                      onChange={(e) =>
                        setVarValues((prev) => ({
                          ...prev,
                          [v.var_name]: e.target.value,
                        }))
                      }
                      placeholder={v.default_value}
                    />
                  </div>
                );
              })}
          </div>

          {selectedTemplate.vars
            .filter((v) => v.type === "qr_code")
            .map((v) => {
              const pos = varPositions[v.var_name] ?? v.position;
              return (
                <div
                  key={v.var_name}
                  className="mt-4 space-y-2 border-t border-border pt-4"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium text-foreground">
                      {v.var_name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      qr_code • ({pos.x}, {pos.y}) • {qrCodeSize}px
                    </span>
                  </div>

                  <input
                    type="file"
                    accept="image/*"
                    className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground file:transition-colors hover:file:bg-muted"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onloadend = () =>
                        setQrCodeDataUri(reader.result as string);
                      reader.readAsDataURL(file);
                    }}
                  />

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label
                        htmlFor={`var-${v.var_name}-x`}
                        className="text-xs text-muted-foreground"
                      >
                        x
                      </label>
                      <Input
                        id={`var-${v.var_name}-x`}
                        type="number"
                        value={Number.isFinite(pos.x) ? String(pos.x) : ""}
                        onChange={(e) => {
                          const nextX = Number(e.target.value);
                          if (!Number.isFinite(nextX)) return;
                          setVarPositions((prev) => ({
                            ...prev,
                            [v.var_name]: { x: nextX, y: pos.y },
                          }));
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor={`var-${v.var_name}-y`}
                        className="text-xs text-muted-foreground"
                      >
                        y
                      </label>
                      <Input
                        id={`var-${v.var_name}-y`}
                        type="number"
                        value={Number.isFinite(pos.y) ? String(pos.y) : ""}
                        onChange={(e) => {
                          const nextY = Number(e.target.value);
                          if (!Number.isFinite(nextY)) return;
                          setVarPositions((prev) => ({
                            ...prev,
                            [v.var_name]: { x: pos.x, y: nextY },
                          }));
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor={`var-${v.var_name}-size`}
                        className="text-xs text-muted-foreground"
                      >
                        size
                      </label>
                      <Input
                        id={`var-${v.var_name}-size`}
                        type="number"
                        value={String(qrCodeSize)}
                        onChange={(e) => {
                          const next = Number(e.target.value);
                          if (!Number.isFinite(next) || next <= 0) return;
                          setQrCodeSize(next);
                        }}
                      />
                    </div>
                  </div>

                  {qrCodeDataUri && (
                    <div className="flex items-center gap-3">
                      <img
                        src={qrCodeDataUri}
                        alt="QR Code preview"
                        className="rounded border border-border"
                        style={{ width: 48, height: 48, objectFit: "contain" }}
                      />
                      <button
                        type="button"
                        onClick={() => setQrCodeDataUri("")}
                        className="text-xs text-muted-foreground underline hover:text-foreground"
                      >
                        移除
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      ) : null}

      {/* TODO: add two button here, one is "下载", the other is "生成证书唯一码" */}
      <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
        <button
          type="button"
          onClick={downloadHtml}
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          下载
        </button>
        <button
          type="button"
          onClick={generateCertId}
          className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
        >
          生成证书唯一码
        </button>
      </div>

      {selectedTemplate?.file_name && (
        <div className="flex justify-center">
          <div
            ref={previewWrapRef}
            className="relative overflow-hidden rounded-lg border border-border shadow-sm"
          >
            <Image
              src={`/templates/${selectedTemplate.file_name}`}
              alt={selectedTemplate.name}
              width={800}
              height={600}
              sizes="(max-width: 640px) 100vw, 672px"
              quality={100}
              className="h-auto w-full max-w-2xl object-contain"
              onLoad={(e) => {
                // next/image passes the underlying <img> as event target
                const img = e.currentTarget as HTMLImageElement;
                if (img?.naturalWidth && img?.naturalHeight) {
                  setPreviewNaturalSize({
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                  });
                }
              }}
            />

            <div className="pointer-events-none absolute inset-0">
              {selectedTemplate.vars
                .filter((v) => v.type !== "qr_code")
                .map((v) => {
                  const text = (varValues[v.var_name] ?? "").trim();
                  if (!text) return null;
                  const pos = varPositions[v.var_name] ?? v.position;
                  const fontSize = varFontSizes[v.var_name] ?? v.font_size ?? 24;
                  return (
                    <div
                      key={v.var_name}
                      className="absolute whitespace-pre-wrap text-white"
                      style={{
                        left: pos.x,
                        top: pos.y,
                        fontSize,
                        fontFamily:
                          '"HarmonyOS Sans", ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
                        // textShadow:
                        //   "0 1px 2px rgba(0,0,0,0.65), 0 0 8px rgba(0,0,0,0.35)",
                      }}
                    >
                      {text}
                    </div>
                  );
                })}

              {qrCodeDataUri &&
                selectedTemplate.vars
                  .filter((v) => v.type === "qr_code")
                  .map((v) => {
                    const pos = varPositions[v.var_name] ?? v.position;
                    return (
                      <img
                        key={v.var_name}
                        src={qrCodeDataUri}
                        alt="QR Code"
                        className="absolute"
                        style={{
                          left: pos.x,
                          top: pos.y,
                          width: qrCodeSize,
                          height: qrCodeSize,
                          objectFit: "contain",
                        }}
                      />
                    );
                  })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
