import { useState, useEffect, useRef } from 'react';
import { supabase, ChatMessage, Project, Report, ReportImage } from '@/lib/supabase';

export interface EmbeddingSearchResult {
  content: string;
  similarity: number;
  chunkIndex: number;
  knowledgeId: string;
  fileName?: string;
}

export interface EnhancedChatState {
  chatMessages: ChatMessage[];
  chatMessage: string;
  isSendingMessage: boolean;
  isSearchingEmbeddings: boolean;
  embeddingResults: EmbeddingSearchResult[];
  showEmbeddingResults: boolean;
  isInitialized: boolean;
  setChatMessage: (message: string) => void;
  sendChatMessage: () => Promise<string | null>;
  searchEmbeddings: (query: string) => Promise<void>;
  toggleEmbeddingResults: () => void;
  initializeChat: () => Promise<void>;
  chatContainerRef: React.RefObject<HTMLDivElement>;
}

export const useEnhancedChat = (
  reportId: string,
  content: string,
  project: Project | null,
  report: Report | null,
  user: any,
  reportImages: ReportImage[] = []
): EnhancedChatState => {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatMessage, setChatMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isSearchingEmbeddings, setIsSearchingEmbeddings] = useState(false);
  const [embeddingResults, setEmbeddingResults] = useState<EmbeddingSearchResult[]>([]);
  const [showEmbeddingResults, setShowEmbeddingResults] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const lastMessageTime = useRef<number>(0);

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
  const initializeChat = async (): Promise<void> => {
    if (!project?.id || isInitialized) return;

    try {
      console.log('Initializing enhanced chat...');
      
      // Send an initialization message to set up the system prompt
      const response = await fetch('/api/enhanced-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportId,
          message: 'Initialize chat assistant',
          reportContent: content,
          projectName: project?.project_name,
          bulletPoints: report?.bullet_points,
          images: [],
          projectId: project?.id,
          isInitialLoad: true,
          conversationHistory: []
        }),
      });

      if (response.ok) {
        setIsInitialized(true);
        console.log('Enhanced chat initialized successfully');
      }
    } catch (error) {
      console.error('Error initializing chat:', error);
    }
  };

  // Search embeddings for relevant project knowledge
  const searchEmbeddings = async (query: string): Promise<void> => {
    if (!project?.id || !query.trim()) {
      setEmbeddingResults([]);
      return;
    }

    setIsSearchingEmbeddings(true);
    try {
      const response = await fetch('/api/enhanced-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: project.id,
          searchKnowledgeBase: true,
          searchQuery: query
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.type === 'search_results') {
        setEmbeddingResults(data.results || []);
        console.log('Embedding search results:', data.results);
      }
    } catch (error) {
      console.error('Error searching embeddings:', error);
      setEmbeddingResults([]);
    } finally {
      setIsSearchingEmbeddings(false);
    }
  };

  const toggleEmbeddingResults = () => {
    setShowEmbeddingResults(!showEmbeddingResults);
  };

  const sendChatMessage = async (): Promise<string | null> => {
    if (!chatMessage.trim() || !user || !reportId) return null;
    
    // Rate limiting: prevent sending messages too quickly
    const now = Date.now();
    const timeSinceLastMessage = now - lastMessageTime.current;
    const minInterval = 2000; // 2 seconds minimum between messages
    
    if (timeSinceLastMessage < minInterval) {
      const waitTime = minInterval - timeSinceLastMessage;
      console.log(`Rate limiting: waiting ${waitTime}ms before sending message`);
      
      // Show rate limit message to user
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
      // Store current message for API call
      const currentMessage = chatMessage;
      
      // Clear input immediately to provide better UX
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
      
      // Immediately add the user message to local state
      if (savedUserMessage) {
        setChatMessages(prev => [...prev, savedUserMessage as ChatMessage]);
      }
      
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

      // Prepare conversation history for the API
      const conversationHistory = chatMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      console.log('Sending enhanced chat request with:', {
        reportId,
        message: currentMessage,
        reportContent: content,
        projectName: project?.project_name,
        bulletPoints: report?.bullet_points,
        isAskingAboutImages,
        imagesCount: processedImages.length,
        totalImagesAvailable: reportImages.length,
        conversationLength: conversationHistory.length
      });
      
      // Call enhanced API to get AI response with embeddings
      const response = await fetch('/api/enhanced-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportId,
          message: currentMessage,
          reportContent: content,
          projectName: project?.project_name,
          bulletPoints: report?.bullet_points,
          images: processedImages,
          projectId: project?.id,
          conversationHistory: conversationHistory,
          isInitialLoad: false
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Handle rate limit errors with retry logic
        if (response.status === 429 && errorData.type === 'rate_limit') {
          const retryAfter = errorData.retryAfter || 60;
          console.log(`Rate limit hit, waiting ${retryAfter} seconds before retry...`);
          
          // Show rate limit message to user
          const rateLimitMessage = `Rate limit reached. Waiting ${retryAfter} seconds before retrying...`;
          setChatMessages(prev => [...prev, {
            id: Date.now().toString(),
            report_id: reportId,
            content: rateLimitMessage,
            role: 'assistant',
            created_at: new Date().toISOString()
          } as ChatMessage]);
          
          // Wait for the specified time
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          
          // Retry the request once
          console.log('Retrying request after rate limit wait...');
          const retryResponse = await fetch('/api/enhanced-chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              reportId,
              message: currentMessage,
              reportContent: content,
              projectName: project?.project_name,
              bulletPoints: report?.bullet_points,
              images: processedImages,
              projectId: project?.id,
              conversationHistory: conversationHistory,
              isInitialLoad: false
            }),
          });
          
          if (!retryResponse.ok) {
            const retryErrorData = await retryResponse.json().catch(() => ({}));
            throw new Error(retryErrorData.error || `HTTP error! status: ${retryResponse.status}`);
          }
          
          // Use the retry response
          const data = await retryResponse.json();
          console.log('Received enhanced chat response after retry:', { 
            type: data.type,
            hasMessage: !!data.message, 
            hasUpdatedContent: !!data.updatedContent,
            hasEmbeddingResults: !!data.embeddingResults
          });
          
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
          
          // Immediately add the assistant message to local state
          if (savedMessage) {
            setChatMessages(prev => [...prev, savedMessage as ChatMessage]);
          }
          
          // Update embedding results if provided
          if (data.embeddingResults) {
            setEmbeddingResults(data.embeddingResults);
            setShowEmbeddingResults(true);
          }
          
          // Return updated content if there's a suggestion
          return data.updatedContent || null;
        }
        
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Received enhanced chat response:', { 
        type: data.type,
        hasMessage: !!data.message, 
        hasUpdatedContent: !!data.updatedContent,
        hasEmbeddingResults: !!data.embeddingResults
      });
      
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
      
      // Immediately add the assistant message to local state
      if (savedMessage) {
        setChatMessages(prev => [...prev, savedMessage as ChatMessage]);
      }
      
      // Update embedding results if provided
      if (data.embeddingResults) {
        setEmbeddingResults(data.embeddingResults);
        setShowEmbeddingResults(true);
      }
      
      // Return updated content if there's a suggestion
      return data.updatedContent || null;
    } catch (error: any) {
      console.error('Error in enhanced chat:', error);
      
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
          
        // Add error message to local state
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
    }
  };

  return {
    chatMessages,
    chatMessage,
    isSendingMessage,
    isSearchingEmbeddings,
    embeddingResults,
    showEmbeddingResults,
    isInitialized,
    setChatMessage,
    sendChatMessage,
    searchEmbeddings,
    toggleEmbeddingResults,
    initializeChat,
    chatContainerRef
  };
}; 