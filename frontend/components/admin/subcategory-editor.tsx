"use client"

import { useState, useEffect } from "react"
import { Subcategory } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  createSubcategory,
  deleteSubcategory,
  getSubcategories,
  updateSubcategory,
} from "@/lib/backend-api"
import { Plus, Pencil, Trash2, Save, X, Loader2, GripVertical } from "lucide-react"

export function SubcategoryEditor() {
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newName, setNewName] = useState("")
  const [newCategory, setNewCategory] = useState<'short' | 'long'>('short')
  const [editName, setEditName] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    void fetchSubcategories()
  }, [])

  const fetchSubcategories = async () => {
    setIsLoading(true)

    try {
      const data = await getSubcategories()
      setSubcategories(data)
    } catch (error: any) {
      setErrorMessage(error?.message || "세부 카테고리 목록을 불러오지 못했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleAdd = async () => {
    if (!newName.trim()) return
    setIsSaving(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    const maxOrder = subcategories
      .filter(s => (s as any).parent_category === newCategory)
      .reduce((max, s) => Math.max(max, s.sort_order), -1)

    try {
      const data = await createSubcategory({
        name: newName.trim(),
        parent_category: newCategory,
        sort_order: maxOrder + 1
      })

      setSubcategories([...subcategories, data])
      setNewName("")
      setIsAdding(false)
      setSuccessMessage("세부 카테고리가 저장되었습니다.")
    } catch (error: any) {
      setErrorMessage(error?.message || "세부 카테고리 저장 중 오류가 발생했습니다.")
      setSuccessMessage(null)
    }

    setIsSaving(false)
  }

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return
    setIsSaving(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const data = await updateSubcategory(id, { name: editName.trim() })
      setSubcategories(subcategories.map(s => s.id === id ? data : s))
      setEditingId(null)
      setEditName("")
      setSuccessMessage("세부 카테고리가 수정되었습니다.")
    } catch (error: any) {
      setErrorMessage(error?.message || "세부 카테고리 수정 중 오류가 발생했습니다.")
      setSuccessMessage(null)
    }

    setIsSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("이 세부 카테고리를 삭제하시겠습니까? 연결된 작품들의 세부 카테고리가 해제됩니다.")) return

    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      await deleteSubcategory(id)
      setSubcategories(subcategories.filter(s => s.id !== id))
      setSuccessMessage("세부 카테고리가 삭제되었습니다.")
    } catch (error: any) {
      setErrorMessage(error?.message || "세부 카테고리 삭제 중 오류가 발생했습니다.")
      setSuccessMessage(null)
    }
  }

  const startEdit = (subcategory: Subcategory) => {
    setEditingId(subcategory.id)
    setEditName(subcategory.name)
  }

  const shortSubcategories = subcategories.filter(s => s.parent_category === 'short')
  const longSubcategories = subcategories.filter(s => s.parent_category === 'long')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">세부 카테고리 관리</h3>
        {!isAdding && (
          <Button onClick={() => setIsAdding(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            추가
          </Button>
        )}
      </div>

      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
      {successMessage && <p className="text-sm text-emerald-600">{successMessage}</p>}

      {isAdding && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex gap-3 items-end">
              <div className="flex-1 space-y-2">
                <Label>카테고리명</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="세부 카테고리 이름"
                />
              </div>
              <div className="w-32 space-y-2">
                <Label>상위 카테고리</Label>
                <Select value={newCategory} onValueChange={(v) => setNewCategory(v as 'short' | 'long')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short">단편</SelectItem>
                    <SelectItem value="long">장편</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAdd} disabled={isSaving || !newName.trim()}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              </Button>
              <Button variant="outline" onClick={() => { setIsAdding(false); setNewName("") }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">단편 세부 카테고리</CardTitle>
          </CardHeader>
          <CardContent>
            {shortSubcategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">세부 카테고리가 없습니다</p>
            ) : (
              <ul className="space-y-2">
                {shortSubcategories.map((sub) => (
                  <li key={sub.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                    {editingId === sub.id ? (
                      <>
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 h-8"
                        />
                        <Button size="sm" variant="ghost" onClick={() => handleUpdate(sub.id)} disabled={isSaving}>
                          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm">{sub.name}</span>
                        <Button size="sm" variant="ghost" onClick={() => startEdit(sub)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(sub.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">장편 세부 카테고리</CardTitle>
          </CardHeader>
          <CardContent>
            {longSubcategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">세부 카테고리가 없습니다</p>
            ) : (
              <ul className="space-y-2">
                {longSubcategories.map((sub) => (
                  <li key={sub.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                    {editingId === sub.id ? (
                      <>
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 h-8"
                        />
                        <Button size="sm" variant="ghost" onClick={() => handleUpdate(sub.id)} disabled={isSaving}>
                          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm">{sub.name}</span>
                        <Button size="sm" variant="ghost" onClick={() => startEdit(sub)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(sub.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
