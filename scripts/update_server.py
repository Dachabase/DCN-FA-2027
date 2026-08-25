import re

server_path = "/Users/daviditoya/Downloads/SBAI4FA27/src/server.ts"

with open(server_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Replace the FALLBACK_GUIDES definition block
# Match from const FALLBACK_GUIDES = [ up to const GOOGLE_DRIVE_VAULT_URL
old_fallback_pattern = r'const FALLBACK_GUIDES = \[[\s\S]*?\n\];\n\nconst GOOGLE_DRIVE_VAULT_URL'
new_fallback_replacement = 'const FALLBACK_GUIDES = ALL_GUIDES;\n\nconst GOOGLE_DRIVE_VAULT_URL'

if re.search(old_fallback_pattern, content):
    content = re.sub(old_fallback_pattern, new_fallback_replacement, content)
    print("✅ Successfully replaced FALLBACK_GUIDES with ALL_GUIDES in server.ts")
else:
    print("⚠️ Pattern for FALLBACK_GUIDES not matched")

# 2. Enhance GET /api/guides/:id to include series navigation
old_guide_handler = r'(\/\/ GET \/api\/guides\/:id \(Protected\)[\s\S]*?res\.json\(\{[\s\S]*?success: true,[\s\S]*?data: \{[\s\S]*?\.\.\.fallbackGuide,[\s\S]*?verified: fallbackGuide\.status === "PUBLISHED",[\s\S]*?\}[\s\S]*?\}\);\n\}\);)'

new_guide_handler = """// GET /api/guides/:id (Protected)
app.get("/api/guides/:id", requireAuth, async (req: Request, res: Response) => {
  const guideId = String(req.params.id);
  
  // Helper to compute series navigation
  const attachSeriesNavigation = (g: any, allList: any[]) => {
    let seriesGuides: any[] = [];
    let prevGuide: any = null;
    let nextGuide: any = null;

    if (g.seriesId) {
      seriesGuides = allList
        .filter((item: any) => item.seriesId === g.seriesId)
        .sort((a: any, b: any) => (a.seriesOrder || 0) - (b.seriesOrder || 0))
        .map((item: any) => ({
          id: item.id,
          title: item.title,
          seriesOrder: item.seriesOrder,
          seriesTotal: item.seriesTotal,
        }));
      
      const currentOrder = g.seriesOrder || 1;
      const prev = seriesGuides.find((item: any) => item.seriesOrder === currentOrder - 1);
      const next = seriesGuides.find((item: any) => item.seriesOrder === currentOrder + 1);
      if (prev) prevGuide = { id: prev.id, title: prev.title, seriesOrder: prev.seriesOrder };
      if (next) nextGuide = { id: next.id, title: next.title, seriesOrder: next.seriesOrder };
    }

    return {
      ...g,
      body: g.content || g.body,
      verified: g.status === "PUBLISHED",
      seriesGuides,
      prevGuide,
      nextGuide,
    };
  };

  try {
    const guide = await prisma.guide.findUnique({
      where: { id: guideId },
      include: {
        faculty: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true } },
      },
    });

    if (guide) {
      if ((req as any).user?.id) {
        prisma.interaction.create({
          data: {
            userId: (req as any).user.id,
            eventType: "VIEW_GUIDE",
            resourceId: guide.id,
            metadata: { title: guide.title, category: guide.category },
          }
        }).catch(err => console.warn("Guide interaction log error:", err));
      }

      let allSeries: any[] = [];
      if (guide.seriesId) {
        allSeries = await prisma.guide.findMany({
          where: { seriesId: guide.seriesId },
          orderBy: { seriesOrder: "asc" },
        });
      }

      return res.json({
        success: true,
        data: attachSeriesNavigation(guide, allSeries.length > 0 ? allSeries : FALLBACK_GUIDES),
      });
    }
  } catch (error) {
    console.warn("DB error fetching guide.");
  }

  const fallbackGuide = FALLBACK_GUIDES.find(g => g.id === guideId) || FALLBACK_GUIDES[0];
  res.json({
    success: true,
    data: attachSeriesNavigation(fallbackGuide, FALLBACK_GUIDES),
  });
});"""

if re.search(old_guide_handler, content):
    content = re.sub(old_guide_handler, new_guide_handler, content)
    print("✅ Successfully updated GET /api/guides/:id with series navigation")
else:
    print("⚠️ Pattern for guide handler not matched")

with open(server_path, "w", encoding="utf-8") as f:
    f.write(content)
