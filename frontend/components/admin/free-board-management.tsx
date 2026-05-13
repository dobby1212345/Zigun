"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { getFreeBoardBans, getFreeBoardMessages } from "@/lib/backend-api"
import { FreeBoardBan, FreeBoardMessage } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import Link from "next/link"
import { MessageSquare, RefreshCw, ShieldAlert, Trash2 } from "lucide-react"

interface ClearResponse {
  cleared_count: number
}

export function FreeBoardManagement() {
  const [messages, setMessages] = useState<FreeBoardMessage[]>([])
  const [bans, setBans] = useState<FreeBoardBan[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")

  const summary = useMemo(() => {
    return {
      messageCount: messages.length,
      banCount: bans.length,
    }
  }, [messages.length, bans.length])

  const refresh = useCallback(async () => {
    setIsLoading(true)

    try {
      const [messageData, banData] = await Promise.all([
        getFreeBoardMessages(),
        getFreeBoardBans({ asAdmin: true }),
      ])

      setMessages(messageData)
      setBans(banData)
      setErrorMessage("")
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "게시판 정보를 가져오지 못했습니다.")
    }

    setIsLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const handleClear = async () => {
    setIsClearing(true)
    setStatusMessage("")
    setErrorMessage("")

    try {
      const response = await fetch("/api/admin/free-board/clear", {
        method: "POST",
      })

      const payload = (await response.json()) as ClearResponse | { message?: string }

      if (!response.ok) {
        throw new Error("message" in payload && payload.message ? payload.message : "채팅방 삭제에 실패했습니다.")
      }

      const clearedCount = "cleared_count" in payload ? payload.cleared_count : 0
      setMessages([])
      setStatusMessage(`채팅 내역 ${clearedCount}건을 삭제했습니다.`)
      await refresh()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "채팅방 삭제에 실패했습니다.")
    }

    setIsClearing(false)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            게시판 관리
          </CardTitle>
          <CardDescription>자유 게시판 상태 확인과 채팅방 초기화를 관리자 모드에서만 수행합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">현재 채팅 수</p>
              <p className="mt-1 text-2xl font-semibold">{summary.messageCount}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">활성 금지 수</p>
              <p className="mt-1 text-2xl font-semibold">{summary.banCount}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="destructive" onClick={() => void handleClear()} disabled={isClearing || isLoading}>
              <Trash2 className="mr-2 h-4 w-4" />
              채팅방 지우기
            </Button>
            <Button type="button" variant="outline" onClick={() => void refresh()} disabled={isLoading || isClearing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              새로고침
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/free-board">자유 게시판으로 이동</Link>
            </Button>
          </div>

          {statusMessage && <p className="text-sm text-emerald-600">{statusMessage}</p>}
          {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            최근 대화
          </CardTitle>
          <CardDescription>최근 메시지 30개를 확인할 수 있습니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[360px] rounded-md border bg-muted/20 p-4">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">현재 표시할 대화가 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {messages.slice(-30).reverse().map((message) => (
                  <div key={message.id} className="rounded-md border bg-card p-3">
                    <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className={message.is_admin ? "font-semibold text-purple-700" : "font-medium text-foreground"}>
                        {message.author_name}
                      </span>
                      <span>{new Date(message.created_at).toLocaleString("ko-KR")}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-foreground">{message.content}</p>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
