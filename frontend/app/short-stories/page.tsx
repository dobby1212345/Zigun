import { getStories, type StorySortOrder } from "@/lib/backend-api"
import { MainLayout } from "@/components/main-layout"
import { StoriesGrid } from "@/components/stories-grid"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface Props {
  searchParams: Promise<{ sort?: string | string[] }>
}

function normalizeSortOrder(sort: string | string[] | undefined): StorySortOrder {
  const value = Array.isArray(sort) ? sort[0] : sort
  return value === "oldest" ? "oldest" : "newest"
}

export default async function ShortStoriesPage({ searchParams }: Props) {
  const resolvedSearchParams = await searchParams
  const sortOrder = normalizeSortOrder(resolvedSearchParams.sort)
  const stories = await getStories({
    categories: ["short_story", "short"],
    sort: sortOrder,
  })
  const sortedStories = [...stories].sort((a, b) => {
    const aTime = new Date(a.created_at).getTime()
    const bTime = new Date(b.created_at).getTime()
    return sortOrder === "oldest" ? aTime - bTime : bTime - aTime
  })

  return (
    <MainLayout>
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">단편</h1>
              <p className="text-muted-foreground mt-2">짧은 이야기 모음</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">정렬</span>
              <Link
                href="/short-stories"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  sortOrder === "newest" &&
                    "border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
                )}
              >
                새롭게 올라온 순서
              </Link>
              <Link
                href="/short-stories?sort=oldest"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  sortOrder === "oldest" &&
                    "border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
                )}
              >
                오래된 순서
              </Link>
            </div>
          </div>
          <StoriesGrid stories={sortedStories} />
        </div>
      </div>
    </MainLayout>
  )
}
