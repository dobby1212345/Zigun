"use client"

import { useCallback, useEffect, useRef, useState } from "react"

type Props = {
  children: React.ReactNode
  countTo?: number
  href?: string
}

export function SynopsisEaster({ children, countTo = 12, href = "/secret-arcade-8" }: Props) {
  const [count, setCount] = useState(0)
  const timerRef = useRef<number | null>(null)
  const CONFIG_STORAGE_KEY = "synopsis_easter_config_v1"

  const [configuredHref, setConfiguredHref] = useState(href)
  const [configuredCountTo, setConfiguredCountTo] = useState(countTo)
  const [isEditing, setIsEditing] = useState(false)

  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    fetch("/api/admin/status")
      .then((r) => r.json())
      .then((d) => {
        if (d && d.isAdmin) setIsAdmin(true)
      })
      .catch(() => {})
  }, [])

  const reset = useCallback(() => {
    setCount(0)
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.href) setConfiguredHref(parsed.href)
        if (typeof parsed.countTo === "number") setConfiguredCountTo(parsed.countTo)
      }
    } catch {
      // ignore
    }
  }, [])

  const handleClick = useCallback(() => {
    const next = count + 1
    setCount(next)

    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
    }

    // reset counter after 2 seconds of inactivity
    timerRef.current = window.setTimeout(() => setCount(0), 2000)

    if (next >= configuredCountTo) {
      // clear timer and navigate
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
      // navigate to target
      window.location.href = configuredHref
    }
  }, [count, countTo, href])

  return (
    // keep styling same as original header
    <div>
      <h1 onClick={handleClick} className="text-3xl font-bold text-foreground" style={{ cursor: "pointer" }}>
        {children}
      </h1>

      {isAdmin && (
        <div className="mt-2 flex flex-col gap-2 text-sm">
          {!isEditing ? (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">이스터에그 링크:</span>
              <span className="font-mono truncate">{configuredHref}</span>
              <button className="ml-2 rounded bg-primary px-2 py-1 text-white" onClick={() => setIsEditing(true)}>수정</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input value={configuredHref} onChange={(e) => setConfiguredHref(e.target.value)} className="input" />
              <input type="number" value={configuredCountTo} onChange={(e) => setConfiguredCountTo(Number(e.target.value) || 1)} className="input" />
              <div className="flex gap-2">
                <button
                  className="rounded bg-primary px-2 py-1 text-white"
                  onClick={() => {
                    try {
                      window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify({ href: configuredHref, countTo: configuredCountTo }))
                    } catch {}
                    setIsEditing(false)
                  }}
                >
                  저장
                </button>
                <button
                  className="rounded border px-2 py-1"
                  onClick={() => {
                    setConfiguredHref(href)
                    setConfiguredCountTo(countTo)
                    try {
                      window.localStorage.removeItem(CONFIG_STORAGE_KEY)
                    } catch {}
                    setIsEditing(false)
                  }}
                >
                  초기화
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
