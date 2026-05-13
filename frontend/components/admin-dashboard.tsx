"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Profile, Story } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProfileEditor } from "./admin/profile-editor"
import { StoryEditor } from "./admin/story-editor"
import { StoriesList } from "./admin/stories-list"
import { SubcategoryEditor } from "./admin/subcategory-editor"
import { LogOut, User, FileText, Plus, FolderTree, MessageSquare, ArrowLeftCircle } from "lucide-react"
import Link from "next/link"

interface AdminDashboardProps {
  initialProfile: Profile | null
  initialStories: Story[]
}

export function AdminDashboard({ initialProfile, initialStories }: AdminDashboardProps) {
  const [profile, setProfile] = useState<Profile | null>(initialProfile)
  const [stories, setStories] = useState<Story[]>(initialStories)
  const [editingStory, setEditingStory] = useState<Story | null>(null)
  const [isCreatingStory, setIsCreatingStory] = useState(false)
  const [siteTitle, setSiteTitle] = useState("작가의 서재")
  const router = useRouter()

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("site_title_config_v1")
      if (raw) {
        const p = JSON.parse(raw)
        if (p.title) setSiteTitle(p.title)
      }
    } catch {}
  }, [])

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" })
    router.push("/admin")
  }

  const handleProfileUpdate = (updatedProfile: Profile) => {
    setProfile(updatedProfile)
  }

  const handleStoryCreate = (newStory: Story) => {
    setStories([newStory, ...stories])
    setIsCreatingStory(false)
  }

  const handleStoryUpdate = (updatedStory: Story) => {
    setStories(stories.map((s) => (s.id === updatedStory.id ? updatedStory : s)))
    setEditingStory(null)
  }

  const handleStoryDelete = (storyId: string) => {
    setStories(stories.filter((s) => s.id !== storyId))
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-bold text-foreground">
              {siteTitle}
            </Link>
            <span className="px-2 py-1 bg-primary/20 text-primary text-xs font-medium rounded">
              관리자
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/">
                <ArrowLeftCircle className="w-4 h-4 mr-2" />
                관리자 모드 나가기
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/board">
                <MessageSquare className="w-4 h-4 mr-2" />
                게시판 관리
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              로그아웃
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full max-w-xl grid-cols-3">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              프로필
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center gap-2">
              <FolderTree className="w-4 h-4" />
              카테고리
            </TabsTrigger>
            <TabsTrigger value="stories" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              작품 관리
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>프로필 관리</CardTitle>
              </CardHeader>
              <CardContent>
                <ProfileEditor profile={profile} onUpdate={handleProfileUpdate} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories">
            <Card>
              <CardHeader>
                <CardTitle>카테고리 관리</CardTitle>
              </CardHeader>
              <CardContent>
                <SubcategoryEditor />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stories" className="space-y-6">
            {(editingStory || isCreatingStory) ? (
              <Card>
                <CardHeader>
                  <CardTitle>{editingStory ? "작품 수정" : "새 작품 추가"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <StoryEditor
                    story={editingStory}
                    onSave={editingStory ? handleStoryUpdate : handleStoryCreate}
                    onCancel={() => {
                      setEditingStory(null)
                      setIsCreatingStory(false)
                    }}
                  />
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">작품 목록</h2>
                  <Button onClick={() => setIsCreatingStory(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    새 작품 추가
                  </Button>
                </div>
                <StoriesList
                  stories={stories}
                  onEdit={setEditingStory}
                  onDelete={handleStoryDelete}
                />
              </>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
