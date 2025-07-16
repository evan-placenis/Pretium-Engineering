-- -- Add processing status fields to project_knowledge table
-- ALTER TABLE project_knowledge 
-- ADD COLUMN processed BOOLEAN DEFAULT FALSE,
-- ADD COLUMN processed_at TIMESTAMP WITH TIME ZONE,
-- ADD COLUMN chunks_count INTEGER,
-- ADD COLUMN processing_error TEXT;

-- -- Create index for faster queries on unprocessed files
-- CREATE INDEX idx_project_knowledge_processed ON project_knowledge(processed);

-- -- Create index for project embeddings queries
-- CREATE INDEX idx_project_embeddings_project_id ON project_embeddings(project_id);
-- CREATE INDEX idx_project_embeddings_knowledge_id ON project_embeddings(knowledge_id);

-- Add document source tracking columns to project_embeddings table
-- This enables citation and better chunk organization

ALTER TABLE project_embeddings 
ADD COLUMN IF NOT EXISTS document_source TEXT,
ADD COLUMN IF NOT EXISTS section_title TEXT,
ADD COLUMN IF NOT EXISTS chunk_type TEXT;

-- Create indexes for faster searches
CREATE INDEX IF NOT EXISTS idx_project_embeddings_document_source 
ON project_embeddings(document_source);

CREATE INDEX IF NOT EXISTS idx_project_embeddings_section_title 
ON project_embeddings(section_title);

-- Add unique constraint to prevent duplicate embeddings for the same knowledge_id and chunk_index
-- This prevents the same chunk from being inserted multiple times
ALTER TABLE project_embeddings 
ADD CONSTRAINT IF NOT EXISTS unique_knowledge_chunk 
UNIQUE (knowledge_id, chunk_index);

-- Update the search_embeddings function to include new metadata
-- First drop the existing function to change parameter types
DROP FUNCTION IF EXISTS search_embeddings(vector, uuid, double precision, integer);

CREATE OR REPLACE FUNCTION search_embeddings(
  query_embedding vector(3072),
  project_id uuid,
  match_threshold float DEFAULT 0.6,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  content_chunk text,
  similarity float,
  chunk_index int,
  knowledge_id uuid,
  document_source text,
  section_title text,
  chunk_type text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pe.id,
    pe.content_chunk,
    1 - (pe.embedding <=> query_embedding) as similarity,
    pe.chunk_index,
    pe.knowledge_id,
    pe.document_source,
    pe.section_title,
    pe.chunk_type
  FROM project_embeddings pe
  WHERE pe.project_id = search_embeddings.project_id
    AND 1 - (pe.embedding <=> query_embedding) > match_threshold
  ORDER BY pe.embedding <=> query_embedding
  LIMIT match_count;
END;
$$; 