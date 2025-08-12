"use client";
import { useState } from 'react';

const SAMPLE_MARKDOWN = `# 1. Introduction
This is an introduction to our report.

# 2. Methodology
## 2.1. Data Collection
We collected data using various methods.

## 2.2. Analysis
The analysis was performed using standard techniques.

# 3. Results
Here are our findings:
- Finding 1
- Finding 2
[IMAGE:1:RESULTS]

# 4. Conclusion
This concludes our report.`;

export default function TestStructuredChat() {
  const [markdown, setMarkdown] = useState(SAMPLE_MARKDOWN);
  const [userInput, setUserInput] = useState('');
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: userInput
          }],
          reportMarkdown: markdown
        })
      });

      const data = await response.json();
      setResponse(data);
      
      if (data.updatedMarkdown) {
        setMarkdown(data.updatedMarkdown);
      }
    } catch (error) {
      console.error('Error:', error);
      setResponse({ error: 'Failed to process request' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Structured Chat Test</h1>
      
      {/* Input Section */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Edit Command</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="e.g., Rename section 1 to Overview"
            className="flex-1 p-2 border rounded"
          />
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-blue-300"
          >
            {loading ? 'Processing...' : 'Submit'}
          </button>
        </div>
      </div>

      {/* Markdown Display */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h2 className="text-xl font-semibold mb-2">Current Markdown</h2>
          <pre className="p-4 bg-gray-100 rounded whitespace-pre-wrap">
            {markdown}
          </pre>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">Response</h2>
          <pre className="p-4 bg-gray-100 rounded whitespace-pre-wrap">
            {response ? JSON.stringify(response, null, 2) : 'No response yet'}
          </pre>
        </div>
      </div>

      {/* Section Tree */}
      {response?.sections && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-2">Section Tree</h2>
          <pre className="p-4 bg-gray-100 rounded whitespace-pre-wrap">
            {JSON.stringify(response.sections, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
