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
  onChatComplete?: (updatedSections: Section[]) => void
): StructuredChatState => {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatMessage, setChatMessage] = useState('');
  const [selectedModel, setSelectedModel] = useState('grok-4'); // Default model
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
    if (!project?.id || isInitialized || hasInitializedRef.current || isLoadingHistory) return;

    setIsSendingMessage(true);
    try {
      hasInitializedRef.current = true;
      const existingMessages = chatMessages.length > 0;
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userMessage: existingMessages ? 
              'Silent initialization - do not generate welcome message' :
              'This is your first message to the user. Greet the user and briefly introduce yourself as an AI assistant for editing this report. Keep your response to a single, friendly paragraph.',
          reportId: reportId,
          projectId: project.id
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Save the initialization message if we got one
        if (data.message && !existingMessages) {
          const { data: savedMessage, error: assistantMsgError } = await supabase
            .from('chat_messages')
            .insert({
              report_id: reportId,
              content: data.message,
              role: 'assistant'
            })
            .select()
            .single();

          if (assistantMsgError) {
            console.error('Error saving initialization message:', assistantMsgError);
          } else if (savedMessage) {
            setChatMessages(prev => [...prev, savedMessage as ChatMessage]);
          }
        }
        
        // IMPORTANT: The backend now manages state. We need to trigger a refresh on the frontend.
        // For now, we assume another mechanism (like the operations hook) will handle this.
        if(data.updatedSections) {
            console.log("Received updated sections from init, calling onChatComplete.");
            onChatComplete?.(data.updatedSections);
        }

        setIsInitialized(true);
      }
    } catch (error) {
      console.error('Error initializing chat:', error);
    } finally {
      setIsSendingMessage(false);
    }
  }, [project?.id, isInitialized, chatMessages.length, reportId, isLoadingHistory, onChatComplete]);

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
      
      // Call the new stateless API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userMessage: currentMessage,
          reportId: reportId,
          projectId: project.id,
          model: selectedModel, // Pass the selected model to the API
        }),
      });
      
      if (!response.ok) {
        console.error('API error:', response.status);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Save assistant message
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
      
      // IMPORTANT: The backend now manages state. We need to trigger a refresh on the frontend.
      // This is a key part of the new architecture. We are no longer returning sections.
      // We assume another hook will listen for database changes and update the UI.
      if (data.updatedSections) {
        console.log("Received updated sections, calling onChatComplete to refresh UI.");
        onChatComplete?.(data.updatedSections);
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
  }, [chatMessage, user, reportId, project?.id, onChatComplete, selectedModel]);

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
