"use client"

import { useState } from "react"
import { Story } from "@/lib/types"
import { StoryCard } from "./story-card"
import { StoryModal } from "./story-modal"
import { BookOpen } from "lucide-react"

interface StoriesGridProps {
  stories: Story[]
}

export function StoriesGrid({ stories }: StoriesGridProps) {
  const [selectedStory, setSelectedStory] = useState<Story | null>(null)

  if (stories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
          <BookOpen className="w-10 h-10 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">아직 작품이 없습니다</h3>
        <p className="text-muted-foreground">관리자 페이지에서 새 작품을 추가해주세요.</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {stories.map((story) => (
          <StoryCard
            key={story.id}
            story={story}
            onClick={() => setSelectedStory(story)}
          />
        ))}
      </div>

      <StoryModal
        story={selectedStory}
        open={!!selectedStory}
        onClose={() => setSelectedStory(null)}
      />
    </>
  )
}
