import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, ChatMessage, Project, Report } from '@/lib/supabase';
import { Section } from '@/lib/jsonTreeModels/types/section';

export interface StructuredChatState {
  chatMessages: ChatMessage[];
  chatMessage: string;
  isSendingMessage: boolean;
  isInitialized: boolean;
  isLoadingHistory: boolean;
  selectedModel: string; // Add selectedModel to state
  setSelectedModel: (model: string) => void; // Add setter for selectedModel
  setChatMessage: (message: string) => void;
  sendChatMessage: () => Promise<void>;
  initializeChat: () => Promise<void>;
  chatContainerRef: React.RefObject<HTMLDivElement>;
}

export const useStructuredChat = (
  reportId: string,
  sections: Section[],
  project: Project | null,
  report: Report | null,
  user: any,
  signalEdit?: () => void // Replaced onChatComplete with signalEdit
): StructuredChatState => {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatMessage, setChatMessage] = useState('');
  const [selectedModel, setSelectedModel] = useState('gpt-4o'); // Default model
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const lastMessageTime = useRef<number>(0);
  const hasInitializedRef = useRef<boolean>(false);

  // Fetch initial chat messages
  useEffect(() => {
    const fetchChatMessages = async () => {
      if (!reportId) {
        setIsLoadingHistory(false);
        return;
      }

      try {
        const { data: chatData, error: chatError } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('report_id', reportId)
          .order('created_at', { ascending: true });

        if (chatError) {
          console.error('Error fetching chat messages:', chatError);
        } else {
          setChatMessages(chatData || []);
        }
      } catch (error) {
        console.error('Error fetching chat messages:', error);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    fetchChatMessages();
  }, [reportId]);

  // Set up real-time subscription for chat messages
  useEffect(() => {
    if (!reportId) return;

    const chatSubscription = supabase
      .channel(`report-chat-${reportId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'chat_messages',
        filter: `report_id=eq.${reportId}`
      }, (payload) => {
        setChatMessages(prev => [...prev, payload.new as ChatMessage]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(chatSubscription);
    };
  }, [reportId]);

  // Auto-scroll to bottom of chat when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Initialize chat with system prompt
  const initializeChat = useCallback(async (): Promise<void> => {
    // This function should only run ONCE, when the component is ready.
    if (!report || !project?.id || hasInitializedRef.current || isLoadingHistory) return;

    // Immediately mark as initialized to prevent re-runs
    hasInitializedRef.current = true;
    setIsSendingMessage(true);
    
    const initialize = async () => {
      let attempts = 0;
      const maxAttempts = 3;
      const retryDelay = 1000; // 1 second

      while (attempts < maxAttempts) {
        try {
          // Check for existing messages one time, right before we act.
          const { data: existingMessages, error } = await supabase
            .from('chat_messages')
            .select('id')
            .eq('report_id', reportId)
            .limit(1);

          if (error) {
            console.error("Failed to check for existing messages:", error);
            return; // Don't proceed if we can't check
          }

          const hasHistory = existingMessages && existingMessages.length > 0;

          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userMessage: hasHistory ? 
                  'Silent initialization - do not generate welcome message' :
                  'This is your first message to the user. Greet the user and briefly introduce yourself as an AI assistant for editing this report. Keep your response to a single, friendly paragraph.',
              reportId: reportId,
              projectId: project.id
            }),
          });

          if (response.ok) {
            const data = await response.json();
            
            // Save the initialization message if we got one
            if (data.message && !hasHistory) {
              const { data: savedMessage, error } = await supabase
                .from('chat_messages')
                .insert({
                  report_id: reportId,
                  content: data.message,
                  role: 'assistant'
                })
                .select()
                .single();

              if (error) {
                console.error("Failed to save welcome message:", error);
              } else if (savedMessage) {
                // Manually add the welcome message to the local state
                setChatMessages(prev => [...prev, savedMessage as ChatMessage]);
              }
            }
            
            if (data.updatedSections) {
                console.log("Initialization returned sections, but we will ignore them to prevent overwriting the report.");
            }

            setIsInitialized(true);
            return; // Success, exit the loop
          } else if (response.status === 404) {
            attempts++;
            console.warn(`[initializeChat] Attempt ${attempts} failed with 404. Retrying in ${retryDelay}ms...`);
            if (attempts >= maxAttempts) {
              throw new Error(`Failed to initialize chat after ${maxAttempts} attempts.`);
            }
            await new Promise(res => setTimeout(res, retryDelay));
          } else {
            // For other errors, fail immediately
            throw new Error(`API error: ${response.status} ${response.statusText}`);
          }
        } catch (error) {
          console.error('Error initializing chat:', error);
          return; // Exit loop on error
        }
      }
    };

    initialize().finally(() => {
      setIsSendingMessage(false);
    });

  }, [report, project?.id, reportId, isLoadingHistory]);

  const sendChatMessage = useCallback(async (): Promise<void> => {
    if (!chatMessage.trim() || !user || !reportId || !project?.id) return;
    
    // Rate limiting: prevent sending messages too quickly
    const now = Date.now();
    const timeSinceLastMessage = now - lastMessageTime.current;
    const minInterval = 2000; // 2 seconds minimum between messages
    
    if (timeSinceLastMessage < minInterval) {
      const waitTime = minInterval - timeSinceLastMessage;
      const rateLimitMessage = `Please wait ${Math.ceil(waitTime / 1000)} seconds before sending another message.`;
      setChatMessages(prev => [...prev, {
        id: Date.now().toString(),
        report_id: reportId,
        content: rateLimitMessage,
        role: 'assistant',
        created_at: new Date().toISOString()
      } as ChatMessage]);
      
      return;
    }
    
    lastMessageTime.current = now;
    setIsSendingMessage(true);
    
    try {
      const currentMessage = chatMessage;
      setChatMessage('');
      
      // Save user message
      const { data: savedUserMessage, error: userMsgError } = await supabase
        .from('chat_messages')
        .insert({
          report_id: reportId,
          content: currentMessage,
          role: 'user'
        })
        .select()
        .single();
      
      if (userMsgError) throw userMsgError;
      
      if (savedUserMessage) {
        setChatMessages(prev => [...prev, savedUserMessage as ChatMessage]);
      }
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: currentMessage,
          reportId: reportId,
          projectId: project.id,
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'API did not return valid JSON.' }));
        throw new Error(`API error: ${response.status} ${response.statusText} - ${errorData.error}`);
      }
      
      const data = await response.json();

      // Save the final assistant message
      if (data.message) {
        const { data: savedMessage, error: assistantMsgError } = await supabase
          .from('chat_messages')
          .insert({
            report_id: reportId,
            content: data.message,
            role: 'assistant'
          })
          .select()
          .single();
        
        if (assistantMsgError) throw assistantMsgError;
        
        if (savedMessage) {
          setChatMessages(prev => [...prev, savedMessage as ChatMessage]);
        }
      }

      // If the report was updated, signal the parent component to refresh
      if (data.updatedSections) {
        signalEdit?.();
      }

    } catch (error: any) {
      console.error('Error in chat:', error);
      
      // Save error message to chat
      try {
        const errorMessage = `Error: ${error.message || 'Failed to process your request. Please try again.'}`;
        
        await supabase
          .from('chat_messages')
          .insert({
            report_id: reportId,
            content: errorMessage,
            role: 'assistant'
          });
          
        setChatMessages(prev => [...prev, {
          id: Date.now().toString(),
          report_id: reportId,
          content: errorMessage,
          role: 'assistant',
          created_at: new Date().toISOString()
        } as ChatMessage]);
      } catch (dbError) {
        console.error('Error saving error message:', dbError);
      }
      
      return;
    } finally {
      setIsSendingMessage(false);
    }
  }, [chatMessage, user, reportId, project?.id, signalEdit, selectedModel]);

  return {
    chatMessages,
    chatMessage,
    isSendingMessage,
    isInitialized,
    isLoadingHistory,
    selectedModel,
    setSelectedModel,
    setChatMessage,
    sendChatMessage,
    initializeChat,
    chatContainerRef,
  };
};
