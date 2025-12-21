import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Music, Video, Image, Archive, Link, ExternalLink, Download, FolderOpen } from "lucide-react";

type Resource = {
  id: string;
  title: string;
  type: "pdf" | "audio" | "video" | "image" | "zip" | "link";
  url: string;
  folder: string;
  tags?: string;
};

const mockResources: Resource[] = [
  {
    id: "1",
    title: "Hifz Syllabus",
    type: "pdf",
    url: "https://example.com/hifz-syllabus.pdf",
    folder: "Hifz",
    tags: "syllabus,level-1",
  },
  {
    id: "2",
    title: "Qaida Audio Lesson",
    type: "audio",
    url: "https://example.com/qaida-audio.mp3",
    folder: "Nazrah",
    tags: "audio,practice",
  },
  {
    id: "3",
    title: "Training Video Link",
    type: "link",
    url: "https://youtube.com/watch?v=xxxx",
    folder: "Teacher Training",
  },
];

const getTypeIcon = (type: Resource["type"]) => {
  switch (type) {
    case "pdf":
      return <FileText className="h-5 w-5 text-destructive" />;
    case "audio":
      return <Music className="h-5 w-5 text-primary" />;
    case "video":
      return <Video className="h-5 w-5 text-chart-1" />;
    case "image":
      return <Image className="h-5 w-5 text-chart-2" />;
    case "zip":
      return <Archive className="h-5 w-5 text-chart-3" />;
    case "link":
      return <Link className="h-5 w-5 text-chart-4" />;
    default:
      return <FileText className="h-5 w-5" />;
  }
};

export default function Resources() {
  const { profile, isSuperAdmin } = useAuth();

  // Check if user is admin or super admin
  const isAdminUser = isSuperAdmin;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Resource Library</h1>
        {isAdminUser && (
          <Button>
            Upload Resource
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {mockResources.map((res) => (
          <Card key={res.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                {getTypeIcon(res.type)}
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg truncate">{res.title}</CardTitle>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <FolderOpen className="h-3 w-3" />
                    <span>{res.folder}</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {res.tags && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {res.tags.split(",").map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag.trim()}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => window.open(res.url, "_blank")}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Open
                </Button>
                {res.type !== "link" && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1"
                    asChild
                  >
                    <a href={res.url} download>
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {isAdminUser && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            Upload UI will be added next (Admin only)
          </CardContent>
        </Card>
      )}
    </div>
  );
}
