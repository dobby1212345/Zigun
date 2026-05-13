import { Comment, FreeBoardBan, FreeBoardMessage, Profile, Story, Subcategory } from "@/lib/types"

import { getBackendBaseUrl, resolveBackendAssetUrl } from "@/lib/backend-url"

const BACKEND_BASE_URL = getBackendBaseUrl()

export { resolveBackendAssetUrl }

export type StorySortOrder = "newest" | "oldest"

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE"
  body?: unknown
  headers?: Record<string, string>
}

async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, headers } = options
  const hasBody = body !== undefined
  const requestHeaders = { ...(headers || {}) }

  if (hasBody) {
    requestHeaders["Content-Type"] = "application/json"
  }

  const response = await fetch(`${BACKEND_BASE_URL}${path}`, {
    method,
    cache: "no-store",
    headers: Object.keys(requestHeaders).length > 0 ? requestHeaders : undefined,
    body: hasBody ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const raw = await response.text()

    if (!raw) {
      throw new Error(`요청에 실패했습니다. (${response.status})`)
    }

    try {
      const parsed = JSON.parse(raw)
      throw new Error(parsed.message || parsed.error || `요청에 실패했습니다. (${response.status})`)
    } catch {
      throw new Error(raw)
    }
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

async function requestJsonOrFallback<T>(path: string, fallback: T): Promise<T> {
  try {
    return await requestJson<T>(path)
  } catch {
    return fallback
  }
}

export async function getProfile(): Promise<Profile | null> {
  return requestJsonOrFallback<Profile | null>("/api/profile", null)
}

export async function saveProfile(input: {
  writer_name: string
  profile_text: string
  profile_image_url: string | null
}): Promise<Profile> {
  return requestJson<Profile>("/api/profile", {
    method: "PUT",
    body: input,
  })
}

export async function uploadProfileImage(dataUrl: string): Promise<string> {
  const response = await requestJson<{ url: string }>("/api/profile/image", {
    method: "POST",
    body: {
      data_url: dataUrl,
    },
  })

  return response.url
}

export async function getSubcategories(parentCategory?: "short" | "long"): Promise<Subcategory[]> {
  const params = new URLSearchParams()

  if (parentCategory) {
    params.set("parent_category", parentCategory)
  }

  const query = params.toString()
  const path = query ? `/api/subcategories?${query}` : "/api/subcategories"

  return requestJsonOrFallback<Subcategory[]>(path, [])
}

export async function getSubcategory(id: string): Promise<Subcategory | null> {
  return requestJsonOrFallback<Subcategory | null>(`/api/subcategories/${id}`, null)
}

export async function createSubcategory(input: {
  name: string
  parent_category: "short" | "long"
  sort_order?: number
}): Promise<Subcategory> {
  return requestJson<Subcategory>("/api/subcategories", {
    method: "POST",
    body: input,
  })
}

export async function updateSubcategory(
  id: string,
  input: Partial<Pick<Subcategory, "name" | "parent_category" | "sort_order">>,
): Promise<Subcategory> {
  return requestJson<Subcategory>(`/api/subcategories/${id}`, {
    method: "PUT",
    body: input,
  })
}

export async function deleteSubcategory(id: string): Promise<void> {
  await requestJson<void>(`/api/subcategories/${id}`, {
    method: "DELETE",
  })
}

export async function getStories(filters?: {
  categories?: Story["category"][]
  subcategoryId?: string
  sort?: StorySortOrder
}): Promise<Story[]> {
  const params = new URLSearchParams()

  if (filters?.categories && filters.categories.length > 0) {
    filters.categories.forEach((category) => {
      params.append("category", category)
    })
  }

  if (filters?.subcategoryId) {
    params.set("subcategory_id", filters.subcategoryId)
  }

  if (filters?.sort) {
    params.set("sort", filters.sort)
  }

  const query = params.toString()
  const path = query ? `/api/stories?${query}` : "/api/stories"

  return requestJsonOrFallback<Story[]>(path, [])
}

export async function createStory(
  input: Pick<Story, "title" | "content" | "category"> &
    Partial<Pick<Story, "subcategory_id" | "thumbnail_url" | "images">> & {
      is_published?: boolean
      cover_image_url?: string | null
    },
): Promise<Story> {
  return requestJson<Story>("/api/stories", {
    method: "POST",
    body: input,
  })
}

export async function updateStory(
  id: string,
  input: Partial<
    Pick<Story, "title" | "content" | "category" | "subcategory_id" | "thumbnail_url" | "images"> & {
      is_published?: boolean
      cover_image_url?: string | null
    }
  >,
): Promise<Story> {
  return requestJson<Story>(`/api/stories/${id}`, {
    method: "PUT",
    body: input,
  })
}

export async function importStoryFromFile(file: File): Promise<{ suggested_title: string; content: string }> {
  const formData = new FormData()
  formData.append("file", file)

  const response = await fetch(`${BACKEND_BASE_URL}/api/stories/import-file`, {
    method: "POST",
    body: formData,
    cache: "no-store",
  })

  if (!response.ok) {
    const raw = await response.text()

    if (!raw) {
      throw new Error(`요청에 실패했습니다. (${response.status})`)
    }

    try {
      const parsed = JSON.parse(raw)
      throw new Error(parsed.message || parsed.error || `요청에 실패했습니다. (${response.status})`)
    } catch {
      throw new Error(raw)
    }
  }

  return (await response.json()) as { suggested_title: string; content: string }
}

export async function deleteStory(id: string): Promise<void> {
  await requestJson<void>(`/api/stories/${id}`, {
    method: "DELETE",
  })
}

export async function getComments(storyId: string): Promise<Comment[]> {
  const params = new URLSearchParams({ story_id: storyId })
  return requestJsonOrFallback<Comment[]>(`/api/comments?${params.toString()}`, [])
}

export async function createComment(input: {
  story_id: string
  author_name: string
  content: string
}): Promise<Comment> {
  return requestJson<Comment>("/api/comments", {
    method: "POST",
    body: input,
  })
}

export async function getFreeBoardMessages(): Promise<FreeBoardMessage[]> {
  return requestJsonOrFallback<FreeBoardMessage[]>("/api/free-board/messages", [])
}

type AdminRequestOptions = {
  asAdmin?: boolean
}

function getAdminHeaders(options?: AdminRequestOptions): Record<string, string> | undefined {
  if (!options?.asAdmin) {
    return undefined
  }

  return {
    "x-admin-session": "authenticated",
  }
}

export async function createFreeBoardMessage(input: {
  client_id: string
  author_name?: string
  content: string
}, options?: AdminRequestOptions): Promise<FreeBoardMessage> {
  return requestJson<FreeBoardMessage>("/api/free-board/messages", {
    method: "POST",
    body: input,
    headers: getAdminHeaders(options),
  })
}

export async function getFreeBoardBans(options?: AdminRequestOptions): Promise<FreeBoardBan[]> {
  return requestJson<FreeBoardBan[]>("/api/free-board/bans", {
    headers: getAdminHeaders(options),
  })
}

export async function createFreeBoardBan(input: {
  client_id: string
  author_name?: string
  ban_type: "temporary" | "permanent"
  duration_minutes?: number
  reason?: string
}, options?: AdminRequestOptions): Promise<FreeBoardBan> {
  return requestJson<FreeBoardBan>("/api/free-board/bans", {
    method: "POST",
    body: input,
    headers: getAdminHeaders(options),
  })
}

export async function deleteFreeBoardBan(clientId: string, options?: AdminRequestOptions): Promise<void> {
  await requestJson<void>(`/api/free-board/bans/${clientId}`, {
    method: "DELETE",
    headers: getAdminHeaders(options),
  })
}

export async function clearFreeBoardMessages(options?: AdminRequestOptions): Promise<{ cleared_count: number }> {
  return requestJson<{ cleared_count: number }>("/api/free-board/messages/clear", {
    method: "POST",
    headers: getAdminHeaders(options),
  })
}
