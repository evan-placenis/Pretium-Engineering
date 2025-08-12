import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, ChatMessage, Project, Report } from '@/lib/supabase';

export interface StructuredChatState {
  chatMessages: ChatMessage[];
  chatMessage: string;
  isSendingMessage: boolean;
  isInitialized: boolean;
  setChatMessage: (message: string) => void;
  sendChatMessage: () => Promise<string | null>;
  initializeChat: () => Promise<void>;
  chatContainerRef: React.RefObject<HTMLDivElement>;
  syncFromMarkdown?: (markdown: string) => Promise<void>;
}

export const useStructuredChat = (
  reportId: string,
  content: string,
  project: Project | null,
  report: Report | null,
  user: any,
  syncFromMarkdown?: (markdown: string) => Promise<void>
): StructuredChatState => {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatMessage, setChatMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const lastMessageTime = useRef<number>(0);
  const hasInitializedRef = useRef<boolean>(false);

  // Fetch initial chat messages
  useEffect(() => {
    const fetchChatMessages = async () => {
      if (!reportId) return;

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
    if (!project?.id || isInitialized || hasInitializedRef.current) return;

    try {
      hasInitializedRef.current = true;
      // Check if there are existing chat messages first
      const existingMessages = chatMessages.length > 0;
      
      // Send an initialization message
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: existingMessages ? 
              'Silent initialization - do not generate welcome message' :
              'Initialize chat assistant'
          }],
          reportMarkdown: content || 'Report generation in progress...'
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
        setIsInitialized(true);
      }
    } catch (error) {
      console.error('Error initializing chat:', error);
    }
  }, [project?.id, isInitialized, chatMessages.length, content, reportId]);

  const sendChatMessage = useCallback(async (): Promise<string | null> => {
    if (!chatMessage.trim() || !user || !reportId) return null;
    
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
      
      return null;
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
      
      // Prepare conversation history
      let conversationHistory = chatMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      // Keep only recent messages if conversation is long
      if (conversationHistory.length > 20) {
        conversationHistory = conversationHistory.slice(-20);
      }

      // Add the current message
      conversationHistory.push({
        role: 'user',
        content: currentMessage
      });

      // Call structured chat API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: conversationHistory,
          reportMarkdown: content
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
      
      // Return updated markdown if provided
      if (data.updatedMarkdown && data.updatedMarkdown !== content) {
        console.log('Updated markdown:', data.updatedMarkdown.slice(0, 100) + '...');
        if (syncFromMarkdown) await syncFromMarkdown(data.updatedMarkdown);
        return data.updatedMarkdown;
      }
      
      return null;
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
      
      return null;
    } finally {
      setIsSendingMessage(false);
      console.log('sendChatMessage completed');
    }
  }, [chatMessage, user, reportId, chatMessages, content, syncFromMarkdown]);

  return {
    chatMessages,
    chatMessage,
    isSendingMessage,
    isInitialized,
    setChatMessage,
    sendChatMessage,
    initializeChat,
    chatContainerRef,
    syncFromMarkdown
  };
};
