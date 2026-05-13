import { getStories } from "@/lib/backend-api"
import { MainLayout } from "@/components/main-layout"
import { SynopsisEaster } from "@/components/synopsis-easter"
import { StoriesGrid } from "@/components/stories-grid"

export default async function SynopsisPage() {
  const stories = await getStories({ categories: ["synopsis"] })

  return (
    <MainLayout>
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <SynopsisEaster>시놉시스</SynopsisEaster>
            <p className="text-muted-foreground mt-2">이야기의 줄거리와 기획안</p>
          </div>
          <StoriesGrid stories={stories} />
        </div>
      </div>
    </MainLayout>
  )
}
