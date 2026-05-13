"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function AdminEasterPage() {
  const SYN_KEY = "synopsis_easter_config_v1"
  const PROF_KEY = "profile_easter_config_v1"
  const SITE_TITLE_KEY = "site_title_config_v1"

  const [synHref, setSynHref] = useState("/secret-arcade-8")
  const [synCount, setSynCount] = useState(12)

  const [profHref, setProfHref] = useState("/secret-arcade-8")
  const [profCount, setProfCount] = useState(20)

  const [siteTitle, setSiteTitle] = useState("작가의 서재")

  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SYN_KEY)
      if (raw) {
        const p = JSON.parse(raw)
        if (p.href) setSynHref(p.href)
        if (typeof p.countTo === "number") setSynCount(p.countTo)
      }
    } catch {}

    try {
      const raw = window.localStorage.getItem(PROF_KEY)
      if (raw) {
        const p = JSON.parse(raw)
        if (p.href) setProfHref(p.href)
        if (typeof p.countTo === "number") setProfCount(p.countTo)
      }
    } catch {}

    try {
      const raw = window.localStorage.getItem(SITE_TITLE_KEY)
      if (raw) {
        const p = JSON.parse(raw)
        if (p.title) setSiteTitle(p.title)
      }
    } catch {}
  }, [])

  const saveSyn = () => {
    try {
      window.localStorage.setItem(SYN_KEY, JSON.stringify({ href: synHref, countTo: Number(synCount) }))
      setMessage("시놉시스 이스터에그가 저장되었습니다.")
      setTimeout(() => setMessage(null), 2000)
    } catch {
      setMessage("저장 실패")
    }
  }

  const resetSyn = () => {
    window.localStorage.removeItem(SYN_KEY)
    setSynHref("/secret-arcade-8")
    setSynCount(12)
    setMessage("시놉시스 설정이 초기화되었습니다.")
    setTimeout(() => setMessage(null), 2000)
  }

  const saveProf = () => {
    try {
      window.localStorage.setItem(PROF_KEY, JSON.stringify({ href: profHref, countTo: Number(profCount) }))
      setMessage("프로필 이스터에그가 저장되었습니다.")
      setTimeout(() => setMessage(null), 2000)
    } catch {
      setMessage("저장 실패")
    }
  }

  const resetProf = () => {
    window.localStorage.removeItem(PROF_KEY)
    setProfHref("/secret-arcade-8")
    setProfCount(20)
    setMessage("프로필 설정이 초기화되었습니다.")
    setTimeout(() => setMessage(null), 2000)
  }

  const saveSiteTitle = () => {
    try {
      window.localStorage.setItem(SITE_TITLE_KEY, JSON.stringify({ title: siteTitle }))
      setMessage("사이트 제목이 저장되었습니다.")
      setTimeout(() => setMessage(null), 2000)
    } catch {
      setMessage("저장 실패")
    }
  }

  const resetSiteTitle = () => {
    window.localStorage.removeItem(SITE_TITLE_KEY)
    setSiteTitle("작가의 서재")
    setMessage("사이트 제목이 초기화되었습니다.")
    setTimeout(() => setMessage(null), 2000)
  }

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">이스터에그 설정</h1>

        <section className="rounded-lg border bg-card p-4">
          <h2 className="font-semibold">시놉시스</h2>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Input value={synHref} onChange={(e) => setSynHref(e.target.value)} />
            <Input type="number" value={synCount} onChange={(e) => setSynCount(Number(e.target.value) || 1)} />
            <div className="flex gap-2">
              <Button onClick={saveSyn}>저장</Button>
              <Button variant="outline" onClick={resetSyn}>초기화</Button>
            </div>
          </div>
        </section>

        <section className="rounded-lg border bg-card p-4">
          <h2 className="font-semibold">프로필</h2>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Input value={profHref} onChange={(e) => setProfHref(e.target.value)} />
            <Input type="number" value={profCount} onChange={(e) => setProfCount(Number(e.target.value) || 1)} />
            <div className="flex gap-2">
              <Button onClick={saveProf}>저장</Button>
              <Button variant="outline" onClick={resetProf}>초기화</Button>
            </div>
          </div>
        </section>

        <section className="rounded-lg border bg-card p-4">
          <h2 className="font-semibold">사이트 제목</h2>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Input value={siteTitle} onChange={(e) => setSiteTitle(e.target.value)} />
            <div className="flex gap-2">
              <Button onClick={saveSiteTitle}>저장</Button>
              <Button variant="outline" onClick={resetSiteTitle}>초기화</Button>
            </div>
          </div>
        </section>

        {message && <div className="text-sm text-muted-foreground">{message}</div>}
      </div>
    </div>
  )
}
