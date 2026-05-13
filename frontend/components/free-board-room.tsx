"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  createFreeBoardBan,
  createFreeBoardMessage,
  deleteFreeBoardBan,
  getFreeBoardBans,
  getFreeBoardMessages,
} from "@/lib/backend-api"
import { FreeBoardBan, FreeBoardMessage } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageSquare, RefreshCw, Send, UserCircle2 } from "lucide-react"

interface FreeBoardRoomProps {
  initialMessages: FreeBoardMessage[]
  isAdmin: boolean
}

const CLIENT_ID_STORAGE_KEY = "free_board_client_id"
const NICKNAME_STORAGE_KEY = "free_board_nickname"

function createClientId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `guest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function getOrCreateClientId() {
  if (typeof window === "undefined") {
    return ""
  }

  const existing = window.localStorage.getItem(CLIENT_ID_STORAGE_KEY)

  if (existing) {
    return existing
  }

  const nextId = createClientId()
  window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, nextId)
  return nextId
}

function getSavedNickname() {
  if (typeof window === "undefined") {
    return ""
  }

  return (window.localStorage.getItem(NICKNAME_STORAGE_KEY) || "").slice(0, 20)
}

export function FreeBoardRoom({ initialMessages, isAdmin }: FreeBoardRoomProps) {
  const [messages, setMessages] = useState<FreeBoardMessage[]>(initialMessages)
  const [activeBans, setActiveBans] = useState<FreeBoardBan[]>([])
  const [nickname, setNickname] = useState("")
  const [nicknameInput, setNicknameInput] = useState("")
  const [hasEntered, setHasEntered] = useState(isAdmin)
  const [isAnonymous, setIsAnonymous] = useState(true)
  const [content, setContent] = useState("")
  const [clientId, setClientId] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isApplyingBan, setIsApplyingBan] = useState(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const messageCountText = useMemo(() => {
    return `${messages.length}개의 대화`
  }, [messages.length])

  const activeBanMap = useMemo(() => {
    return new Map(activeBans.map((ban) => [ban.client_id, ban]))
  }, [activeBans])

  const appendMessage = useCallback((incoming: FreeBoardMessage) => {
    setMessages((prev) => {
      if (prev.some((message) => message.id === incoming.id)) {
        return prev
      }

      return [...prev, incoming]
    })
  }, [])

  const refreshMessages = useCallback(async () => {
    if (!isAdmin && !hasEntered) {
      return
    }

    setIsRefreshing(true)

    try {
      const [messageData, banData] = await Promise.all([
        getFreeBoardMessages(),
        isAdmin ? getFreeBoardBans({ asAdmin: true }) : Promise.resolve([] as FreeBoardBan[]),
      ])

      setMessages(messageData)
      setActiveBans(banData)
    } catch {
      // 새로고침 실패 시 기존 목록을 유지합니다.
    }

    setIsRefreshing(false)
  }, [isAdmin, hasEntered])

  useEffect(() => {
    setClientId(getOrCreateClientId())

    if (!isAdmin) {
      setNicknameInput(getSavedNickname())
    }
  }, [isAdmin])

  useEffect(() => {
    if (!isAdmin && !hasEntered) {
      return
    }

    void refreshMessages()
  }, [refreshMessages, isAdmin, hasEntered])

  useEffect(() => {
    if (!isAdmin && !hasEntered) {
      return
    }

    let source: EventSource | null = null
    let fallbackInterval: ReturnType<typeof setInterval> | null = null
    let isActive = true

    const startFallbackPolling = () => {
      if (fallbackInterval) {
        return
      }

      fallbackInterval = setInterval(() => {
        void refreshMessages()
      }, 5000)
    }

    try {
      source = new EventSource("/api/free-board/stream")

      source.addEventListener("message", (event) => {
        if (!isActive) {
          return
        }

        try {
          const parsed = JSON.parse(event.data) as FreeBoardMessage
          appendMessage(parsed)
        } catch {
          // Ignore malformed stream data.
        }
      })

      source.onerror = () => {
        if (!isActive) {
          return
        }

        source?.close()
        source = null
        startFallbackPolling()
      }
    } catch {
      startFallbackPolling()
    }

    return () => {
      isActive = false

      if (source) {
        source.close()
      }

      if (fallbackInterval) {
        clearInterval(fallbackInterval)
      }
    }
  }, [appendMessage, refreshMessages, isAdmin, hasEntered])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleEnterRoom = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmed = nicknameInput.trim()

    if (!trimmed) {
      setErrorMessage("닉네임을 입력해야 게시판에 들어갈 수 있습니다.")
      return
    }

    const safeNickname = trimmed.slice(0, 20)
    setNickname(safeNickname)
    setHasEntered(true)
    setErrorMessage("")

    if (typeof window !== "undefined") {
      window.localStorage.setItem(NICKNAME_STORAGE_KEY, safeNickname)
    }
  }

  const handleChangeNickname = () => {
    setHasEntered(false)
    setErrorMessage("")
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!content.trim() || isSubmitting || !clientId || (!isAdmin && !hasEntered)) {
      return
    }

    if (!isAdmin && !isAnonymous && !nickname.trim()) {
      setErrorMessage("닉네임을 먼저 입력해주세요.")
      return
    }

    setErrorMessage("")
    setIsSubmitting(true)

    try {
      const created = await createFreeBoardMessage({
        client_id: clientId,
        author_name: isAdmin ? "관리자" : isAnonymous ? undefined : nickname,
        content,
      }, {
        asAdmin: isAdmin,
      })

      appendMessage(created)
      setContent("")
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "메시지 등록에 실패했습니다.")
    }

    setIsSubmitting(false)
  }

  if (!isAdmin && !hasEntered) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <MessageSquare className="h-6 w-6 text-primary" />
            자유 게시판 입장
          </CardTitle>
          <CardDescription>
            먼저 사용할 닉네임을 입력해주세요. 메시지 전송 시 익명 체크로 익명 전송도 가능합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEnterRoom} className="space-y-3">
            <Input
              value={nicknameInput}
              onChange={(event) => setNicknameInput(event.target.value)}
              maxLength={20}
              placeholder="닉네임을 입력하세요"
            />
            {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
            <Button type="submit" className="w-full">
              게시판 입장
            </Button>
          </form>
        </CardContent>
      </Card>
    )
  }

  const handleApplyBan = async (
    targetMessage: FreeBoardMessage,
    banType: "temporary" | "permanent",
  ) => {
    if (!isAdmin || !targetMessage.client_id || targetMessage.is_admin) {
      return
    }

    setErrorMessage("")
    setIsApplyingBan(true)

    try {
      const createdBan = await createFreeBoardBan(
        {
          client_id: targetMessage.client_id,
          author_name: targetMessage.author_name,
          ban_type: banType,
          duration_minutes: banType === "temporary" ? 30 : undefined,
        },
        { asAdmin: true },
      )

      setActiveBans((prev) => [createdBan, ...prev.filter((item) => item.client_id !== createdBan.client_id)])
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "채팅 금지 적용에 실패했습니다.")
    }

    setIsApplyingBan(false)
  }

  const handleUnban = async (targetClientId: string) => {
    if (!isAdmin || !targetClientId) {
      return
    }

    setErrorMessage("")
    setIsApplyingBan(true)

    try {
      await deleteFreeBoardBan(targetClientId, { asAdmin: true })
      setActiveBans((prev) => prev.filter((ban) => ban.client_id !== targetClientId))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "채팅 금지 해제에 실패했습니다.")
    }

    setIsApplyingBan(false)
  }

  return (
    <Card className="min-h-[70vh]">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <MessageSquare className="h-6 w-6 text-primary" />
              자유 게시판
            </CardTitle>
            <CardDescription className="mt-2">
              접속한 사람들이 자유롭게 이야기하는 하나의 채팅방입니다. {messageCountText}
            </CardDescription>
            {isAdmin && (
              <p className="mt-2 text-sm font-medium text-purple-700">
                관리자 모드 활성화: 관리자 닉네임은 보라색으로 표시됩니다.
              </p>
            )}
            {!isAdmin && (
              <p className="mt-2 text-sm text-muted-foreground">
                닉네임: <span className="font-medium text-foreground">{nickname}</span>
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void refreshMessages()
            }}
            disabled={isRefreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            새로고침
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex h-full flex-col gap-4 pt-6">
        <ScrollArea className="h-[420px] rounded-md border bg-muted/20 p-4">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              아직 대화가 없습니다. 첫 메시지를 남겨보세요.
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message) => (
                <div key={message.id} className="rounded-lg border bg-card p-3">
                  <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <UserCircle2 className="h-4 w-4" />
                    <span className={message.is_admin ? "font-semibold text-purple-700" : "font-medium text-foreground"}>
                      {message.author_name || "익명"}
                    </span>
                    {message.is_admin && (
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700">
                        관리자
                      </span>
                    )}
                    {!message.is_admin && message.client_id && activeBanMap.has(message.client_id) && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                        채팅 금지
                      </span>
                    )}
                    <span>{new Date(message.created_at).toLocaleString("ko-KR")}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {message.content}
                  </p>

                  {isAdmin && !message.is_admin && message.client_id && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {activeBanMap.has(message.client_id) ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isApplyingBan}
                          onClick={() => {
                            void handleUnban(message.client_id as string)
                          }}
                        >
                          채팅 금지 해제
                        </Button>
                      ) : (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isApplyingBan}
                            onClick={() => {
                              void handleApplyBan(message, "temporary")
                            }}
                          >
                            30분 금지
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={isApplyingBan}
                            onClick={() => {
                              void handleApplyBan(message, "permanent")
                            }}
                          >
                            완전 금지
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </ScrollArea>

        <form onSubmit={handleSubmit} className="space-y-3">
          {isAdmin ? (
            <Input value="관리자" readOnly className="border-purple-300 bg-purple-50 text-purple-700" />
          ) : (
            <div className="rounded-md border bg-muted/20 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  현재 닉네임: <span className="font-medium text-foreground">{nickname}</span>
                </p>
                <Button type="button" variant="outline" size="sm" onClick={handleChangeNickname}>
                  닉네임 변경
                </Button>
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(event) => setIsAnonymous(event.target.checked)}
                  className="h-4 w-4"
                />
                익명으로 보내기
              </label>
            </div>
          )}
          <div className="flex gap-2">
            <Textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={500}
              rows={3}
              placeholder="메시지를 입력하세요"
              className="resize-none"
            />
            <Button type="submit" disabled={isSubmitting || !content.trim()} className="h-auto px-4">
              <Send className="h-4 w-4" />
            </Button>
          </div>
          {errorMessage && (
            <p className="text-sm text-destructive">{errorMessage}</p>
          )}
          <p className="text-xs text-muted-foreground">
            새 메시지는 실시간으로 표시되며, 연결이 끊기면 5초마다 다시 확인합니다.
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
