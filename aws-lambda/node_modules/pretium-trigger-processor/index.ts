import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: 'ok'
    };
  }

  try {
    // Get environment variables
    const processJobsFunctionUrl = process.env.PROCESS_JOBS_FUNCTION_URL!;

    if (!processJobsFunctionUrl) {
      throw new Error('Missing PROCESS_JOBS_FUNCTION_URL environment variable');
    }

    console.log('🚀 Triggering job processor...');

    // Call the main job processor function (fire-and-forget)
    try {
      const response = await fetch(processJobsFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        console.log('✅ Job processor triggered successfully');
      } else {
        console.error('❌ Job processor returned error status:', response.status);
      }
    } catch (error) {
      console.error('❌ Trigger failed:', error);
    }

    // Return immediately - don't wait for the processor
    console.log('✅ Trigger request sent');

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'Job processor triggered successfully'
      })
    };

  } catch (error: any) {
    console.error('Error in job processor trigger:', error);

    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
}; 