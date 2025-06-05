import { useState, useEffect, useRef } from 'react';
import { supabase, ChatMessage, Project, Report, ReportImage } from '@/lib/supabase';

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
  user: any,
  reportImages: ReportImage[] = []
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

  const sendChatMessage = async (): Promise<string | null> => {
    if (!chatMessage.trim() || !user || !reportId) return null;
    
    setIsSendingMessage(true);
    
    try {
      // Store current message for API call
      const currentMessage = chatMessage;
      
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
      
      // Immediately add the user message to local state
      if (savedUserMessage) {
        setChatMessages(prev => [...prev, savedUserMessage as ChatMessage]);
      }
      
              // Clear input immediately
        setChatMessage('');
      
      // Check if the user is asking about visual content
      const imageKeywords = [
        'image', 'images', 'photo', 'photos', 'picture', 'pictures',
        'see', 'look', 'show', 'visual', 'visually', 'appearance',
        'deficiency', 'deficiencies', 'damage', 'condition',
        'site', 'area', 'section', 'view', 'overview'
      ];
      
      const isAskingAboutImages = imageKeywords.some(keyword => 
        currentMessage.toLowerCase().includes(keyword.toLowerCase())
      );

      let processedImages: ReportImage[] = [];
      
      if (isAskingAboutImages && reportImages.length > 0) {
        // Convert report images to public URLs if needed
        processedImages = reportImages.map(img => {
          // If the URL is already a full URL, use it as is
          if (img.url.startsWith('http://') || img.url.startsWith('https://')) {
            return img;
          }
          
          // Otherwise, get the public URL from Supabase storage
          const { data: { publicUrl } } = supabase.storage
            .from('reports-images')
            .getPublicUrl(img.url);
            
          return {
            ...img,
            url: publicUrl
          };
        });
      }

      console.log('Sending chat request with:', {
        reportId,
        message: currentMessage,
        reportContent: content,
        projectName: project?.project_name,
        bulletPoints: report?.bullet_points,
        isAskingAboutImages,
        imagesCount: processedImages.length,
        totalImagesAvailable: reportImages.length
      });
      
      // Call API to get AI response with current report content and images
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportId,
          message: currentMessage,
          reportContent: content, // Pass current report content directly
          projectName: project?.project_name,
          bulletPoints: report?.bullet_points,
          images: processedImages // Pass current images with public URLs
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Received chat response:', { hasMessage: !!data.message, hasUpdatedContent: !!data.updatedContent });
      
      // Save assistant message
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
      
      // Immediately add the assistant message to local state to avoid waiting for real-time subscription
      if (savedMessage) {
        setChatMessages(prev => [...prev, savedMessage as ChatMessage]);
      }
      
      // Return updated content if there's a suggestion
      return data.updatedContent || null;
    } catch (error: any) {
      console.error('Error in chat:', error);
      
      // Re-add the message to input if there was an error
      setChatMessage(chatMessage);
      
      // Save error message to chat
      try {
        await supabase
          .from('chat_messages')
          .insert({
            report_id: reportId,
            content: `Error: ${error.message || 'Failed to process your request. Please try again.'}`,
            role: 'assistant'
          });
      } catch (dbError) {
        console.error('Error saving error message:', dbError);
      }
      
      return null;
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