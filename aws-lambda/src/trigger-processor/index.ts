import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

const sqsClient = new SQSClient({});

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
    const jobQueueUrl = process.env.JOB_QUEUE_URL!;

    if (!jobQueueUrl) {
      throw new Error('Missing JOB_QUEUE_URL environment variable');
    }

    console.log('🚀 Triggering job processor...');
    console.log('📬 Sending message to queue:', jobQueueUrl);

    // Send a message to the SQS queue to trigger the job processor
    try {
      const command = new SendMessageCommand({
        QueueUrl: jobQueueUrl,
        MessageBody: JSON.stringify({ trigger: 'process-jobs' }),
      });
      await sqsClient.send(command);
      console.log('✅ Message sent to SQS successfully');
    } catch (error) {
      console.error('❌ Failed to send message to SQS:', error);
      throw new Error('Failed to queue job for processing');
    }

    // Return immediately
    console.log('✅ Trigger request sent');

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'Job successfully queued for processing'
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