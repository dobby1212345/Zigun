import { MainLayout } from "@/components/main-layout"
import { TetrisGame } from "@/components/tetris-game"

export default function SecretArcadePage() {
  return (
    <MainLayout>
      <div className="p-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <div>
            <p className="text-sm text-muted-foreground">숨겨진 페이지</p>
            <h1 className="mt-1 text-3xl font-bold text-foreground">비밀 아케이드</h1>
            <p className="mt-2 text-muted-foreground">찾아낸 사람만 플레이할 수 있는 테트리스 공간입니다.</p>
          </div>

          <TetrisGame />
        </div>
      </div>
    </MainLayout>
  )
}
