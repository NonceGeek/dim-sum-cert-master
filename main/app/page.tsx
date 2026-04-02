import { Header } from "@/components/header";
import { TemplateSelector } from "@/components/template-selector";
import { getReadmeConfig } from "@/lib/readme-config";

const markdownToHtml = (markdown: string) => {
  const escaped = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const withLinks = escaped.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="underline hover:text-foreground transition-colors">$1</a>',
  );
  const withBold = withLinks.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  return withBold.replace(/\n/g, "<br />");
};

const TEMPLATES = [
  {
    name: "语料贡献者模板",
    file_name: "aidimsum_dataset_contributor.png",
    vars: [
      {
        var_name: "name",
        default_value: "cool guy",
        type: "text",
        font_size: 48,
        position: { x: 200, y: 190 },
      },
      {
        var_name: "dataset_name",
        default_value: "「广府童谣」语料集，",
        type: "text",
        font_size: 12,
        position: { x: 377, y: 264 },
      },
      {
        var_name: "cert_date",
        default_value: "2026-04-02",
        type: "text",
        font_size: 12,
        position: { x: 350, y: 375 },
      },
      {
        var_name: "qr_code",
        default_value: "",
        type: "qr_code",
        font_size: 80,
        position: { x: 150, y: 320 },
      },
    ],
  },
];

export default function Home() {
  const config = getReadmeConfig();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header homepageName={config.homepageName} />

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              {config.homepageName}
            </h1>
            <p
              className="text-xl text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: markdownToHtml(config.descriptionMarkdown) }}
            />
          </div>
        </div>
        <br></br>
        <hr></hr>
        <br></br>
        <TemplateSelector templates={TEMPLATES} />
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
