"use client"

import { ChangeEvent, useEffect, useState } from "react"
import { Profile } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { resolveBackendAssetUrl, saveProfile, uploadProfileImage } from "@/lib/backend-api"
import { Save, Loader2 } from "lucide-react"

const MAX_PROFILE_IMAGE_SIZE_BYTES = 2 * 1024 * 1024

interface ProfileEditorProps {
  profile: Profile | null
  onUpdate: (profile: Profile) => void
}

export function ProfileEditor({ profile, onUpdate }: ProfileEditorProps) {
  const [writerName, setWriterName] = useState(profile?.writer_name || "")
  const [profileText, setProfileText] = useState(profile?.profile_text || "")
  const [profileImageUrl, setProfileImageUrl] = useState(profile?.profile_image_url || "")
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const previewImageUrl = profileImageUrl ? resolveBackendAssetUrl(profileImageUrl) : ""

  useEffect(() => {
    setWriterName(profile?.writer_name || "")
    setProfileText(profile?.profile_text || "")
    setProfileImageUrl(profile?.profile_image_url || "")
  }, [profile])

  const handleImageFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.currentTarget.value = ""

    if (!file) {
      return
    }

    setSaveError(null)
    setSaveSuccess(null)

    if (!file.type.startsWith("image/")) {
      setSaveError("이미지 파일만 업로드할 수 있습니다.")
      return
    }

    if (file.size > MAX_PROFILE_IMAGE_SIZE_BYTES) {
      setSaveError("이미지 크기는 2MB 이하만 가능합니다.")
      return
    }

    setIsUploadingImage(true)

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()

        reader.onload = () => {
          if (typeof reader.result !== "string") {
            reject(new Error("이미지 데이터를 처리하지 못했습니다."))
            return
          }

          resolve(reader.result)
        }

        reader.onerror = () => {
          reject(new Error("이미지를 읽는 중 오류가 발생했습니다."))
        }

        reader.readAsDataURL(file)
      })

      const uploadedImageUrl = await uploadProfileImage(dataUrl)
      setProfileImageUrl(uploadedImageUrl)
      setSaveSuccess("프로필 사진이 업로드되었습니다. 저장 버튼을 눌러 반영하세요.")
    } catch (error: any) {
      setSaveError(error?.message || "이미지 업로드 중 오류가 발생했습니다.")
      setSaveSuccess(null)
    } finally {
      setIsUploadingImage(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveError(null)
    setSaveSuccess(null)

    try {
      const updatedProfile = await saveProfile({
        writer_name: writerName,
        profile_text: profileText,
        profile_image_url: profileImageUrl || null,
      })

      onUpdate(updatedProfile)
      setSaveSuccess("프로필이 저장되었습니다.")
    } catch (error: any) {
      setSaveError(error?.message || "프로필 저장 중 오류가 발생했습니다.")
      setSaveSuccess(null)
    }

    setIsSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="writerName">작가 이름</Label>
        <Input
          id="writerName"
          value={writerName}
          onChange={(e) => setWriterName(e.target.value)}
          placeholder="작가 이름을 입력하세요"
          className="max-w-md"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="profileText">소개</Label>
        <Textarea
          id="profileText"
          value={profileText}
          onChange={(e) => setProfileText(e.target.value)}
          placeholder="작가 소개를 입력하세요"
          rows={6}
          className="resize-none"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="profileImage">프로필 이미지 URL</Label>
        <Input
          id="profileImage"
          value={profileImageUrl}
          onChange={(e) => setProfileImageUrl(e.target.value)}
          placeholder="https://example.com/image.jpg"
          className="max-w-md"
        />
        <p className="text-xs text-muted-foreground">
          이미지 URL을 직접 입력하거나 아래에서 파일을 선택해 주세요.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="profileImageFile">프로필 사진 업로드</Label>
        <Input
          id="profileImageFile"
          type="file"
          accept="image/*"
          onChange={handleImageFileChange}
          className="max-w-md cursor-pointer"
        />
        <p className="text-xs text-muted-foreground">2MB 이하 이미지 파일을 업로드할 수 있습니다.</p>
      </div>

      {profileImageUrl && (
        <div className="space-y-3">
          <Label>프로필 사진 미리보기</Label>
          <div className="w-28 h-28 rounded-full overflow-hidden border border-border bg-muted">
            <img
              src={previewImageUrl}
              alt={writerName ? `${writerName} 프로필 사진` : "프로필 사진"}
              className="w-full h-full object-cover"
            />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setProfileImageUrl("")}>
            사진 제거
          </Button>
        </div>
      )}

      <div className="space-y-1">
        {saveError && <p className="text-sm text-destructive">{saveError}</p>}
        {saveSuccess && <p className="text-sm text-emerald-600">{saveSuccess}</p>}
      </div>

      <Button onClick={handleSave} disabled={isSaving || isUploadingImage}>
        {isSaving ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            저장 중...
          </>
        ) : isUploadingImage ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            이미지 업로드 중...
          </>
        ) : (
          <>
            <Save className="w-4 h-4 mr-2" />
            저장
          </>
        )}
      </Button>
    </div>
  )
}
