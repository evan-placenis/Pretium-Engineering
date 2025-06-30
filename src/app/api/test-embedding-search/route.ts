import { NextRequest, NextResponse } from 'next/server';
import { embeddingService } from '@/app/projects/[id]/hooks/embedding-service';

export async function POST(req: NextRequest) {
  try {
    const { projectId, query, limit, runDefaultTests } = await req.json();
    
    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    // Handle default tests
    if (runDefaultTests) {
      console.log('Running default tests...');
      const defaultQueries = [
        "roof installation requirements",
        "safety procedures", 
        "material specifications",
        "quality control standards"
      ];
      
      const testResults = [];
      for (const testQuery of defaultQueries) {
        try {
          const results = await embeddingService.searchSimilarContent(projectId, testQuery, 3);
          testResults.push({
            query: testQuery,
            results: results,
            success: true
          });
        } catch (error) {
          testResults.push({
            query: testQuery,
            results: [],
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      return NextResponse.json({ testResults });
    }

    // Handle single query test
    if (!query) {
      return NextResponse.json({ error: 'Missing query' }, { status: 400 });
    }
    
    console.log(`Testing query: "${query}"`);
    const results = await embeddingService.searchSimilarContent(projectId, query, limit || 5);
    
    return NextResponse.json({ results });
    
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
} 