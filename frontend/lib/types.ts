export interface Profile {
  id: string
  writer_name: string | null
  profile_text: string | null
  profile_image_url: string | null
  created_at: string
  updated_at: string
}

export interface Story {
  id: string
  title: string
  content: string
  category: 'synopsis' | 'short' | 'long' | 'short_story' | 'long_story'
  subcategory_id: string | null
  is_published?: boolean
  cover_image_url?: string | null
  thumbnail_url: string | null
  images: string[] | null
  created_at: string
  updated_at: string
  subcategory?: Subcategory | null
}

export interface Subcategory {
  id: string
  name: string
  parent_category: 'short' | 'long'
  sort_order: number
  created_at: string
}

export interface Comment {
  id: string
  story_id: string
  author_name: string
  content: string
  created_at: string
}

export interface FreeBoardMessage {
  id: string
  client_id: string | null
  author_name: string
  content: string
  is_admin: boolean
  created_at: string
}

export interface FreeBoardBan {
  id: string
  client_id: string
  author_name_snapshot: string | null
  ban_type: "temporary" | "permanent"
  banned_until: string | null
  reason: string | null
  created_at: string
  created_by: "admin"
}
