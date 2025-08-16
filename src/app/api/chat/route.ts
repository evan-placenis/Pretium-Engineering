import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { SectionTools } from '@/lib/jsonTreeModels/tools/SectionTools';
import { ChatCompletionTool, ChatCompletionMessageParam } from 'openai/resources/chat/completions.mjs';
import { searchProjectSpecsTool, handleSpecSearch, ruleGate } from '@/lib/jsonTreeModels/tools/chat-knowlege/guards';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { userMessage, reportId, projectId } = await req.json();

    if (!userMessage || !reportId || !projectId) {
      return new Response(JSON.stringify({
        error: "userMessage, reportId, and projectId are required"
      }), { status: 400 });
    }

    // --- Pre-check Gate ---
    const allowSpecs = ruleGate(userMessage);
    const sectionTools = new SectionTools(reportId, projectId);
    
    // Dynamically assemble the tool list based on the gate
    const contextTools = sectionTools.getContextTools();
    const actionTools = sectionTools.getActionTools();
    let availableTools: any[] = [...contextTools, ...actionTools];
    if (allowSpecs) {
      availableTools.push(searchProjectSpecsTool);
    }
    
    const allToolHandlers = {
        ...contextTools.reduce((acc, tool) => ({ ...acc, [tool.function.name]: tool.function.handler }), {}),
        ...actionTools.reduce((acc, tool) => ({ ...acc, [tool.function.name]: tool.function.handler }), {}),
        [searchProjectSpecsTool.function.name]: (args: any) => handleSpecSearch(supabase, projectId, args.query, args.topK)
    };
    
    const policyFlags = `Policy flags: allowSpecs=${allowSpecs}`;

    // Initialize conversation state with the correct type
    let currentMessages: ChatCompletionMessageParam[] = [
        { role: 'system', content: getSystemPrompt() + "\n" + policyFlags },
        { role: 'user', content: userMessage }
    ];
    const maxSteps = 5;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    for (let step = 0; step < maxSteps; step++) {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: currentMessages,
        tools: availableTools as unknown as ChatCompletionTool[],
        tool_choice: "auto"
      });

      const message = completion.choices[0].message;

      // If no tool calls, we're done
      if (!message.tool_calls?.length) {
        const finalModel = await sectionTools.getFinalModel();
        return new Response(JSON.stringify({
          message: message.content,
          updatedSections: finalModel.getState().sections,
        }));
      }

      // Add assistant's message with tool calls to conversation first
      currentMessages.push(message);

      // Then execute each tool call and add their results
      for (const call of message.tool_calls) {
        const { name, arguments: rawArgs } = call.function;
        const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
        
        const handler = allToolHandlers[name];
        if (!handler) {
            throw new Error(`Tool ${name} not found`);
        }

        const result = await handler(args);
        
        currentMessages.push({
          role: "tool",
          tool_call_id: call.id,
          content: typeof result === 'object' ? JSON.stringify(result) : result,
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

function getSystemPrompt(): string {
  return `You are an AI assistant for editing construction reports.

**CORE BEHAVIOR:**
You start with NO CONTEXT about the report or chat history. Your primary goal is to fulfill the user's request using tools.

**CRITICAL RULE: USE IDs, NOT NUMBERS**
Section numbers (e.g., "1", "2.1") are for display only and can change. You **MUST NOT** use them as IDs in your tool calls.
If a user refers to a section number, your workflow **MUST** be:
1. Call \`get_report_slices()\` to get a list of all sections and their stable UUIDs.
2. Find the section in the response that has the matching number.
3. Use that section's stable UUID in the action tool (e.g., \`update_section\`).

**EXAMPLE WORKFLOW:**
User says: "Change the title of section 2 to 'New Title'"
Your response MUST be a sequence of two tool calls:
1. First, call \`get_report_slices({})\` to get the ID for section number "2.".
2. Then, use that ID to call \`update_section({ "id": "the-real-uuid-you-found", "title": "New Title" })\`.

**OTHER RULES:**
1.  **BE LAZY:** Do not fetch context you don't need. Use the narrowest tool possible.
2.  **RENUMBER LAST:** After any structural change (\`add_section\`, \`move_section\`, \`delete_section\`), your final action **MUST** be a call to \`renumber_sections()\`.
3.  **SEARCH FOR SPECS:** Use \`search_project_specs\` ONLY for questions about technical requirements, codes, or standards.`;
}