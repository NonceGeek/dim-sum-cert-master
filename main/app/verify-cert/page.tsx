import { Header } from "@/components/header";
import { CertVerifier } from "@/components/cert-verifier";
import { getReadmeConfig } from "@/lib/readme-config";

export default function VerifyCertPage() {
  const config = getReadmeConfig();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header homepageName={config.homepageName} />

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            证书验证
          </h1>
          <p className="text-xl text-muted-foreground">
            上传证书，自动识别证书上的二维码并验证证书真伪。
            <br></br>
            💡Tips: 直接扫描证书二维码也可以验证。
          </p>
        </div>
        <br></br>
        <hr></hr>
        <br></br>
        <CertVerifier />
      </main>

      <footer className="border-t border-border mt-auto">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>
            {config.homepageName} by{" "}
            <a
              href={config.twitterUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground transition-colors"
            >
              {config.twitterNicename}
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
