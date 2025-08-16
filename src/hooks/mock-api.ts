// Mock API responses for local development without connecting to OpenAI

// Mock report generation response
export const generateMockReport = async (bulletPoints: string, buildingName: string) => {
  console.log('Generating mock report for:', buildingName);
  console.log('Based on bullet points:', bulletPoints);
  
  // Simulate API latency
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Generate a simple mock report based on bullet points
  const bulletArray = bulletPoints.split('\n').filter(line => line.trim());
  
  const mockReport = `
# Engineering Report: ${buildingName || 'Unnamed Building'}

## Introduction
This report presents the findings from a recent inspection of ${buildingName || 'the building'}. The inspection was conducted to assess current conditions and identify any issues requiring attention.

## Observations
${bulletArray.map(bullet => `- ${bullet.replace('•', '').trim()}`).join('\n')}

## Analysis
Based on the observations noted during the inspection, several issues require attention. ${bulletArray.length > 0 ? `Most notably, ${bulletArray[0].replace('•', '').trim().toLowerCase()}.` : ''}

${bulletArray.length > 1 ? `Additionally, ${bulletArray.slice(1).map(bullet => bullet.replace('•', '').trim().toLowerCase()).join(' and ')}.` : ''}

## Recommendations
1. Address all identified issues promptly to prevent further deterioration
2. Develop a maintenance schedule to regularly inspect and maintain all building systems
3. Consider professional consultation for specialized repairs and maintenance

## Conclusion
The building requires attention to the issues identified during this inspection. Addressing these concerns in a timely manner will help maintain the building's integrity and functionality.
`;

  return { generatedContent: mockReport };
};

// Mock chat response
export const generateMockChatResponse = async (message: string, reportContent: string) => {
  console.log('Generating mock chat response for message:', message);
  
  // Simulate API latency
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Simple response generation logic
  let response = '';
  
  if (message.toLowerCase().includes('explain') || message.toLowerCase().includes('clarify')) {
    response = `I'd be happy to explain that in more detail. The section you're asking about provides technical information about the building's condition based on the inspection findings.`;
  } else if (message.toLowerCase().includes('rewrite') || message.toLowerCase().includes('revise')) {
    response = `Here's a revised version of that section: [Revised content would appear here with more technical language and detail]`;
  } else if (message.toLowerCase().includes('expand') || message.toLowerCase().includes('more detail')) {
    response = `To expand on that section, I would add more specific measurements, technical specifications, and potential causes of the observed issues.`;
  } else {
    response = `Thank you for your question. I've analyzed the report and can provide the information you need. Is there a specific part of the report you'd like me to focus on?`;
  }
  
  return { reply: response };
};

// Mock Word document export
export const mockWordExport = async () => {
  console.log('Mocking Word document export');
  
  // Simulate API latency
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // In a real implementation, we'd return a blob here
  // For mock purposes, we'll just return a success message
  return { success: true, message: 'Mock Word export successful' };
}; 