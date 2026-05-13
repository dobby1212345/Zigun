"use client"

import { useState } from "react"
import { Story } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { deleteStory } from "@/lib/backend-api"
import { Edit, Trash2, Eye, EyeOff, AlertCircle } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface StoriesListProps {
  stories: Story[]
  onEdit: (story: Story) => void
  onDelete: (storyId: string) => void
}

const categoryLabels: Record<Story["category"], string> = {
  synopsis: "시놉시스",
  short: "단편",
  long: "장편",
  short_story: "단편",
  long_story: "장편",
}

export function StoriesList({ stories, onEdit, onDelete }: StoriesListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!deletingId) return

    try {
      await deleteStory(deletingId)
      onDelete(deletingId)
    } catch {
      // 삭제 실패 시 목록 상태를 유지합니다.
    }

    setDeletingId(null)
  }

  if (stories.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          등록된 작품이 없습니다. 새 작품을 추가해주세요.
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {stories.map((story) => (
          <Card key={story.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-foreground truncate">{story.title}</h3>
                  <Badge variant="secondary" className="shrink-0">
                    {categoryLabels[story.category]}
                  </Badge>
                  {story.is_published !== false ? (
                    <Eye className="w-4 h-4 text-muted-foreground shrink-0" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {story.content.slice(0, 100)}...
                </p>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <Button variant="outline" size="sm" onClick={() => onEdit(story)}>
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeletingId(story.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              작품 삭제
            </AlertDialogTitle>
            <AlertDialogDescription>
              정말로 이 작품을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
