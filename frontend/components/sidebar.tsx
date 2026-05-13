"use client"

import Link from "next/link"
import { MouseEvent, useState, useEffect, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import { User, FileText, BookOpen, Library, Settings, ChevronDown, ChevronRight, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"
import { Subcategory } from "@/lib/types"
import { getSubcategories } from "@/lib/backend-api"

const navItems = [
  { href: "/", label: "프로필", icon: User },
  { href: "/synopsis", label: "시놉시스", icon: FileText },
  { href: "/free-board", label: "자유 게시판", icon: MessageSquare },
]

const FREE_BOARD_EASTER_EGG_TARGET_CLICKS = 8
const FREE_BOARD_EASTER_EGG_ROUTE = "/secret-arcade-8"
const FREE_BOARD_CONSECUTIVE_CLICK_WINDOW_MS = 1500

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [expandedCategories, setExpandedCategories] = useState<{ short: boolean; long: boolean }>({
    short: true,
    long: true
  })
  const [siteTitle, setSiteTitle] = useState("작가의 서재")
  const freeBoardTapCountRef = useRef(0)
  const freeBoardLastTapAtRef = useRef(0)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("site_title_config_v1")
      if (raw) {
        const p = JSON.parse(raw)
        if (p.title) setSiteTitle(p.title)
      }
    } catch {}
  }, [])

  const resetFreeBoardTapSequence = () => {
    freeBoardTapCountRef.current = 0
    freeBoardLastTapAtRef.current = 0
  }

  useEffect(() => {
    const fetchSubcategories = async () => {
      const data = await getSubcategories()
      setSubcategories(data)
    }

    void fetchSubcategories()
  }, [])

  const shortSubcategories = subcategories.filter(s => s.parent_category === 'short')
  const longSubcategories = subcategories.filter(s => s.parent_category === 'long')

  const toggleCategory = (category: 'short' | 'long') => {
    resetFreeBoardTapSequence()

    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }))
  }

  const handlePrimaryNavClick = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href !== "/free-board") {
      resetFreeBoardTapSequence()
      return
    }

    const now = Date.now()
    const withinWindow = now - freeBoardLastTapAtRef.current <= FREE_BOARD_CONSECUTIVE_CLICK_WINDOW_MS
    const nextCount = withinWindow ? freeBoardTapCountRef.current + 1 : 1

    freeBoardTapCountRef.current = nextCount
    freeBoardLastTapAtRef.current = now

    if (nextCount >= FREE_BOARD_EASTER_EGG_TARGET_CLICKS) {
      event.preventDefault()
      resetFreeBoardTapSequence()
      router.push(FREE_BOARD_EASTER_EGG_ROUTE)
    }
  }

  const isShortActive = pathname.startsWith('/short-stories')
  const isLongActive = pathname.startsWith('/long-stories')

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      <div className="p-6 border-b border-sidebar-border">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-medium text-lg">{siteTitle.charAt(0)}</span>
          </div>
          <div>
            <h1 className="font-bold text-lg text-sidebar-foreground">{siteTitle}</h1>
            <p className="text-xs text-muted-foreground">이야기를 담는 공간</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={(event) => handlePrimaryNavClick(event, item.href)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-sidebar-foreground hover:bg-sidebar-accent"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              </li>
            )
          })}

          {/* Short Stories with Subcategories */}
          <li>
            <button
              onClick={() => toggleCategory('short')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                isShortActive && pathname === '/short-stories'
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <BookOpen className="w-5 h-5" />
              <span className="font-medium flex-1 text-left">단편</span>
              {shortSubcategories.length > 0 && (
                expandedCategories.short ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
              )}
            </button>
            {expandedCategories.short && (
              <ul className="ml-4 mt-1 space-y-1">
                <li>
                  <Link
                    href="/short-stories"
                    onClick={resetFreeBoardTapSequence}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all duration-200",
                      pathname === '/short-stories'
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    )}
                  >
                    전체 보기
                  </Link>
                </li>
                {shortSubcategories.map((sub) => (
                  <li key={sub.id}>
                    <Link
                      href={`/short-stories/${sub.id}`}
                      onClick={resetFreeBoardTapSequence}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all duration-200",
                        pathname === `/short-stories/${sub.id}`
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      )}
                    >
                      {sub.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>

          {/* Long Stories with Subcategories */}
          <li>
            <button
              onClick={() => toggleCategory('long')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                isLongActive && pathname === '/long-stories'
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <Library className="w-5 h-5" />
              <span className="font-medium flex-1 text-left">장편</span>
              {longSubcategories.length > 0 && (
                expandedCategories.long ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
              )}
            </button>
            {expandedCategories.long && (
              <ul className="ml-4 mt-1 space-y-1">
                <li>
                  <Link
                    href="/long-stories"
                    onClick={resetFreeBoardTapSequence}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all duration-200",
                      pathname === '/long-stories'
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    )}
                  >
                    전체 보기
                  </Link>
                </li>
                {longSubcategories.map((sub) => (
                  <li key={sub.id}>
                    <Link
                      href={`/long-stories/${sub.id}`}
                      onClick={resetFreeBoardTapSequence}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all duration-200",
                        pathname === `/long-stories/${sub.id}`
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      )}
                    >
                      {sub.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        </ul>
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <Link
          href="/admin"
          onClick={resetFreeBoardTapSequence}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:bg-sidebar-accent transition-colors"
        >
          <Settings className="w-5 h-5" />
          <span className="font-medium">관리자</span>
        </Link>
      </div>
    </aside>
  )
}
