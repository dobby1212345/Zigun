"use client"

import { ChangeEvent, useEffect, useState } from "react"
import { Story, Subcategory } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createStory, getSubcategories, importStoryFromFile, updateStory } from "@/lib/backend-api"
import { Save, X, Loader2 } from "lucide-react"

const MAX_STORY_FILE_SIZE_BYTES = 10 * 1024 * 1024

interface StoryEditorProps {
  story: Story | null
  onSave: (story: Story) => void
  onCancel: () => void
}

function normalizeStoryCategory(category: Story["category"] | null | undefined) {
  if (category === "short") return "short_story"
  if (category === "long") return "long_story"
  return category || "short_story"
}

export function StoryEditor({ story, onSave, onCancel }: StoryEditorProps) {
  const [title, setTitle] = useState(story?.title || "")
  const [content, setContent] = useState(story?.content || "")
  const [category, setCategory] = useState<Story["category"]>(normalizeStoryCategory(story?.category))
  const [subcategoryId, setSubcategoryId] = useState<string | null>(story?.subcategory_id || null)
  const [thumbnailUrl, setThumbnailUrl] = useState(story?.thumbnail_url || "")
  const [isImporting, setIsImporting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState<string | null>(null)
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])

  useEffect(() => {
    void fetchSubcategories()
  }, [])

  useEffect(() => {
    // Reset subcategory when category changes to one without subcategories
    if (category === 'synopsis') {
      setSubcategoryId(null)
    }
  }, [category])

  const fetchSubcategories = async () => {
    const data = await getSubcategories()
    setSubcategories(data)
  }

  const activeParentCategory =
    category === 'short' || category === 'short_story'
      ? 'short'
      : category === 'long' || category === 'long_story'
        ? 'long'
        : null
  const filteredSubcategories = activeParentCategory
    ? subcategories.filter(s => s.parent_category === activeParentCategory)
    : []

  const handleStoryFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.currentTarget.value = ""

    if (!file) {
      return
    }

    setSaveError(null)
    setImportSuccess(null)

    if (file.size > MAX_STORY_FILE_SIZE_BYTES) {
      setSaveError("파일 크기는 10MB 이하만 업로드할 수 있습니다.")
      return
    }

    setIsImporting(true)

    try {
      const imported = await importStoryFromFile(file)

      setTitle((prev) => (prev.trim() ? prev : imported.suggested_title))
      setContent(imported.content)
      setImportSuccess("파일 내용을 불러왔습니다. 내용을 확인한 뒤 저장해 주세요.")
    } catch (error: any) {
      setSaveError(error?.message || "파일 변환 중 오류가 발생했습니다.")
      setImportSuccess(null)
    } finally {
      setIsImporting(false)
    }
  }

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return

    setIsSaving(true)
    setSaveError(null)

    const storyData = {
      title,
      content,
      category: normalizeStoryCategory(category),
      subcategory_id: (normalizeStoryCategory(category) === 'short_story' || normalizeStoryCategory(category) === 'long_story') ? subcategoryId : null,
      thumbnail_url: thumbnailUrl || null,
      cover_image_url: thumbnailUrl || null,
    }

    try {
      if (story) {
        const data = await updateStory(story.id, storyData)
        onSave(data)
      } else {
        const data = await createStory(storyData)
        onSave(data)
      }
    } catch (error: any) {
      setSaveError(error?.message || "작품 저장 중 오류가 발생했습니다.")
    }

    setIsSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="title">제목</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="작품 제목"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">카테고리</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as Story["category"])}>
            <SelectTrigger>
              <SelectValue placeholder="카테고리 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="synopsis">시놉시스</SelectItem>
              <SelectItem value="short_story">단편</SelectItem>
              <SelectItem value="long_story">장편</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {(normalizeStoryCategory(category) === 'short_story' || normalizeStoryCategory(category) === 'long_story') && (
        <div className="space-y-2">
          <Label htmlFor="subcategory">세부 카테고리</Label>
          <Select 
            value={subcategoryId || "none"} 
            onValueChange={(v) => setSubcategoryId(v === "none" ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="세부 카테고리 선택 (선택사항)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">없음</SelectItem>
              {filteredSubcategories.map((sub) => (
                <SelectItem key={sub.id} value={sub.id}>
                  {sub.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filteredSubcategories.length === 0 && (
            <p className="text-xs text-muted-foreground">
              세부 카테고리가 없습니다. 관리자 &gt; 카테고리에서 추가하세요.
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="content">내용</Label>
        <Input
          id="storyFile"
          type="file"
          accept=".hwpx,.docx,.txt,.md,.markdown,.hwp"
          onChange={handleStoryFileChange}
          className="max-w-md cursor-pointer"
        />
        <p className="text-xs text-muted-foreground">
          작품 파일 업로드 지원: hwpx, docx, txt, md (hwp는 한글에서 hwpx/txt로 저장 후 업로드)
        </p>
        {isImporting && (
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            파일 내용을 변환 중입니다...
          </p>
        )}
        <Textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="작품 내용을 입력하세요"
          rows={12}
          className="resize-none"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="thumbnailUrl">썸네일 이미지 URL</Label>
        <Input
          id="thumbnailUrl"
          value={thumbnailUrl}
          onChange={(e) => setThumbnailUrl(e.target.value)}
          placeholder="https://example.com/thumbnail.jpg"
        />
      </div>

      {saveError && <p className="text-sm text-destructive">{saveError}</p>}
      {importSuccess && <p className="text-sm text-emerald-600">{importSuccess}</p>}

      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={isSaving || isImporting || !title.trim() || !content.trim()}>
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              저장 중...
            </>
          ) : isImporting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              파일 변환 중...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              저장
            </>
          )}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          <X className="w-4 h-4 mr-2" />
          취소
        </Button>
      </div>
    </div>
  )
}
