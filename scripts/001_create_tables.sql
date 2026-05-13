-- Author Profile table (singleton - only one profile)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_image_url TEXT,
  profile_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stories table (for synopsis, short stories, long stories)
CREATE TABLE IF NOT EXISTS stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  thumbnail_url TEXT,
  images TEXT[] DEFAULT '{}',
  is_published BOOLEAN DEFAULT TRUE,
  category TEXT NOT NULL CHECK (category IN ('synopsis', 'short_story', 'long_story')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL DEFAULT 'Anonymous',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_stories_category ON stories(category);
CREATE INDEX IF NOT EXISTS idx_comments_story_id ON comments(story_id);

-- Insert default profile if not exists
INSERT INTO profiles (id, profile_text)
VALUES ('00000000-0000-0000-0000-000000000001', 'Welcome to my author portfolio!')
ON CONFLICT (id) DO NOTHING;
