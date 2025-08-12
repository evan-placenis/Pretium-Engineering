import { NextRequest } from 'next/server';
import { OpenAI } from 'openai';
import { SectionModel } from './models/SectionModel';
import { SectionTools } from './tools/SectionTools';
import { ChatCompletionTool } from 'openai/resources/chat/completions.mjs';

// Define the tools available to the model
const SECTION_TOOLS = [
  {
    type: "function",
    function: {
      name: "list_sections",
      description: "Return all sections with ids and numbers for disambiguation.",
      parameters: { type: "object", properties: {}, additionalProperties: false }
    }
  },
  {
    type: "function",
    function: {
      name: "rename_section",
      description: "Rename an existing section.",
      parameters: {
        type: "object",
        properties: {
          section_id: { type: "string" },
          new_title: { type: "string" }
        },
        required: ["section_id", "new_title"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "set_section_body",
      description: "Update the body content of a section.",
      parameters: {
        type: "object",
        properties: {
          section_id: { type: "string" },
          body_md: { type: "string" }
        },
        required: ["section_id", "body_md"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "insert_section",
      description: "Insert a new section after the specified section.",
      parameters: {
        type: "object",
        properties: {
          section_id: { type: "string" },
          title: { type: "string" },
          body_md: { type: "string" }
        },
        required: ["section_id", "title"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_section",
      description: "Delete an existing section.",
      parameters: {
        type: "object",
        properties: {
          section_id: { type: "string" }
        },
        required: ["section_id"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "move_section",
      description: "Move a section to be a child of another section.",
      parameters: {
        type: "object",
        properties: {
          section_id: { type: "string" },
          new_parent_id: { type: "string" },
          position: { type: "number" }
        },
        required: ["section_id", "new_parent_id"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "find_sections",
      description: "Search for sections by title or content.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" }
        },
        required: ["query"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "replace_text",
      description: "Replace text in a section using regex.",
      parameters: {
        type: "object",
        properties: {
          section_id: { type: "string" },
          find: { type: "string" },
          replace: { type: "string" },
          flags: { type: "string" }
        },
        required: ["section_id", "find", "replace"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "insert_image_ref",
      description: "Insert an image reference in a section.",
      parameters: {
        type: "object",
        properties: {
          section_id: { type: "string" },
          image_number: { type: "number" },
          group: { type: "string" }
        },
        required: ["section_id", "image_number"],
        additionalProperties: false
      }
    }
  }
];

export async function POST(req: NextRequest) {
  try {
    const { messages, reportMarkdown } = await req.json();

    if (!reportMarkdown) {
      return new Response(JSON.stringify({
        error: "reportMarkdown is required"
      }), { status: 400 });
    }

    // Parse the report into our section model
    const sections = await SectionModel.fromMarkdown(reportMarkdown);
    const model = new SectionModel(sections);
    const tools = new SectionTools(model);

    // Initialize conversation state
    let currentMessages = [...messages];
    const maxSteps = 6; // Prevent infinite loops

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // Add system message explaining tool usage
    currentMessages.unshift({
      role: "system",
      content: `You are a helpful assistant that edits structured documents. When users refer to sections by number (e.g., "section 1" or "section 2.1"), always:

1. First call list_sections() to get the mapping between section numbers and their stable IDs
2. Then use the stable ID in subsequent operations (rename_section, set_section_body, etc.)

For any request that involves editing, changing, adding, deleting, or modifying the report in any way, you MUST use the available tools. Do not describe the changes or return edited text directly—always call the tools to perform the edits, and they will return the updated state. If the user asks for something not requiring tools, respond normally.

Example for rename:
User: "Rename section 1 to Overview"
Assistant should:
1. Call list_sections() to find section 1's ID
2. Use that ID with rename_section()

Example for delete:
User: "Delete section 2"
Assistant should:
1. Call list_sections() to get ID of section 2
2. Call delete_section({ section_id: '<id>' })

Never try to use section numbers directly as IDs - they can change when sections are moved or reordered. Always get the stable UUID first.`
    });

    for (let step = 0; step < maxSteps; step++) {
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: currentMessages,
        tools: SECTION_TOOLS as ChatCompletionTool[],
        tool_choice: "auto"
      });

      const message = completion.choices[0].message;

      // If no tool calls, we're done
      if (!message.tool_calls?.length) {
        return new Response(JSON.stringify({
          message: message.content,
          updatedMarkdown: model.toMarkdown(),
          sections: model.getState()
        }));
      }

      // Add assistant's message with tool calls to conversation first
      currentMessages.push(message);

      // Then execute each tool call and add their results
      for (const call of message.tool_calls) {
        const { name, arguments: args } = call.function;
        const result = await tools.applyTool(name, JSON.parse(args));
        
        // Add tool result to conversation
        currentMessages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result)
        });
      }
    }

    return new Response(JSON.stringify({
      error: "Exceeded maximum number of tool calls"
    }), { status: 400 });

  } catch (error) {
    console.error('Error in chat route:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), { status: 500 });
  }
}