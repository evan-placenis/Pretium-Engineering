-- Migration: Prevent duplicate embeddings
-- This adds a unique constraint to prevent the same chunk from being inserted multiple times

-- Add unique constraint to prevent duplicate embeddings for the same knowledge_id and chunk_index
-- This prevents the same chunk from being inserted multiple times
ALTER TABLE project_embeddings 
ADD CONSTRAINT IF NOT EXISTS unique_knowledge_chunk 
UNIQUE (knowledge_id, chunk_index);

-- Optional: Clean up any existing duplicates before adding the constraint
-- Run this if you want to remove existing duplicates first
-- DELETE FROM project_embeddings 
-- WHERE id NOT IN (
--   SELECT MIN(id) 
--   FROM project_embeddings 
--   GROUP BY knowledge_id, chunk_index
-- ); 