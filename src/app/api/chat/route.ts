import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { SectionTools } from '@/lib/jsonTreeModels/tools/SectionTools';
import { ChatCompletionTool, ChatCompletionMessageParam } from 'openai/resources/chat/completions.mjs';
import { searchProjectSpecsTool, handleSpecSearch, ruleGate } from '@/lib/jsonTreeModels/tools/chat-knowlege/guards';
import { createServiceRoleClient } from '@/lib/supabase'; // Use the admin client
import { getReportSectionsForChat } from "@/lib/data/reports";
import { SectionModel } from "@/lib/jsonTreeModels/SectionModel";
import { ObservationReportStrategy } from "@/lib/report_strucutres/strategies/ObservationReportStrategy";
import { revalidateTag } from 'next/cache';

const supabaseAdmin = createServiceRoleClient(); // Instantiate the admin client

// Global variable to track if current report generation is complete (it checks for the completion message in the generated_content field)
let currentCompletedReportId: string | null = null;

// Heuristics for when to fetch recent chat history
function shouldUseHistory(msg: string): boolean {
  const m = msg.toLowerCase();
  // Anaphora / references to prior content
  const refTriggers = [
    'as above','as before','as discussed','that change','this change','the change',
    'previous message','earlier message','reworded content','the above','the one above',
    'same as before','like before','again','implement that','do it','use that'
  ];
  // Underspecified edit requests
  const editTriggers = [
    /^rename\b/, /^reword\b/, /^update\b/, /^change\b/, /^implement\b/,
    /section\s+\d+(\.\d+)*/ // References by number with no content in the same turn
  ];
  if (refTriggers.some(t => m.includes(t))) return true;
  if (editTriggers.some(r => r.test(m)) && !m.includes('"') && !m.includes('“')) return true;
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const { userMessage, reportId, projectId, model = 'grok-4' } = await req.json();

    if (!userMessage || !reportId || !projectId) {
      return new Response(JSON.stringify({
        error: "userMessage, reportId, and projectId are required"
      }), { status: 400 });
    }
    
    // --- Step 1: Check if we need to verify report generation completion ---
    const isInitializationMessage = userMessage.includes('Silent initialization') || userMessage.includes('This is your first message to the user');
    
    if (currentCompletedReportId !== reportId && !isInitializationMessage) {
      // Check DB once to see if generation is complete (skip for initialization)
      const { data: reportStatus } = await supabaseAdmin
        .from('reports')
        .select('generated_content')
        .eq('id', reportId)
        .single();

      const isComplete = reportStatus?.generated_content?.includes('✅ Report Generation Complete');
      
      if (!isComplete) {
        // Still generating - send message and stop
        return new Response(JSON.stringify({
          error: "Report generation not done yet. Please wait...",
          isGenerating: true
        }), { status: 202 });
      }
      
      // Generation is complete! Mark it and refresh cache
      currentCompletedReportId = reportId;
      revalidateTag(`report:${reportId}`);
      console.log(`[CHAT] Report ${reportId} marked as complete. Cache refreshed.`);
    }

    // --- Step 2: Fetch the report using the cached function ---
    const reportData = await getReportSectionsForChat(reportId);

    if (!reportData) {
      return new Response(
        JSON.stringify({
          error: `Report with ID ${reportId} could not be fetched.`,
        }),
        { status: 404 }
      );
    }

    const sectionModel = new SectionModel(
      reportData.sections,
      new ObservationReportStrategy()
    );

    // --- Pre-check Gate ---
    const allowSpecs = await ruleGate(userMessage);
    // --- Step 2: Auto-refresh the model with fresh database state ---
    // This ensures the AI always works with the current section arrangement,
    // even after operations like photo swaps that change section order
    sectionModel.setState(reportData.sections);
    console.log(`[AUTO-REFRESH] Section model refreshed with ${reportData.sections.length} root sections`);
    
    // --- Step 3: Pass the refreshed model to the tools ---
    const sectionTools = new SectionTools(reportId, projectId, sectionModel);
    
    // Dynamically assemble the tool list based on the gate
    const contextTools = sectionTools.getContextTools();
    const actionTools = sectionTools.getActionTools();
    
    // Separate definitions from handlers
    const toolDefinitions: ChatCompletionTool[] = [
        ...contextTools.map(t => t.function),
        ...actionTools.map(t => t.function),
    ].map(f => ({ type: 'function', function: { name: f.name, description: f.description, parameters: f.parameters } }));

    if (allowSpecs) {
      toolDefinitions.push({ type: 'function', function: searchProjectSpecsTool.function });
    }
    
    const allToolHandlers = {
        ...[...contextTools, ...actionTools].reduce((acc, tool) => {
            acc[tool.function.name] = tool.function.handler;
            return acc;
        }, {} as Record<string, Function>),
        [searchProjectSpecsTool.function.name]: (args: any) => handleSpecSearch(supabaseAdmin, projectId, args.query, args.topK)
    };
    
    const policyFlags = `Policy flags: allowSpecs=${allowSpecs}`;

    // Initialize conversation state with the correct type
    let currentMessages: ChatCompletionMessageParam[] = [
        { role: 'system', content: getSystemPrompt() + "\n" + policyFlags },
        { role: 'user', content: userMessage }
    ];

    // NEW: force-load recent chat if the user likely refers to it
    if (shouldUseHistory(userMessage)) {
      const hist = await sectionTools.getChatHistory({ maxTurns: 6 });
      if (hist.success && Array.isArray(hist.data)) {
        // Lightweight, model-friendly summary line per turn
        const histText = (hist.data as Array<{role:string, content:string}>)
          .map(h => `${h.role.toUpperCase()}: ${h.content}`)
          .join('\n---\n');
        currentMessages.splice(1, 0, {
          role: 'system',
          content: `Recent chat context (last ${Math.min(6, hist.data.length)} turns):\n${histText}`
        });
      }
    }
    
    const maxSteps = 10; // Increased from 5 to 7
    let hasMadeChanges = false; // Flag to track if any action tool was used

    for (let step = 0; step < maxSteps; step++) {
      let completion;
      if (model === 'grok-4') {
        const grokClient = new OpenAI({
          apiKey: process.env.GROK_API_KEY,
          baseURL: "https://api.x.ai/v1",
          timeout: 360000, // 6 minute timeout for reasoning models
        });

        completion = await grokClient.chat.completions.create({
          model: model,
          messages: currentMessages,
          tools: toolDefinitions,
          tool_choice: "auto"
        });
      } else {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        completion = await openai.chat.completions.create({
          model: model,
          messages: currentMessages,
          tools: toolDefinitions,
          tool_choice: "auto"
        });
      }

      const message = completion.choices[0].message;

      if (!message.tool_calls) {
        // AI is done, save the final state if changes were made
        if (hasMadeChanges) {
            const finalSections = sectionModel.getState().sections;

            // --- Step 3a: Prune future edits before saving the new one --- (this is for knowing what is next for undo/redo)
            const { error: pruneError } = await supabaseAdmin.rpc('prune_future_edits', { p_report_id: reportId });
            if (pruneError) {
                console.error('Failed to prune future edits before final save:', pruneError);
                throw pruneError; // Stop the process if pruning fails
            }

            // --- Step 3b: Perform one final, atomic save ---
            const { error: updateError } = await supabaseAdmin 
              .from('reports')
              .update({ sections_json: { sections: finalSections } })
              .eq('id', reportId);
            
            if (updateError) throw updateError;
            
            // --- Cache Invalidation Step ---
            revalidateTag(`report:${reportId}`);
            console.log(`[Cache] Revalidated tag for report: ${reportId}`);

            return NextResponse.json({
              message: message.content,
              updatedSections: finalSections, // Let the client know a refresh is needed
            });
        } else {
            // No changes were made, just return the message
            return NextResponse.json({
              message: message.content, 
              updatedSections: null, // No refresh needed
            });
        }
      }

      currentMessages.push(message);

      for (const call of message.tool_calls) {
        if (sectionTools.isActionTool(call.function.name)) {
            hasMadeChanges = true; // Set the flag, but don't prune here
        }
        
        const { name, arguments: rawArgs } = call.function;
        const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
        
        const handler = allToolHandlers[name];
        if (!handler) {
            throw new Error(`Tool ${name} not found`);
        }

        let result;
        try {
          result = await handler(args);
        } catch (error: any) {
          console.error(`[Tool Error] Exception in ${name}:`, error.message);
          result = { success: false, error: error.message };
        }
      
        let toolContent = '';
        if (result.success) {
          const data = result.data;
          if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
            toolContent = String(data);
          } else if (data && typeof data === 'object') {
            if ('message' in data && typeof data.message === 'string') {
              toolContent = data.message;
            } else if ('status' in data && typeof data.status === 'string') {
              toolContent = data.status;
            } else {
              toolContent = JSON.stringify(data, null, 2); // Pretty print for complex objects
            }
          } else {
            toolContent = "Operation successful, no data returned.";
          }
        } else {
            toolContent = `Error: ${result.error}`;
        }
        
        if (!result.success) {
          console.log(`[Tool Feedback] Sending corrective error to model: ${toolContent}`);
        }

        currentMessages.push({
          role: "tool",
          tool_call_id: call.id,
          content: toolContent,
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

**WHEN TO USE CHAT HISTORY:**
Call \`get_chat_history()\` when:
- The user refers to something from a previous conversation (e.g., "what we discussed before", "the change I mentioned earlier")
- You need clarification and the current message alone doesn't provide enough context
- The user is asking you to continue or modify work from previous messages
- You're asking a clarifying question but need to reference what the user was originally trying to accomplish

**CRITICAL RULE: USE IDs, NOT NUMBERS**
Section numbers (e.g., "1", "2.1") are for display only and can change. You **MUST NOT** use them as IDs in your tool calls.
If a user refers to a section number, your workflow **MUST** be:
1. Call \`get_id_by_display_number({ "number": "1.4" })\` to get the section's stable UUID.
2. Use that UUID in any subsequent action tool (e.g., \`update_section\`).

**NOTE:** \`get_report_slices()\` is still available for broad searches or fetching multiple sections, but for targeted operations based on a display number, \`get_id_by_display_number\` is mandatory.

**EXAMPLE WORKFLOW:**
User says: "Change the title of section 2 to 'New Title'"
Your response MUST be a sequence of two tool calls:
1. First, call \`get_id_by_display_number({ "number": "2" })\` to get the ID for section number "2".
2. Then, use that ID to call \`update_section({ "id": "the-real-uuid-you-found", "title": "New Title" })\`.

**IMAGE REFERENCE SYSTEM:**
- Images are displayed to users with sequential dummy numbers (Image 1, Image 2, Image 3, etc.)
- These numbers are independent of database IDs and are calculated by frontend traversal order
- When users refer to images by number, use \`get_image_map()\` to understand which actual images they mean

**IMAGE OPERATIONS:**
- For **image swaps**: Use \`swap_photos(imageNumber1, imageNumber2)\` - handles both text and image swapping automatically
- For **multiple swaps**: Call \`swap_photos\` multiple times (each swap is a fast, atomic operation)
- For **image content updates**: Use \`batch_update_sections\` with \`images\` field to update image references
- \`swap_photos\` is optimized for single swaps and handles all the complexity internally

**OTHER RULES:**
1.  **BE LAZY:** Do not fetch context you don't need. Use the narrowest tool possible.
2.  **USE BATCH FOR EFFICIENCY:** If a user's request requires more than two distinct changes (e.g., updating three sections, adding two and deleting one), you **MUST** use the \`batch_update_sections\` tool. This is much faster and more efficient. For one or two changes, use the single-action tools.
3.  **SEARCH FOR SPECS:** Use \`search_project_specs\` ONLY for questions about technical requirements, codes, or standards.`;
}