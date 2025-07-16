-- Migration: Update embeddings to use text-embedding-3-large (3072 dimensions)
-- This migration handles the switch from text-embedding-3-small to text-embedding-3-large

-- WARNING: This migration will delete all existing embeddings because the dimensions are incompatible
-- You will need to re-run your PDF processing to regenerate embeddings with the new model

BEGIN;

-- Step 1: Clear existing embeddings (they are incompatible with new dimensions)
DELETE FROM project_embeddings;

-- Step 2: Update the embedding column to use 3072 dimensions
ALTER TABLE project_embeddings 
ALTER COLUMN embedding TYPE vector(3072);

-- Step 3: Reset processing status for all knowledge documents so they get re-processed
UPDATE project_knowledge 
SET processed = FALSE, 
    processed_at = NULL, 
    chunks_count = NULL, 
    processing_error = NULL;

-- Step 4: Update any documentation
COMMENT ON COLUMN project_embeddings.embedding IS 'Vector embedding using text-embedding-3-large (3072 dimensions)';

COMMIT;

-- After running this migration:
-- 1. Run your PDF extractor: python pdf_extractor.py
-- 2. Or upload documents again through the web interface
-- 3. This will regenerate all embeddings with the new text-embedding-3-large model 