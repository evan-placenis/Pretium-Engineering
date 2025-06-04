import { useState, useEffect, useRef } from 'react';
import { supabase, ChatMessage, Project, Report } from '@/lib/supabase';

export interface ChatState {
  chatMessages: ChatMessage[];
  chatMessage: string;
  isSendingMessage: boolean;
  setChatMessage: (message: string) => void;
  sendChatMessage: () => Promise<string | null>;
  chatContainerRef: React.RefObject<HTMLDivElement>;
}

export const useChatMessages = (
  reportId: string,
  content: string,
  project: Project | null,
  report: Report | null,
  user: any
): ChatState => {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatMessage, setChatMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

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

  const sendChatMessage = async () => {
    if (!chatMessage.trim() || !user || !reportId) return;
    
    setIsSendingMessage(true);
    
    try {
      // Save user message
      const { error: userMsgError } = await supabase
        .from('chat_messages')
        .insert({
          report_id: reportId,
          content: chatMessage,
          role: 'user'
        });
      
      if (userMsgError) throw userMsgError;
      
      // Clear input
      setChatMessage('');
      
      // Call API to get AI response
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportId,
          message: chatMessage,
          reportContent: content,
          projectName: project?.project_name,
          bulletPoints: report?.bullet_points
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to get chat response');
      }
      
      const data = await response.json();
      
      // Save assistant message
      const { error: assistantMsgError } = await supabase
        .from('chat_messages')
        .insert({
          report_id: reportId,
          content: data.message,
          role: 'assistant'
        });
      
      if (assistantMsgError) throw assistantMsgError;
      
      // Return updated content if there's a suggestion
      return data.updatedContent || null;
    } catch (error: any) {
      console.error('Error in chat:', error);
      throw error;
    } finally {
      setIsSendingMessage(false);
    }
  };

  return {
    chatMessages,
    chatMessage,
    isSendingMessage,
    setChatMessage,
    sendChatMessage,
    chatContainerRef
  };
}; 