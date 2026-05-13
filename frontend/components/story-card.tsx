"use client"

import { Story } from "@/lib/types"
import { Card, CardContent } from "@/components/ui/card"
import { BookOpen } from "lucide-react"

interface StoryCardProps {
  story: Story
  onClick: () => void
}

export function StoryCard({ story, onClick }: StoryCardProps) {
  return (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1 overflow-hidden group"
      onClick={onClick}
    >
      <div className="aspect-[3/4] relative bg-gradient-to-br from-secondary to-muted flex items-center justify-center">
        {story.cover_image_url ? (
          <img 
            src={story.cover_image_url} 
            alt={story.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <BookOpen className="w-12 h-12 text-foreground/30" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <CardContent className="p-4">
        <h3 className="font-semibold text-foreground line-clamp-2 text-balance">{story.title}</h3>
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
          {story.content.slice(0, 100)}...
        </p>
      </CardContent>
    </Card>
  )
}
