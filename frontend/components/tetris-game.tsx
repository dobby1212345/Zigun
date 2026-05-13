"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const BOARD_WIDTH = 10
const BOARD_HEIGHT = 20
const DEFAULT_LEVEL = 1
const SCORE_BY_CLEARED_LINES = [0, 100, 300, 500, 800]
const DEFAULT_PLAYER_NAME = "익명"
const MAX_PLAYER_NAME_LENGTH = 12
const LEADERBOARD_STORAGE_KEY = "secret_tetris_leaderboard_v1"
const PLAYER_NAME_STORAGE_KEY = "secret_tetris_player_name_v1"
const MAX_LEADERBOARD_ENTRIES = 10
const KEY_CONFIG_STORAGE_KEY = "secret_tetris_keyconfig_v1"

type KeyConfig = {
  left: string
  right: string
  down: string
  rotate: string
  hardDrop: string
  hold: string
}

const DEFAULT_KEY_CONFIG: KeyConfig = {
  left: "ArrowLeft",
  right: "ArrowRight",
  down: "ArrowDown",
  rotate: "ArrowUp",
  hardDrop: " ",
  hold: "z",
}

type Board = number[][]

type Piece = {
  x: number
  y: number
  shape: number[][]
  colorIndex: number
  typeIndex: number
}

type LeaderboardEntry = {
  id: string
  name: string
  score: number
  lineCount: number
  level: number
  createdAt: string
}

const TETROMINOES: Array<{ shape: number[][]; colorClass: string }> = [
  { shape: [[1, 1, 1, 1]], colorClass: "bg-cyan-400" },
  { shape: [[1, 1], [1, 1]], colorClass: "bg-yellow-400" },
  { shape: [[0, 1, 0], [1, 1, 1]], colorClass: "bg-violet-400" },
  { shape: [[0, 1, 1], [1, 1, 0]], colorClass: "bg-green-400" },
  { shape: [[1, 1, 0], [0, 1, 1]], colorClass: "bg-red-400" },
  { shape: [[1, 0, 0], [1, 1, 1]], colorClass: "bg-blue-400" },
  { shape: [[0, 0, 1], [1, 1, 1]], colorClass: "bg-orange-400" },
]

const CELL_COLOR_CLASSES = ["bg-zinc-900", ...TETROMINOES.map((tetromino) => tetromino.colorClass)]

function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(0))
}

function cloneShape(shape: number[][]): number[][] {
  return shape.map((row) => row.slice())
}

function createRandomTypeIndex() {
  return Math.floor(Math.random() * TETROMINOES.length)
}

function createPieceByType(typeIndex: number): Piece {
  const template = TETROMINOES[typeIndex]
  const shape = cloneShape(template.shape)

  return {
    x: Math.floor((BOARD_WIDTH - shape[0].length) / 2),
    y: 0,
    shape,
    colorIndex: typeIndex + 1,
    typeIndex,
  }
}

function createRandomPiece(): Piece {
  return createPieceByType(createRandomTypeIndex())
}

function rotateShapeClockwise(shape: number[][]): number[][] {
  const rowCount = shape.length
  const columnCount = shape[0].length

  return Array.from({ length: columnCount }, (_unused, y) =>
    Array.from({ length: rowCount }, (_unused2, x) => shape[rowCount - 1 - x][y] || 0),
  )
}

function hasCollision(board: Board, piece: Piece): boolean {
  for (let y = 0; y < piece.shape.length; y += 1) {
    for (let x = 0; x < piece.shape[y].length; x += 1) {
      if (!piece.shape[y][x]) {
        continue
      }

      const boardX = piece.x + x
      const boardY = piece.y + y

      if (boardX < 0 || boardX >= BOARD_WIDTH || boardY >= BOARD_HEIGHT) {
        return true
      }

      if (boardY >= 0 && board[boardY][boardX] !== 0) {
        return true
      }
    }
  }

  return false
}

function mergePieceIntoBoard(board: Board, piece: Piece): Board {
  const nextBoard = board.map((row) => row.slice())

  piece.shape.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) {
        return
      }

      const boardX = piece.x + x
      const boardY = piece.y + y

      if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
        nextBoard[boardY][boardX] = piece.colorIndex
      }
    })
  })

  return nextBoard
}

function clearFullLines(board: Board): { board: Board; clearedLineCount: number } {
  const remainingRows = board.filter((row) => row.some((cell) => cell === 0))
  const clearedLineCount = BOARD_HEIGHT - remainingRows.length

  while (remainingRows.length < BOARD_HEIGHT) {
    remainingRows.unshift(Array(BOARD_WIDTH).fill(0))
  }

  return {
    board: remainingRows,
    clearedLineCount,
  }
}

function getDropIntervalMs(level: number): number {
  return Math.max(120, 700 - (level - 1) * 50)
}

function normalizePlayerName(name: string) {
  const trimmed = name.trim().slice(0, MAX_PLAYER_NAME_LENGTH)
  return trimmed || DEFAULT_PLAYER_NAME
}

function sortLeaderboard(entries: LeaderboardEntry[]) {
  return [...entries].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score
    }

    if (b.lineCount !== a.lineCount) {
      return b.lineCount - a.lineCount
    }

    if (b.level !== a.level) {
      return b.level - a.level
    }

    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })
}

function parseLeaderboard(raw: string | null): LeaderboardEntry[] {
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw)

    if (!Array.isArray(parsed)) {
      return []
    }

    const sanitized = parsed
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null
        }

        const next = item as Partial<LeaderboardEntry>

        if (
          typeof next.score !== "number" ||
          typeof next.lineCount !== "number" ||
          typeof next.level !== "number" ||
          typeof next.createdAt !== "string"
        ) {
          return null
        }

        return {
          id: typeof next.id === "string" ? next.id : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          name: normalizePlayerName(typeof next.name === "string" ? next.name : DEFAULT_PLAYER_NAME),
          score: Math.max(0, Math.floor(next.score)),
          lineCount: Math.max(0, Math.floor(next.lineCount)),
          level: Math.max(1, Math.floor(next.level)),
          createdAt: next.createdAt,
        }
      })
      .filter((item): item is LeaderboardEntry => item !== null)

    return sortLeaderboard(sanitized).slice(0, MAX_LEADERBOARD_ENTRIES)
  } catch {
    return []
  }
}

function createPreviewMatrix(typeIndex: number | null) {
  const matrix = Array.from({ length: 4 }, () => Array(4).fill(0))

  if (typeIndex === null) {
    return matrix
  }

  const shape = TETROMINOES[typeIndex].shape
  const offsetY = Math.floor((4 - shape.length) / 2)
  const offsetX = Math.floor((4 - shape[0].length) / 2)

  shape.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) {
        return
      }

      matrix[offsetY + y][offsetX + x] = typeIndex + 1
    })
  })

  return matrix
}

export function TetrisGame() {
  const [board, setBoard] = useState<Board>(() => createEmptyBoard())
  // Use deterministic defaults for SSR hydration; initialize randomness on client mount
  const [activePiece, setActivePiece] = useState<Piece>(() => createPieceByType(0))
  const [nextTypeIndex, setNextTypeIndex] = useState<number>(() => 0)
  const [holdTypeIndex, setHoldTypeIndex] = useState<number | null>(null)
  const [hasUsedHoldInTurn, setHasUsedHoldInTurn] = useState(false)
  const [score, setScore] = useState(0)
  const [lineCount, setLineCount] = useState(0)
  const [level, setLevel] = useState(DEFAULT_LEVEL)
  const [isRunning, setIsRunning] = useState(false)
  const [isGameOver, setIsGameOver] = useState(false)
  const [playerName, setPlayerName] = useState(DEFAULT_PLAYER_NAME)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [isCurrentScoreRecorded, setIsCurrentScoreRecorded] = useState(false)
  const [popupText, setPopupText] = useState<string | null>(null)

  const [keyConfig, setKeyConfig] = useState<KeyConfig>(() => DEFAULT_KEY_CONFIG)

  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    fetch('/api/admin/status')
      .then((r) => r.json())
      .then((d) => {
        if (d && d.isAdmin) setIsAdmin(true)
      })
      .catch(() => {})
  }, [])

  const boardRef = useRef(board)
  const activePieceRef = useRef(activePiece)
  const nextTypeIndexRef = useRef(nextTypeIndex)
  const holdTypeIndexRef = useRef(holdTypeIndex)
  const hasUsedHoldInTurnRef = useRef(hasUsedHoldInTurn)
  const levelRef = useRef(level)
  const isRunningRef = useRef(isRunning)
  const isGameOverRef = useRef(isGameOver)
  const isCurrentScoreRecordedRef = useRef(isCurrentScoreRecorded)

  useEffect(() => {
    boardRef.current = board
  }, [board])

  useEffect(() => {
    activePieceRef.current = activePiece
  }, [activePiece])

  useEffect(() => {
    nextTypeIndexRef.current = nextTypeIndex
  }, [nextTypeIndex])

  useEffect(() => {
    holdTypeIndexRef.current = holdTypeIndex
  }, [holdTypeIndex])

  useEffect(() => {
    hasUsedHoldInTurnRef.current = hasUsedHoldInTurn
  }, [hasUsedHoldInTurn])

  useEffect(() => {
    levelRef.current = level
  }, [level])

  useEffect(() => {
    isRunningRef.current = isRunning
  }, [isRunning])

  useEffect(() => {
    isGameOverRef.current = isGameOver
  }, [isGameOver])

  useEffect(() => {
    isCurrentScoreRecordedRef.current = isCurrentScoreRecorded
  }, [isCurrentScoreRecorded])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const savedPlayerName = window.localStorage.getItem(PLAYER_NAME_STORAGE_KEY)

    if (savedPlayerName !== null) {
      setPlayerName(savedPlayerName.slice(0, MAX_PLAYER_NAME_LENGTH))
    }

    const savedLeaderboard = parseLeaderboard(window.localStorage.getItem(LEADERBOARD_STORAGE_KEY))
    setLeaderboard(savedLeaderboard)

    const savedKeyConfig = window.localStorage.getItem(KEY_CONFIG_STORAGE_KEY)
    if (savedKeyConfig) {
      try {
        const parsed = JSON.parse(savedKeyConfig)
        setKeyConfig({ ...DEFAULT_KEY_CONFIG, ...parsed })
      } catch {
        // ignore parse errors
      }
    }
  }, [])

  // client-only initialization moved below where setters are defined

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    window.localStorage.setItem(PLAYER_NAME_STORAGE_KEY, playerName.slice(0, MAX_PLAYER_NAME_LENGTH))
  }, [playerName])

  const saveKeyConfig = useCallback((nextConfig: KeyConfig) => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(KEY_CONFIG_STORAGE_KEY, JSON.stringify(nextConfig))
    setKeyConfig(nextConfig)
  }, [])

  const writeLeaderboardToStorage = useCallback((entries: LeaderboardEntry[]) => {
    if (typeof window === "undefined") {
      return
    }

    window.localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(entries))
  }, [])

  const setBoardState = useCallback((nextBoard: Board) => {
    boardRef.current = nextBoard
    setBoard(nextBoard)
  }, [])

  const setPieceState = useCallback((nextPiece: Piece) => {
    activePieceRef.current = nextPiece
    setActivePiece(nextPiece)
  }, [])

  const setNextTypeIndexState = useCallback((typeIndex: number) => {
    nextTypeIndexRef.current = typeIndex
    setNextTypeIndex(typeIndex)
  }, [])

  // Initialize random piece/type only on client to prevent SSR/CSR mismatch
  useEffect(() => {
    if (typeof window === "undefined") return

    const initialPiece = createRandomPiece()
    const initialNext = createRandomTypeIndex()

    setPieceState(initialPiece)
    setNextTypeIndexState(initialNext)
  }, [setPieceState, setNextTypeIndexState])

  // popup timer ref
  const popupTimerRef = useRef<number | null>(null)

  const showPopup = useCallback((text: string, ms = 800) => {
    setPopupText(text)
    if (popupTimerRef.current) {
      window.clearTimeout(popupTimerRef.current)
    }
    popupTimerRef.current = window.setTimeout(() => {
      setPopupText(null)
      popupTimerRef.current = null
    }, ms)
  }, [])

  const setHoldTypeIndexState = useCallback((typeIndex: number | null) => {
    holdTypeIndexRef.current = typeIndex
    setHoldTypeIndex(typeIndex)
  }, [])

  const setHasUsedHoldInTurnState = useCallback((nextValue: boolean) => {
    hasUsedHoldInTurnRef.current = nextValue
    setHasUsedHoldInTurn(nextValue)
  }, [])

  const setCurrentScoreRecordedState = useCallback((nextValue: boolean) => {
    isCurrentScoreRecordedRef.current = nextValue
    setIsCurrentScoreRecorded(nextValue)
  }, [])

  const promoteNextPiece = useCallback((targetBoard: Board) => {
    const nextPiece = createPieceByType(nextTypeIndexRef.current)
    const upcomingType = createRandomTypeIndex()

    setNextTypeIndexState(upcomingType)

    if (hasCollision(targetBoard, nextPiece)) {
      setIsGameOver(true)
      setIsRunning(false)
      return
    }

    setHasUsedHoldInTurnState(false)
    setPieceState(nextPiece)
  }, [setHasUsedHoldInTurnState, setNextTypeIndexState, setPieceState])

  const lockPiece = useCallback(() => {
    const mergedBoard = mergePieceIntoBoard(boardRef.current, activePieceRef.current)
    const { board: lineClearedBoard, clearedLineCount } = clearFullLines(mergedBoard)

    setBoardState(lineClearedBoard)

    if (clearedLineCount > 0) {
      const points = SCORE_BY_CLEARED_LINES[clearedLineCount] * levelRef.current
      setScore((prev) => prev + points)
      // show floating +points popup at center of board
      try {
        showPopup(`+${points}`)
      } catch {
        // no-op if showPopup is not available in this context
      }
      setLineCount((prev) => {
        const nextLineCount = prev + clearedLineCount
        const nextLevel = Math.floor(nextLineCount / 10) + 1

        setLevel(nextLevel)
        return nextLineCount
      })
    }

    promoteNextPiece(lineClearedBoard)
  }, [promoteNextPiece, setBoardState])

  const holdCurrentPiece = useCallback(() => {
    if (!isRunningRef.current || isGameOverRef.current || hasUsedHoldInTurnRef.current) {
      return
    }

    setHasUsedHoldInTurnState(true)

    const currentTypeIndex = activePieceRef.current.typeIndex

    if (holdTypeIndexRef.current === null) {
      const nextPiece = createPieceByType(nextTypeIndexRef.current)
      const upcomingType = createRandomTypeIndex()

      setHoldTypeIndexState(currentTypeIndex)
      setNextTypeIndexState(upcomingType)

      if (hasCollision(boardRef.current, nextPiece)) {
        setIsGameOver(true)
        setIsRunning(false)
        return
      }

      setPieceState(nextPiece)
      return
    }

    const swappedTypeIndex = holdTypeIndexRef.current
    const swappedPiece = createPieceByType(swappedTypeIndex)

    setHoldTypeIndexState(currentTypeIndex)

    if (hasCollision(boardRef.current, swappedPiece)) {
      setIsGameOver(true)
      setIsRunning(false)
      return
    }

    setPieceState(swappedPiece)
  }, [setHasUsedHoldInTurnState, setHoldTypeIndexState, setNextTypeIndexState, setPieceState])

  const movePiece = useCallback((deltaX: number) => {
    if (!isRunningRef.current || isGameOverRef.current) {
      return
    }

    const nextPiece = {
      ...activePieceRef.current,
      x: activePieceRef.current.x + deltaX,
    }

    if (!hasCollision(boardRef.current, nextPiece)) {
      setPieceState(nextPiece)
    }
  }, [setPieceState])

  const rotatePiece = useCallback(() => {
    if (!isRunningRef.current || isGameOverRef.current) {
      return
    }

    const rotatedShape = rotateShapeClockwise(activePieceRef.current.shape)
    const basePiece = {
      ...activePieceRef.current,
      shape: rotatedShape,
    }

    const kickOffsets = [0, -1, 1, -2, 2]

    for (const offset of kickOffsets) {
      const kickedPiece = {
        ...basePiece,
        x: basePiece.x + offset,
      }

      if (!hasCollision(boardRef.current, kickedPiece)) {
        setPieceState(kickedPiece)
        return
      }
    }
  }, [setPieceState])

  const dropPieceByOneRow = useCallback(() => {
    if (!isRunningRef.current || isGameOverRef.current) {
      return
    }

    const nextPiece = {
      ...activePieceRef.current,
      y: activePieceRef.current.y + 1,
    }

    if (hasCollision(boardRef.current, nextPiece)) {
      lockPiece()
      return
    }

    setPieceState(nextPiece)
  }, [lockPiece, setPieceState])

  const hardDropPiece = useCallback(() => {
    if (!isRunningRef.current || isGameOverRef.current) {
      return
    }

    let candidatePiece = { ...activePieceRef.current }

    while (true) {
      const nextCandidate = {
        ...candidatePiece,
        y: candidatePiece.y + 1,
      }

      if (hasCollision(boardRef.current, nextCandidate)) {
        break
      }

      candidatePiece = nextCandidate
    }

    setPieceState(candidatePiece)
    lockPiece()
  }, [lockPiece, setPieceState])

  const startNewGame = useCallback(() => {
    const initialBoard = createEmptyBoard()
    const initialPiece = createRandomPiece()
    const initialNextType = createRandomTypeIndex()

    setBoardState(initialBoard)
    setPieceState(initialPiece)
    setNextTypeIndexState(initialNextType)
    setHoldTypeIndexState(null)
    setHasUsedHoldInTurnState(false)
    setScore(0)
    setLineCount(0)
    setLevel(DEFAULT_LEVEL)
    levelRef.current = DEFAULT_LEVEL
    setIsGameOver(false)
    setIsRunning(true)
    setCurrentScoreRecordedState(false)
  }, [setBoardState, setCurrentScoreRecordedState, setHasUsedHoldInTurnState, setHoldTypeIndexState, setNextTypeIndexState, setPieceState])

  const recordCurrentScoreToLeaderboard = useCallback(() => {
    if (score <= 0 || isCurrentScoreRecordedRef.current) {
      return
    }

    const nextEntry: LeaderboardEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      name: normalizePlayerName(playerName),
      score,
      lineCount,
      level,
      createdAt: new Date().toISOString(),
    }

    const nextLeaderboard = sortLeaderboard([...leaderboard, nextEntry]).slice(0, MAX_LEADERBOARD_ENTRIES)

    setLeaderboard(nextLeaderboard)
    writeLeaderboardToStorage(nextLeaderboard)
    setCurrentScoreRecordedState(true)
  }, [leaderboard, level, lineCount, playerName, score, setCurrentScoreRecordedState, writeLeaderboardToStorage])

  const toggleRunState = useCallback(() => {
    if (isGameOverRef.current) {
      startNewGame()
      return
    }

    setIsRunning((prev) => !prev)
  }, [startNewGame])

  useEffect(() => {
    if (!isRunning || isGameOver) {
      return
    }

    const timer = window.setInterval(() => {
      dropPieceByOneRow()
    }, getDropIntervalMs(level))

    return () => {
      window.clearInterval(timer)
    }
  }, [dropPieceByOneRow, isGameOver, isRunning, level])

  useEffect(() => {
    if (!isGameOver) {
      return
    }

    recordCurrentScoreToLeaderboard()
  }, [isGameOver, recordCurrentScoreToLeaderboard])

  useEffect(() => {
    const normalize = (k: string) => {
      if (!k) return k
      if (k.toLowerCase() === "space") return " "
      return k
    }

    const matches = (eventKey: string, configured: string) => {
      if (!configured) return false
      try {
        return eventKey.toLowerCase() === normalize(configured).toLowerCase()
      } catch {
        return eventKey === configured
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null

      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return
      }

      if (!isRunningRef.current || isGameOverRef.current) {
        return
      }

      if (
        matches(event.key, keyConfig.left) ||
        matches(event.key, keyConfig.right) ||
        matches(event.key, keyConfig.down) ||
        matches(event.key, keyConfig.rotate) ||
        matches(event.key, keyConfig.hardDrop) ||
        matches(event.key, keyConfig.hold)
      ) {
        event.preventDefault()
      }

      if (matches(event.key, keyConfig.left)) {
        movePiece(-1)
        return
      }

      if (matches(event.key, keyConfig.right)) {
        movePiece(1)
        return
      }

      if (matches(event.key, keyConfig.down)) {
        dropPieceByOneRow()
        return
      }

      if (matches(event.key, keyConfig.rotate)) {
        rotatePiece()
        return
      }

      if (matches(event.key, keyConfig.hardDrop)) {
        hardDropPiece()
        return
      }

      if (matches(event.key, keyConfig.hold)) {
        holdCurrentPiece()
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [dropPieceByOneRow, hardDropPiece, holdCurrentPiece, movePiece, rotatePiece])

  const renderedBoard = useMemo(() => {
    const nextBoard = board.map((row) => row.slice())

    activePiece.shape.forEach((row, y) => {
      row.forEach((value, x) => {
        if (!value) {
          return
        }

        const boardX = activePiece.x + x
        const boardY = activePiece.y + y

        if (boardX >= 0 && boardX < BOARD_WIDTH && boardY >= 0 && boardY < BOARD_HEIGHT) {
          nextBoard[boardY][boardX] = activePiece.colorIndex
        }
      })
    })

    return nextBoard
  }, [activePiece, board])

  const holdPreviewMatrix = useMemo(() => createPreviewMatrix(holdTypeIndex), [holdTypeIndex])
  const nextPreviewMatrix = useMemo(() => createPreviewMatrix(nextTypeIndex), [nextTypeIndex])

  return (
    <div className="flex gap-8 items-start justify-center w-full">
      <div
        className="grid gap-0 rounded-lg border border-border bg-zinc-950 p-2 shadow-inner"
        style={{
          // use CSS variable so cells have fixed square dimensions
          // adjust `--cell-size` if you want larger/smaller cells
          // board width will be BOARD_WIDTH * --cell-size
          ["--cell-size" as any]: "1.5rem",
          gridTemplateColumns: `repeat(${BOARD_WIDTH}, var(--cell-size))`,
          gridAutoRows: "var(--cell-size)",
          // visually add 2 extra rows of space so blocks don't get clipped by rounding/padding
          height: `calc(var(--cell-size) * ${BOARD_HEIGHT + 2})`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {popupText && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-white/90 text-black font-bold px-3 py-1 rounded-md text-2xl drop-shadow">{popupText}</div>
          </div>
        )}
        {renderedBoard.flatMap((row, y) =>
          row.map((cellColor, x) => (
            <div
              key={`${y}-${x}`}
              className={cn("w-full h-full", CELL_COLOR_CLASSES[cellColor] || CELL_COLOR_CLASSES[0])}
            />
          )),
        )}
      </div>

      <div className="space-y-5">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">테트리스</h2>
          <p className="mt-1 text-sm text-muted-foreground">방향키로 조작하세요. Z는 홀드, 스페이스바는 즉시 낙하입니다.</p>
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-muted-foreground">점수</p>
              <p className="mt-1 text-xl font-semibold">{score}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-muted-foreground">라인</p>
              <p className="mt-1 text-xl font-semibold">{lineCount}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-muted-foreground">레벨</p>
              <p className="mt-1 text-xl font-semibold">{level}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="mb-2 text-sm text-muted-foreground">홀드 (Z)</p>
              <div
                className="grid w-fit grid-cols-4 gap-0 rounded-md border border-border bg-zinc-950 p-1"
                style={{ ["--preview-cell-size" as any]: "0.9rem", gridAutoRows: "var(--preview-cell-size)", gridTemplateColumns: `repeat(4, var(--preview-cell-size))` }}
              >
                {holdPreviewMatrix.flatMap((row, y) =>
                  row.map((cellColor, x) => (
                    <div
                      key={`hold-${y}-${x}`}
                      className={cn("w-full h-full", CELL_COLOR_CLASSES[cellColor] || CELL_COLOR_CLASSES[0])}
                    />
                  )),
                )}
              </div>
              {hasUsedHoldInTurn && <p className="mt-2 text-xs text-muted-foreground">이번 턴에서 홀드를 이미 사용했습니다.</p>}
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="mb-2 text-sm text-muted-foreground">다음 블록</p>
              <div
                className="grid w-fit grid-cols-4 gap-0 rounded-md border border-border bg-zinc-950 p-1"
                style={{ ["--preview-cell-size" as any]: "0.9rem", gridAutoRows: "var(--preview-cell-size)", gridTemplateColumns: `repeat(4, var(--preview-cell-size))` }}
              >
                {nextPreviewMatrix.flatMap((row, y) =>
                  row.map((cellColor, x) => (
                    <div
                      key={`next-${y}-${x}`}
                      className={cn("w-full h-full", CELL_COLOR_CLASSES[cellColor] || CELL_COLOR_CLASSES[0])}
                    />
                  )),
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={toggleRunState}>
              {isGameOver ? "다시 시작" : isRunning ? "일시정지" : "시작"}
            </Button>
            <Button type="button" variant="outline" onClick={startNewGame}>
              리셋
            </Button>
          </div>

          {isGameOver && (
            <p className="mt-3 text-sm font-medium text-destructive">게임 오버. 점수가 순위표에 자동으로 저장되었습니다.</p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold">순위표</h3>
            <span className="text-xs text-muted-foreground">Top {MAX_LEADERBOARD_ENTRIES}</span>
          </div>

          <div className="mt-3 space-y-2">
            <label htmlFor="tetrisPlayerName" className="text-xs text-muted-foreground">
              닉네임
            </label>
            <Input
              id="tetrisPlayerName"
              value={playerName}
              maxLength={MAX_PLAYER_NAME_LENGTH}
              onChange={(event) => setPlayerName(event.target.value.slice(0, MAX_PLAYER_NAME_LENGTH))}
              placeholder="닉네임"
            />
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border border-border">
            <div className="grid grid-cols-[40px_1fr_90px_70px] bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
              <span>순위</span>
              <span>이름</span>
              <span className="text-right">점수</span>
              <span className="text-right">라인</span>
            </div>

            {leaderboard.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">아직 기록이 없습니다. 첫 점수를 등록해 보세요.</p>
            ) : (
              <div className="divide-y divide-border">
                {leaderboard.map((entry, index) => (
                  <div
                    key={entry.id}
                    className="grid grid-cols-[40px_1fr_90px_70px] items-center px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{index + 1}</span>
                    <span className="truncate">{entry.name}</span>
                    <span className="text-right font-semibold">{entry.score}</span>
                    <span className="text-right text-muted-foreground">{entry.lineCount}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-lg font-semibold">관리자: 키 설정</h3>
            <p className="mt-1 text-sm text-muted-foreground">테트리스 조작키를 변경합니다. 예: ArrowLeft, a, Space</p>

            <div className="mt-3 grid gap-2 text-sm">
              <label className="text-xs text-muted-foreground">왼쪽 이동</label>
              <Input value={keyConfig.left} onChange={(e) => setKeyConfig((s) => ({ ...s, left: e.target.value }))} />

              <label className="text-xs text-muted-foreground">오른쪽 이동</label>
              <Input value={keyConfig.right} onChange={(e) => setKeyConfig((s) => ({ ...s, right: e.target.value }))} />

              <label className="text-xs text-muted-foreground">아래(빠른 낙하)</label>
              <Input value={keyConfig.down} onChange={(e) => setKeyConfig((s) => ({ ...s, down: e.target.value }))} />

              <label className="text-xs text-muted-foreground">회전</label>
              <Input value={keyConfig.rotate} onChange={(e) => setKeyConfig((s) => ({ ...s, rotate: e.target.value }))} />

              <label className="text-xs text-muted-foreground">즉시 낙하</label>
              <Input value={keyConfig.hardDrop} onChange={(e) => setKeyConfig((s) => ({ ...s, hardDrop: e.target.value }))} />

              <label className="text-xs text-muted-foreground">홀드</label>
              <Input value={keyConfig.hold} onChange={(e) => setKeyConfig((s) => ({ ...s, hold: e.target.value }))} />
            </div>

            <div className="mt-3 flex gap-2">
              <Button type="button" onClick={() => saveKeyConfig(keyConfig)}>저장</Button>
              <Button type="button" variant="outline" onClick={() => { saveKeyConfig(DEFAULT_KEY_CONFIG) }}>기본값</Button>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          <p>조작법</p>
          <p className="mt-2">좌/우 화살표: 이동</p>
          <p>위 화살표: 회전</p>
          <p>아래 화살표: 한 칸 빠르게 낙하</p>
          <p>스페이스바: 즉시 낙하</p>
          <p>Z: 홀드 (턴당 1회)</p>
        </div>
      </div>
    </div>
  )
}
