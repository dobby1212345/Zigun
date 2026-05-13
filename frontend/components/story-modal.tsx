"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Story, Comment } from "@/lib/types"
import { createComment, getComments } from "@/lib/backend-api"
import { Send, User } from "lucide-react"

const DEFAULT_FONT_SIZE_PERCENT = 100
const MIN_FONT_SIZE_PERCENT = 80
const MAX_FONT_SIZE_PERCENT = 140
const FONT_SIZE_STEP_PERCENT = 10

interface StoryModalProps {
  story: Story | null
  open: boolean
  onClose: () => void
}

export function StoryModal({ story, open, onClose }: StoryModalProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")
  const [authorName, setAuthorName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fontSizePercent, setFontSizePercent] = useState(DEFAULT_FONT_SIZE_PERCENT)

  useEffect(() => {
    if (story && open) {
      fetchComments()
    }
  }, [story, open])

  useEffect(() => {
    if (!open) {
      setFontSizePercent(DEFAULT_FONT_SIZE_PERCENT)
    }
  }, [open])

  const fetchComments = async () => {
    if (!story) return
    const data = await getComments(story.id)
    setComments(data)
  }

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!story || !newComment.trim() || !authorName.trim()) return

    setIsSubmitting(true)

    try {
      await createComment({
        story_id: story.id,
        author_name: authorName,
        content: newComment,
      })
      setNewComment("")
      await fetchComments()
    } catch {
      // 댓글 저장 실패 시 기존 목록은 유지합니다.
    }

    setIsSubmitting(false)
  }

  if (!story) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 overflow-hidden">
        <ScrollArea className="max-h-[90vh]">
          <div className="p-6">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-balance">{story.title}</DialogTitle>
            </DialogHeader>

            <div className="mt-4 flex items-center justify-end gap-2">
              <span className="text-sm text-muted-foreground">글자 크기</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setFontSizePercent((prev) => Math.max(MIN_FONT_SIZE_PERCENT, prev - FONT_SIZE_STEP_PERCENT))
                }
                disabled={fontSizePercent <= MIN_FONT_SIZE_PERCENT}
              >
                A-
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFontSizePercent(DEFAULT_FONT_SIZE_PERCENT)}
                disabled={fontSizePercent === DEFAULT_FONT_SIZE_PERCENT}
              >
                기본
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setFontSizePercent((prev) => Math.min(MAX_FONT_SIZE_PERCENT, prev + FONT_SIZE_STEP_PERCENT))
                }
                disabled={fontSizePercent >= MAX_FONT_SIZE_PERCENT}
              >
                A+
              </Button>
            </div>

            <div className="mt-6 prose prose-sm max-w-none">
              <div
                className="whitespace-pre-wrap text-foreground leading-relaxed"
                style={{ fontSize: `${fontSizePercent}%` }}
              >
                {story.content}
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-border">
              <h4 className="font-semibold text-lg mb-4">댓글 ({comments.length})</h4>
              
              <div className="space-y-4 mb-6">
                {comments.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">첫 댓글을 남겨보세요!</p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="bg-muted/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                          <User className="w-4 h-4 text-foreground" />
                        </div>
                        <span className="font-medium text-sm">{comment.author_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(comment.created_at).toLocaleDateString("ko-KR")}
                        </span>
                      </div>
                      <p className="text-sm text-foreground pl-10">{comment.content}</p>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleSubmitComment} className="space-y-3">
                <Input
                  placeholder="이름"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  className="bg-card"
                />
                <div className="flex gap-2">
                  <Textarea
                    placeholder="댓글을 입력하세요..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="bg-card resize-none"
                    rows={2}
                  />
                  <Button 
                    type="submit" 
                    disabled={isSubmitting || !newComment.trim() || !authorName.trim()}
                    className="shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
