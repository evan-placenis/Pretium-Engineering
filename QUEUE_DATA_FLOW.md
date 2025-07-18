# Queue Data Flow & Agent Architecture

## 🔄 **Current Data Flow**

### What Gets Sent to the Queue

When a user hits "Generate Report", this data is sent to the queue:

```typescript
{
  job_type: 'generate_report',
  input_data: {
    bulletPoints: string,      // User's instructions for the report
    contractName: string,      // Contract name
    location: string,          // Project location
    reportId: string,          // UUID of the report record
    images: ReportImage[],     // Array of images with descriptions
    projectId: string          // UUID of the project
  },
  options: {
    priority: 0,
    max_retries: 3
  }
}
```

### ReportImage Structure

```typescript
interface ReportImage {
  id: string;
  report_id: string;
  url: string; // Image URL
  description: string; // User's description of the image
  tag: TagValue; // OVERVIEW, DEFICIENCY, etc.
  group?: string[]; // Group categorization
  number?: number; // Image number
  rotation?: number; // Image rotation
}
```

## 🤖 **Your Agent Architecture**

Based on your mention of multiple agents, here's how they should work together:

### 1. **RAG Retrieval Agent** (Knowledge Base)

- **Purpose**: Retrieves relevant specifications and documents
- **Input**: Image description + project context
- **Output**: Relevant knowledge chunks with citations
- **Current Status**: Partially implemented in `getRelevantKnowledgeChunks()`

### 2. **Report Generation Agent** (Grok AI)

- **Purpose**: Generates the actual report content
- **Input**: Images + RAG results + user instructions
- **Output**: Formatted report with observations
- **Current Status**: ✅ Fully implemented

### 3. **Chat Bot Agent** (User Interface)

- **Purpose**: Handles user interactions and report editing
- **Input**: User queries about reports
- **Output**: Chat responses and report modifications
- **Current Status**: Needs integration with queue system

## 🔧 **Recommended Architecture**

### Option 1: Single Queue Job (Current)

```typescript
// One job handles everything
{
  job_type: 'generate_report',
  input_data: {
    bulletPoints,
    contractName,
    location,
    reportId,
    images,
    projectId
  }
}
```

### Option 2: Multi-Stage Queue (Recommended)

```typescript
// Stage 1: RAG Retrieval
{
  job_type: 'rag_retrieval',
  input_data: {
    projectId,
    images,
    reportId
  }
}

// Stage 2: Report Generation
{
  job_type: 'generate_report',
  input_data: {
    bulletPoints,
    contractName,
    location,
    reportId,
    images,
    projectId,
    ragResults: 'job_id_from_stage_1'  // Reference to RAG job
  }
}
```

### Option 3: Chat-Integrated Queue

```typescript
// Chat requests also go through queue
{
  job_type: 'chat_response',
  input_data: {
    reportId,
    message: string,
    chatHistory: ChatMessage[]
  }
}
```

## 🚀 **Trigger Implementation**

### Current Flow:

1. User clicks "Generate Report" → API route enqueues job
2. Job sits in queue until processor runs
3. Manual trigger or cron job processes queue

### Recommended Flow:

1. User clicks "Generate Report" → API route enqueues job
2. **Immediately trigger processor** after enqueueing
3. Processor handles the job asynchronously

## 📊 **Data Sent to Queue - Complete Breakdown**

### All Data Being Sent:

1. **bulletPoints** - User's specific instructions for the report
2. **contractName** - Name of the contract/project
3. **location** - Physical location of the project
4. **reportId** - Database ID of the report record
5. **images** - Array of all images with:
   - Image URLs
   - User descriptions
   - Tags (OVERVIEW/DEFICIENCY)
   - Group categorizations
   - Image numbers
6. **projectId** - Database ID of the project

### What's NOT Sent (but could be):

- User authentication info (handled by Supabase)
- Project specifications (retrieved via RAG)
- Previous report versions
- Chat history
- User preferences

## 🔄 **Processing Flow**

### Current Implementation:

1. **Enqueue Job** → Database stores job with status 'queued'
2. **Trigger Processor** → Edge function picks up job
3. **RAG Retrieval** → For each image, find relevant specs
4. **Image Processing** → Resize images for AI
5. **Batch Processing** → Process images in batches of 5
6. **Grok AI** → Generate observations for each batch
7. **Final Review** → Format and structure the final report
8. **Update Database** → Save completed report

### Error Handling:

- **Retry Logic** → Failed jobs retry up to 3 times
- **Partial Results** → If final formatting fails, save partial report
- **Timeout Handling** → Each step has appropriate timeouts
- **Database Updates** → Progress saved at each step

## 🎯 **Next Steps for Your Agents**

### 1. Enhance RAG Agent

```typescript
// Add to job types
export type JobType =
  | "generate_report"
  | "rag_retrieval"
  | "chat_response"
  | "process_images"
  | "export_document";
```

### 2. Integrate Chat Bot

```typescript
// Chat requests go through queue
const chatJob = await enqueueJob("chat_response", {
  reportId,
  message: userMessage,
  chatHistory: previousMessages,
});
```

### 3. Add Multi-Stage Processing

```typescript
// Chain jobs together
const ragJob = await enqueueJob("rag_retrieval", {
  projectId,
  images,
  reportId,
});
const reportJob = await enqueueJob("generate_report", {
  ...otherData,
  ragJobId: ragJob.jobId,
});
```

This architecture gives you a scalable, reliable system that can handle all your agents while avoiding Vercel timeouts!
