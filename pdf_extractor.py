import openai
import faiss
import numpy as np
import os
import json
from typing import List, Dict, Any
import requests
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize OpenAI
openai.api_key = os.getenv("OPENAI_API_KEY")

# Initialize Supabase
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

class PDFExtractor:
    def __init__(self):
        self.openai_client = openai.OpenAI()
        
    def embed_texts(self, texts: List[str]) -> np.ndarray:
        """Generate embeddings for text chunks using OpenAI"""
        embeddings = []
        
        for i in range(0, len(texts), 100):  # Process in batches of 100
            batch = texts[i:i+100]
            try:
                response = self.openai_client.embeddings.create(
                    model="text-embedding-3-small",
                    input=batch
                )
                batch_embeddings = [d.embedding for d in response.data]
                embeddings.extend(batch_embeddings)
                print(f"Processed batch {i//100 + 1}, got {len(batch_embeddings)} embeddings")
            except Exception as e:
                print(f"Error processing batch {i//100 + 1}: {e}")
                # Add zero embeddings for failed chunks
                embeddings.extend([[0.0] * 1536] * len(batch))
                
        return np.array(embeddings)
    
    def build_vector_index(self, text_chunks: List[str]) -> tuple:
        """Build FAISS index from text chunks"""
        print(f"Building vector index for {len(text_chunks)} chunks...")
        vectors = self.embed_texts(text_chunks)
        index = faiss.IndexFlatL2(vectors.shape[1])
        index.add(vectors)
        print(f"Index built with {index.ntotal} vectors")
        return index, vectors
    
    def get_pdf_content_from_supabase(self, file_path: str) -> str:
        """Download and extract text from PDF stored in Supabase"""
        try:
            # Download file from Supabase storage
            response = supabase.storage.from_('project-knowledge').download(file_path)
            
            if response is None:
                raise Exception("Failed to download file from Supabase")
            
            # Save temporarily and extract text
            temp_path = f"temp_{os.path.basename(file_path)}"
            with open(temp_path, 'wb') as f:
                f.write(response)
            
            # Extract text using pdfplumber or similar
            import pdfplumber
            text_content = ""
            
            with pdfplumber.open(temp_path) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text_content += page_text + "\n"
            
            # Clean up temp file
            os.remove(temp_path)
            
            return text_content
            
        except Exception as e:
            print(f"Error extracting PDF content: {e}")
            return ""
    
    def split_into_chunks(self, text: str, max_chunk_size: int = 1000, overlap: int = 200) -> List[str]:
        """Split text into overlapping chunks"""
        chunks = []
        sentences = text.split('. ')
        
        current_chunk = ""
        
        for sentence in sentences:
            sentence = sentence.strip() + ". "
            
            if len(current_chunk) + len(sentence) > max_chunk_size:
                if current_chunk.strip():
                    chunks.append(current_chunk.strip())
                current_chunk = sentence
            else:
                current_chunk += sentence
        
        # Add the last chunk
        if current_chunk.strip():
            chunks.append(current_chunk.strip())
        
        return chunks
    
    def process_pdf_and_store_embeddings(self, project_id: str, knowledge_id: str, file_path: str, file_name: str):
        """Main function to process PDF and store embeddings in database"""
        try:
            print(f"Processing PDF: {file_name}")
            
            # 1. Extract text from PDF
            print("Extracting text from PDF...")
            text_content = self.get_pdf_content_from_supabase(file_path)
            
            if not text_content:
                raise Exception("No text content extracted from PDF")
            
            print(f"Extracted {len(text_content)} characters of text")
            
            # 2. Split into chunks
            print("Splitting text into chunks...")
            text_chunks = self.split_into_chunks(text_content)
            print(f"Created {len(text_chunks)} chunks")
            
            # 3. Generate embeddings
            print("Generating embeddings...")
            embeddings = self.embed_texts(text_chunks)
            
            # 4. Store in database
            print("Storing embeddings in database...")
            for i, (chunk, embedding) in enumerate(zip(text_chunks, embeddings)):
                try:
                    # Insert into project_embeddings table
                    supabase.table('project_embeddings').insert({
                        'project_id': project_id,
                        'knowledge_id': knowledge_id,
                        'content_chunk': chunk,
                        'embedding': embedding.tolist(),  # Convert numpy array to list
                        'chunk_index': i,
                        'created_at': 'now()'
                    }).execute()
                    
                    print(f"Stored chunk {i+1}/{len(text_chunks)}")
                    
                except Exception as e:
                    print(f"Error storing chunk {i}: {e}")
            
            print(f"Successfully processed and stored embeddings for {file_name}")
            
            # 5. Update knowledge record with processing status
            supabase.table('project_knowledge').update({
                'processed': True,
                'processed_at': 'now()',
                'chunks_count': len(text_chunks)
            }).eq('id', knowledge_id).execute()
            
        except Exception as e:
            print(f"Error processing PDF: {e}")
            # Update knowledge record with error status
            supabase.table('project_knowledge').update({
                'processed': False,
                'processing_error': str(e)
            }).eq('id', knowledge_id).execute()
            raise
    
    def get_unprocessed_pdfs(self) -> List[Dict[str, Any]]:
        """Get list of PDFs that haven't been processed yet"""
        try:
            response = supabase.table('project_knowledge').select('*').eq('processed', False).execute()
            return response.data
        except Exception as e:
            print(f"Error fetching unprocessed PDFs: {e}")
            return []
    
    def process_all_unprocessed_pdfs(self):
        """Process all unprocessed PDFs in the database"""
        unprocessed_pdfs = self.get_unprocessed_pdfs()
        print(f"Found {len(unprocessed_pdfs)} unprocessed PDFs")
        
        for pdf_record in unprocessed_pdfs:
            try:
                self.process_pdf_and_store_embeddings(
                    project_id=pdf_record['project_id'],
                    knowledge_id=pdf_record['id'],
                    file_path=pdf_record['file_path'],
                    file_name=pdf_record['file_name']
                )
            except Exception as e:
                print(f"Failed to process {pdf_record['file_name']}: {e}")

# Usage example
if __name__ == "__main__":
    extractor = PDFExtractor()
    
    # Process all unprocessed PDFs
    extractor.process_all_unprocessed_pdfs()
    
    # Or process a specific PDF
    # extractor.process_pdf_and_store_embeddings(
    #     project_id="your-project-id",
    #     knowledge_id="your-knowledge-id", 
    #     file_path="project-knowledge/project-id/spec/filename.pdf",
    #     file_name="filename.pdf"
    # ) 