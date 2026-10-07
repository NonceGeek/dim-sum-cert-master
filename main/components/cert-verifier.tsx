"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

const CERT_API_BASE = "https://api.cert.app.aidimsum.com";
const CERT_API_HOST = new URL(CERT_API_BASE).host;

type VerifyResult =
  | { status: "idle" }
  | { status: "working"; message: string }
  | {
      status: "verified";
      qrText: string;
      qrHost: string | null;
      data: Record<string, unknown>;
    }
  | { status: "failed"; message: string; qrText?: string };

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片加载失败"));
    img.src = src;
  });

type NativeBarcodeDetector = {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
};

type NativeBarcodeDetectorCtor = {
  new (options: { formats: string[] }): NativeBarcodeDetector;
  getSupportedFormats: () => Promise<string[]>;
};

const getNativeDetector = (() => {
  let cached: NativeBarcodeDetector | null | undefined;
  return async (): Promise<NativeBarcodeDetector | null> => {
    if (cached !== undefined) return cached;
    let detector: NativeBarcodeDetector | null = null;
    const Ctor = (globalThis as { BarcodeDetector?: NativeBarcodeDetectorCtor })
      .BarcodeDetector;
    if (Ctor) {
      try {
        const formats = await Ctor.getSupportedFormats();
        if (formats.includes("qr_code")) detector = new Ctor({ formats: ["qr_code"] });
      } catch {}
    }
    cached = detector;
    return detector;
  };
})();

const yieldToBrowser = () => new Promise((resolve) => setTimeout(resolve, 0));

// Draws a region of the image onto the canvas at the given size. The backdrop
// matters because QR images exported by this app have a transparent background.
const drawRegion = (
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  region: { x: number; y: number; w: number; h: number },
  outW: number,
  outH: number,
  backdrop: string,
) => {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  canvas.width = outW;
  canvas.height = outH;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, outW, outH);
  ctx.drawImage(img, region.x, region.y, region.w, region.h, 0, 0, outW, outH);
  return ctx;
};

const decodeRegion = async (
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  region: { x: number; y: number; w: number; h: number },
  outW: number,
  outH: number,
  native: NativeBarcodeDetector | null,
): Promise<string | null> => {
  for (const backdrop of ["#ffffff", "#000000"]) {
    const ctx = drawRegion(canvas, img, region, outW, outH, backdrop);
    if (!ctx) return null;
    if (native) {
      try {
        const found = await native.detect(canvas);
        if (found[0]?.rawValue) return found[0].rawValue;
      } catch {}
    }
    const { data } = ctx.getImageData(0, 0, outW, outH);
    const code = jsQR(data, outW, outH, { inversionAttempts: "attemptBoth" });
    if (code?.data) return code.data;
  }
  return null;
};

// On a full certificate the QR code is often small (e.g. 80px on a 1700px
// image), which neither decoder finds in a whole-image pass. Overlapping tiles
// are upscaled so the QR code fills enough of the frame to be detected.
const decodeQrFromImage = async (img: HTMLImageElement): Promise<string | null> => {
  const canvas = document.createElement("canvas");
  const native = await getNativeDetector();
  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;
  const whole = { x: 0, y: 0, w: imgW, h: imgH };

  for (const maxSide of [2000, 1000]) {
    const scale = Math.min(1, maxSide / Math.max(imgW, imgH));
    const text = await decodeRegion(
      canvas,
      img,
      whole,
      Math.max(1, Math.round(imgW * scale)),
      Math.max(1, Math.round(imgH * scale)),
      native,
    );
    if (text) return text;
  }

  const shortSide = Math.min(imgW, imgH);
  for (const divisor of [2.5, 4]) {
    const tile = Math.round(shortSide / divisor);
    if (tile < 120) continue;
    const step = Math.round(tile / 2);
    const outSide = Math.min(900, tile * 3);
    for (let y = 0; y < imgH; y += step) {
      for (let x = 0; x < imgW; x += step) {
        const region = {
          x: Math.min(x, Math.max(0, imgW - tile)),
          y: Math.min(y, Math.max(0, imgH - tile)),
          w: Math.min(tile, imgW),
          h: Math.min(tile, imgH),
        };
        const text = await decodeRegion(canvas, img, region, outSide, outSide, native);
        if (text) return text;
        await yieldToBrowser();
        if (x + tile >= imgW) break;
      }
      if (y + tile >= imgH) break;
    }
  }
  return null;
};

// Certificates downloaded from this app embed the QR code as an <img alt="QR Code">.
const decodeQrFromHtml = async (html: string): Promise<string | null> => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const images = Array.from(doc.querySelectorAll("img"));
  const ordered = [
    ...images.filter((el) => el.alt === "QR Code"),
    ...images.filter((el) => el.alt !== "QR Code"),
  ];

  for (const el of ordered) {
    const src = el.getAttribute("src");
    if (!src) continue;
    try {
      const text = await decodeQrFromImage(await loadImage(src));
      if (text) return text;
    } catch {}
  }
  return null;
};

const extractCertId = (qrText: string) => {
  const text = qrText.trim();
  try {
    const url = new URL(text);
    return { certId: url.searchParams.get("cert_id")?.trim() || null, host: url.host };
  } catch {
    return { certId: /^[0-9a-f-]{16,}$/i.test(text) ? text : null, host: null };
  }
};

const isHtmlFile = (file: File) =>
  file.type === "text/html" || /\.html?$/i.test(file.name);

export function CertVerifier() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState("");
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [htmlPreview, setHtmlPreview] = useState("");
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<VerifyResult>({ status: "idle" });

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const verifyFile = async (file: File) => {
    setFileName(file.name);
    setImagePreviewUrl("");
    setHtmlPreview("");

    const isHtml = isHtmlFile(file);
    if (!isHtml && !file.type.startsWith("image/")) {
      setResult({ status: "failed", message: "不支持的文件类型，请上传图片或下载的 HTML 证书。" });
      return;
    }

    setResult({ status: "working", message: "正在识别证书上的二维码..." });

    let qrText: string | null = null;
    try {
      if (isHtml) {
        const text = await file.text();
        setHtmlPreview(text);
        qrText = await decodeQrFromHtml(text);
      } else {
        const url = URL.createObjectURL(file);
        setImagePreviewUrl(url);
        qrText = await decodeQrFromImage(await loadImage(url));
      }
    } catch (err) {
      setResult({ status: "failed", message: `文件读取失败：${String(err)}` });
      return;
    }

    if (!qrText) {
      setResult({
        status: "failed",
        message: "未在证书上识别到二维码，请上传更清晰的证书图片。",
      });
      return;
    }

    const { certId, host } = extractCertId(qrText);
    if (!certId) {
      setResult({
        status: "failed",
        message: "二维码中没有证书唯一码（cert_id），这不是有效的证书二维码。",
        qrText,
      });
      return;
    }

    setResult({ status: "working", message: "正在向服务器验证证书..." });

    try {
      const resp = await fetch(
        `${CERT_API_BASE}/api/verify_cert?cert_id=${encodeURIComponent(certId)}&resp_json=true`,
      );
      const body = await resp.json();
      if (resp.ok && body.success && body.data) {
        setResult({ status: "verified", qrText, qrHost: host, data: body.data });
      } else {
        setResult({
          status: "failed",
          message: body.error === "cert is not exist" || resp.ok
            ? "验证失败！未查询到该证书。"
            : `验证请求失败：${body.error ?? resp.status}`,
          qrText,
        });
      }
    } catch (err) {
      setResult({ status: "failed", message: `验证请求失败：${String(err)}`, qrText });
    }
  };

  const onFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void verifyFile(file);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          onFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
          dragging ? "border-primary bg-muted" : "border-border hover:border-primary"
        }`}
      >
        <p className="text-base font-medium text-foreground">点击或拖拽上传证书</p>
        <p className="text-sm text-muted-foreground">
          支持证书图片（PNG / JPG / 截图）或从本站下载的 HTML 证书
        </p>
        {fileName && <p className="text-sm text-muted-foreground">当前文件：{fileName}</p>}
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.html,.htm,text/html"
          className="hidden"
          onChange={(e) => {
            onFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {result.status === "working" && (
        <p className="text-center text-sm text-muted-foreground">{result.message}</p>
      )}

      {result.status === "verified" && (
        <div className="rounded-lg border border-green-600/40 bg-green-600/10 p-4 text-left">
          <h2 className="text-lg font-semibold text-green-700 dark:text-green-400">
            ✅ 验证成功！该证书真实有效
          </h2>
          {result.qrHost && result.qrHost !== CERT_API_HOST && (
            <p className="mt-2 text-sm text-amber-600">
              注意：证书二维码指向 {result.qrHost}，不是官方验证地址 {CERT_API_HOST}。
              以上结果来自官方服务器。
            </p>
          )}
          <p className="mt-3 text-sm font-medium text-foreground">该证书具体信息：</p>
          <ul className="mt-1 space-y-1 text-sm text-foreground">
            {Object.entries(result.data).map(([key, value]) => (
              <li key={key} className="break-all">
                <span className="font-medium">{key}</span>:{" "}
                {value !== null && typeof value === "object"
                  ? JSON.stringify(value)
                  : String(value ?? "")}
              </li>
            ))}
          </ul>
          <p className="mt-3 break-all text-xs text-muted-foreground">
            二维码内容：{result.qrText}
          </p>
        </div>
      )}

      {result.status === "failed" && (
        <div className="rounded-lg border border-red-600/40 bg-red-600/10 p-4 text-left">
          <h2 className="text-lg font-semibold text-red-700 dark:text-red-400">
            ❌ {result.message}
          </h2>
          {result.qrText && (
            <p className="mt-2 break-all text-xs text-muted-foreground">
              二维码内容：{result.qrText}
            </p>
          )}
        </div>
      )}

      {imagePreviewUrl && (
        <div className="overflow-hidden rounded-lg border border-border">
          <img src={imagePreviewUrl} alt="证书预览" className="block h-auto w-full" />
        </div>
      )}

      {htmlPreview && (
        <iframe
          title="证书预览"
          srcDoc={htmlPreview}
          sandbox=""
          className="h-[480px] w-full rounded-lg border border-border bg-white"
        />
      )}
    </div>
  );
}
