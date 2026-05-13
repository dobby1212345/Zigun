"use client"

import { resolveBackendAssetUrl } from "@/lib/backend-api"
import { Profile } from "@/lib/types"
import { User, Feather } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

interface ProfileContentProps {
  profile: Profile | null
}

export function ProfileContent({ profile }: ProfileContentProps) {
  const writerName = profile?.writer_name || "이름 없는 작가"
  const profileImageSrc = profile?.profile_image_url
    ? resolveBackendAssetUrl(profile.profile_image_url)
    : ""

  const CONFIG_STORAGE_KEY = "profile_easter_config_v1"
  const [clickCount, setClickCount] = useState(0)
  const timerRef = useRef<number | null>(null)

  const [configuredHref, setConfiguredHref] = useState("/secret-arcade-8")
  const [configuredCountTo, setConfiguredCountTo] = useState(20)
  const [isEditing, setIsEditing] = useState(false)

  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.href) setConfiguredHref(parsed.href)
        if (typeof parsed.countTo === "number") setConfiguredCountTo(parsed.countTo)
      }
    } catch {}

    // check admin status from server via cookie
    fetch('/api/admin/status')
      .then((r) => r.json())
      .then((d) => {
        if (d && d.isAdmin) setIsAdmin(true)
      })
      .catch(() => {})
  }, [])

  const handleProfileClick = useCallback(() => {
    const next = clickCount + 1
    setClickCount(next)

    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
    }
    timerRef.current = window.setTimeout(() => setClickCount(0), 2000)

    if (next >= configuredCountTo) {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
      window.location.href = configuredHref
    }
  }, [clickCount, configuredCountTo, configuredHref])

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-secondary to-muted" />
        
        <div className="px-8 pb-8">
          <div className="relative -mt-16 mb-6">
            <div
              className="w-32 h-32 rounded-full border-4 border-card bg-muted flex items-center justify-center overflow-hidden shadow-lg cursor-pointer"
              onClick={handleProfileClick}
              title="프로필을 연속 클릭해 보세요"
            >
              {profileImageSrc ? (
                <img
                  src={profileImageSrc}
                  alt={`${writerName} 프로필 사진`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-16 h-16 text-muted-foreground" />
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold text-foreground cursor-pointer" onClick={handleProfileClick}>
                {writerName}
              </h1>

              {isAdmin && (
                <div className="mt-2 flex flex-col gap-2 text-sm">
                  {!isEditing ? (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">프로필 이스터에그 링크:</span>
                      <span className="font-mono truncate">{configuredHref}</span>
                      <button
                        className="ml-2 rounded bg-primary px-2 py-1 text-white"
                        onClick={() => setIsEditing(true)}
                      >
                        수정
                      </button>
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
                            setConfiguredHref("/secret-arcade-8")
                            setConfiguredCountTo(20)
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

            <div className="flex items-center gap-3">
              <Feather className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-bold text-foreground">작가 소개</h2>
            </div>

            <div className="prose prose-sm max-w-none">
              <p className="text-muted-foreground leading-relaxed text-lg whitespace-pre-wrap">
                {profile?.profile_text || "아직 소개가 작성되지 않았습니다. 관리자 페이지에서 프로필을 수정해주세요."}
              </p>
            </div>
          </div>

          {!profile && (
            <div className="mt-8 p-6 bg-muted/50 rounded-xl border border-border">
              <p className="text-center text-muted-foreground">
                프로필 정보가 없습니다. 관리자 페이지에서 프로필을 생성해주세요.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
