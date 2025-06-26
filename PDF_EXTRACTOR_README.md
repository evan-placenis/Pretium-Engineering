# PDF Extractor with Embeddings

This Python script processes uploaded PDFs, extracts text, generates embeddings, and stores them in the database for RAG (Retrieval-Augmented Generation).

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Environment Variables

Create a `.env` file with:

```
OPENAI_API_KEY=your-openai-api-key-here
SUPABASE_URL=your-supabase-project-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

### 3. Database Schema Updates

Run the SQL commands in `database_schema_updates.sql` to add processing status fields.

## How It Works

### Flow:

1. **PDF Upload** → User uploads PDF via web interface
2. **File Storage** → PDF stored in Supabase storage bucket
3. **Metadata Storage** → File info saved to `project_knowledge` table
4. **PDF Processing** → Python script processes unprocessed PDFs
5. **Text Extraction** → Extract text using pdfplumber
6. **Chunking** → Split text into manageable chunks
7. **Embedding Generation** → Create embeddings using OpenAI
8. **Database Storage** → Store embeddings in `project_embeddings` table

### When It Runs:

- **Manual**: Run `python pdf_extractor.py`
- **Scheduled**: Set up cron job or cloud function
- **Triggered**: After each PDF upload (webhook)

## Usage

### Process All Unprocessed PDFs:

```python
extractor = PDFExtractor()
extractor.process_all_unprocessed_pdfs()
```

### Process Specific PDF:

```python
extractor.process_pdf_and_store_embeddings(
    project_id="project-uuid",
    knowledge_id="knowledge-uuid",
    file_path="project-knowledge/project-id/spec/filename.pdf",
    file_name="filename.pdf"
)
```

## Database Tables

### project_knowledge

- `id`: UUID primary key
- `project_id`: Reference to projects table
- `file_name`: Original filename
- `file_path`: Storage path
- `file_type`: 'spec' or 'building_code'
- `processed`: Boolean (processed status)
- `processed_at`: Timestamp when processed
- `chunks_count`: Number of text chunks created
- `processing_error`: Error message if processing failed

### project_embeddings

- `id`: UUID primary key
- `project_id`: Reference to projects table
- `knowledge_id`: Reference to project_knowledge table
- `content_chunk`: Text chunk content
- `embedding`: Vector embedding (1536 dimensions)
- `chunk_index`: Order of chunk in document
- `created_at`: Timestamp

## Integration with Web App

The spec-parser in the web app (`spec-parser.ts`) provides:

- **Immediate feedback** during upload
- **Text extraction testing** in browser console
- **Section parsing** for document structure

The Python extractor provides:

- **Production processing** with OpenAI embeddings
- **Database storage** for RAG queries
- **Batch processing** of multiple PDFs

## Next Steps

1. **Set up environment** with API keys
2. **Run database schema updates**
3. **Test with a sample PDF**
4. **Set up automated processing** (cron/cloud function)
5. **Integrate with RAG queries** in report generation
