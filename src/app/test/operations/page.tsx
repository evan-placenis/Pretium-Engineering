'use client';

import { useState } from 'react';
import { useOperations } from '../../reports/[id]/edit/hooks/useOperations';
import { Section } from '../../reports/[id]/edit/operations/types';
import { supabase } from '@/lib/supabase';

const SAMPLE_SECTIONS: Section[] = [
  {
    id: '1',
    number: '1',
    title: 'Introduction',
    bodyMd: 'This is the introduction section.',
    children: []
  },
  {
    id: '2',
    number: '2',
    title: 'Methodology',
    bodyMd: 'This describes our methodology.',
    children: [
      {
        id: '2.1',
        number: '2.1',
        title: 'Data Collection',
        bodyMd: 'How we collected the data.',
        children: []
      }
    ]
  }
];

export default function OperationsTest() {
  const [sections, setSections] = useState<Section[]>(SAMPLE_SECTIONS);
  const [operationResult, setOperationResult] = useState<any>(null);

  const {
    applyOperation,
    undo,
    canUndo,
    isLoading,
    error
  } = useOperations({
    reportId: '123e4567-e89b-12d3-a456-426614174000', // Test UUID
    initialSections: SAMPLE_SECTIONS,
    onSectionsChange: setSections
  });

  const handleRename = async () => {
    const result = await applyOperation({
      type: 'rename_section',
      sectionId: '1',
      prevTitle: sections[0].title,
      newTitle: 'Overview'
    });
    setOperationResult(result);
  };

  const handleSetBody = async () => {
    const result = await applyOperation({
      type: 'set_section_body',
      sectionId: '1',
      prevBody: sections[0].bodyMd,
      newBody: 'This is an updated introduction with more details.'
    });
    setOperationResult(result);
  };

  const handleInsert = async () => {
    const result = await applyOperation({
      type: 'insert_section',
      afterId: '1',
      section: {
        id: '1.1',
        number: '1.1',
        title: 'Background',
        bodyMd: 'Background information goes here.',
        children: []
      }
    });
    setOperationResult(result);
  };

  const createTestReport = async () => {
    const { data, error } = await supabase
      .from('reports')
      .insert({
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test Report',
        project_id: '00000000-0000-0000-0000-000000000000', // Default project ID
        generated_content: JSON.stringify(SAMPLE_SECTIONS),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select();

    if (error) {
      console.error('Error creating test report:', error);
      alert('Failed to create test report: ' + error.message);
    } else {
      alert('Test report created successfully!');
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Operations Test Page</h1>
      
      {/* Setup */}
      <div className="mb-8">
        <button
          onClick={createTestReport}
          className="px-4 py-2 bg-yellow-500 text-white rounded"
        >
          Create Test Report
        </button>
        <p className="mt-2 text-sm text-gray-600">
          Click this first to create a test report in the database
        </p>
      </div>

      {/* Controls */}
      <div className="flex gap-4 mb-8">
        <button
          onClick={handleRename}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Rename Section 1
        </button>
        <button
          onClick={handleSetBody}
          className="px-4 py-2 bg-green-500 text-white rounded"
        >
          Update Content
        </button>
        <button
          onClick={handleInsert}
          className="px-4 py-2 bg-purple-500 text-white rounded"
        >
          Insert Section
        </button>
        <button
          onClick={undo}
          disabled={!canUndo}
          className="px-4 py-2 bg-red-500 text-white rounded disabled:bg-gray-400"
        >
          Undo
        </button>
      </div>

      {/* Status */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Status</h2>
        <div className="bg-gray-100 p-4 rounded">
          <p>Loading: {isLoading ? 'Yes' : 'No'}</p>
          <p>Can Undo: {canUndo ? 'Yes' : 'No'}</p>
          {error && <p className="text-red-500">Error: {error}</p>}
        </div>
      </div>

      {/* Last Operation Result */}
      {operationResult && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-2">Last Operation Result</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto">
            {JSON.stringify(operationResult, null, 2)}
          </pre>
        </div>
      )}

      {/* Current Sections */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Current Sections</h2>
        <pre className="bg-gray-100 p-4 rounded overflow-auto">
          {JSON.stringify(sections, null, 2)}
        </pre>
      </div>
    </div>
  );
}
