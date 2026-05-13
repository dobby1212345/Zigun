-- Subcategories table for short and long stories
CREATE TABLE IF NOT EXISTS subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_category TEXT NOT NULL CHECK (parent_category IN ('short', 'long')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add subcategory_id to stories table
ALTER TABLE stories ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES subcategories(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_subcategories_parent ON subcategories(parent_category);
CREATE INDEX IF NOT EXISTS idx_stories_subcategory ON stories(subcategory_id);
