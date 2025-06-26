-- Add processing status fields to project_knowledge table
ALTER TABLE project_knowledge 
ADD COLUMN processed BOOLEAN DEFAULT FALSE,
ADD COLUMN processed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN chunks_count INTEGER,
ADD COLUMN processing_error TEXT;

-- Create index for faster queries on unprocessed files
CREATE INDEX idx_project_knowledge_processed ON project_knowledge(processed);

-- Create index for project embeddings queries
CREATE INDEX idx_project_embeddings_project_id ON project_embeddings(project_id);
CREATE INDEX idx_project_embeddings_knowledge_id ON project_embeddings(knowledge_id); 