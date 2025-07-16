import { useState, useEffect, useRef, useCallback } from 'react';
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
  canRevert: boolean;
  setChatMessage: (message: string) => void;
  sendChatMessage: () => Promise<string | null>;
  revertLastChange: () => Promise<string | null>;
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
  const [canRevert, setCanRevert] = useState(false);
  const [previousContent, setPreviousContent] = useState<string>('');
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const lastMessageTime = useRef<number>(0);

  // Helper function to process updated content (full report, section updates, or removals)
  const processUpdatedContent = (fullContent: string | null, partialContent: string[] | null, removeContent: string[] | null, currentContent: string): string => {
    // Check if this is a removal operation
    if (removeContent && removeContent.length > 0) {
      console.log('🗑️ Processing removal for sections:', removeContent.length, 'sections');
      
      let updatedContent = currentContent;
      let allSectionsFound = true;
      
      // Loop through each section to remove
      for (const sectionName of removeContent) {
        console.log('Processing removal of section:', sectionName);
        
        // Handle different section formats (numbered like "1.2" or named like "GENERAL")
        let sectionRegex;
        if (/^\d+\.\d+$/.test(sectionName)) {
          // Numbered section like "1.2" - remove the entire section including the header
          sectionRegex = new RegExp(`\\n?${sectionName}\\s*[\\s\\S]*?(?=\\n\\d+\\.\\d+|\\n[A-Z][A-Z\\s]+:|$)`, 'i');
        } else {
          // Named section like "GENERAL" - remove the entire section including the header
          sectionRegex = new RegExp(`\\n?${sectionName}:\\s*[\\s\\S]*?(?=\\n[A-Z][A-Z\\s]+:|$)`, 'i');
        }
        
        const match = updatedContent.match(sectionRegex);
        
        if (match) {
          updatedContent = updatedContent.replace(sectionRegex, '');
          console.log('✅ Section removed successfully:', sectionName);
        } else {
          console.log('⚠️ Section not found for removal:', sectionName);
          allSectionsFound = false;
        }
      }
      
      if (allSectionsFound) {
        console.log('✅ All sections removed successfully');
        
        // Validation: Check if removal resulted in too little content
        const originalLength = currentContent.trim().length;
        const updatedLength = updatedContent.trim().length;
        const removalPercentage = ((originalLength - updatedLength) / originalLength) * 100;
        
        console.log(`Content length: ${originalLength} → ${updatedLength} (${removalPercentage.toFixed(1)}% removed)`);
        
        // If we removed more than 90% of the content or less than 200 characters remain, something went wrong
        if (updatedLength < 200 || removalPercentage > 90) {
          console.log('⚠️ Removal resulted in too little content, this seems wrong. Falling back to original content.');
          console.log('Updated content preview:', updatedContent.substring(0, 200));
          return fullContent || currentContent;
        }
        
        return updatedContent;
      } else {
        console.log('⚠️ Some sections not found for removal, returning full content');
        console.log('Available sections in content:', currentContent.match(/(\d+\.\d+|[A-Z][A-Z\s]+:)/g));
        return fullContent || currentContent;
      }
    }
    
    // Check if this is a partial update (section update)
    if (partialContent && partialContent.length > 0) {
      console.log('🔧 Processing partial update for sections:', partialContent.length, 'sections');
      
      let updatedContent = currentContent;
      let allSectionsFound = true;
      
      // Loop through each section update
      for (const sectionUpdate of partialContent) {
        // Extract section name from the update (everything before the first space or colon)
        const sectionMatch = sectionUpdate.match(/^([^:\s]+)/);
        if (!sectionMatch) {
          console.log('⚠️ Could not extract section name from:', sectionUpdate);
          allSectionsFound = false;
          continue;
        }
        
        const sectionName = sectionMatch[1];
        const sectionContent = sectionUpdate.substring(sectionMatch[0].length).replace(/^[:\s]+/, '');
        
        console.log('Processing section:', sectionName);
        console.log('Section content length:', sectionContent.length);
        
        // Handle different section formats (numbered like "1.2" or named like "GENERAL")
        let sectionRegex;
        if (/^\d+\.\d+$/.test(sectionName)) {
          // Numbered section like "1.2"
          sectionRegex = new RegExp(`(${sectionName}\\s*)([\\s\\S]*?)(?=\\n\\d+\\.\\d+|\\n[A-Z][A-Z\\s]+:|$)`, 'i');
        } else {
          // Named section like "GENERAL"
          sectionRegex = new RegExp(`(${sectionName}:\\s*)([\\s\\S]*?)(?=\\n[A-Z][A-Z\\s]+:|$)`, 'i');
        }
        
        const match = updatedContent.match(sectionRegex);
        
        if (match) {
          updatedContent = updatedContent.replace(sectionRegex, `$1${sectionContent}`);
          console.log('✅ Section updated successfully:', sectionName);
        } else {
          console.log('⚠️ Section not found:', sectionName);
          allSectionsFound = false;
        }
      }
      
      if (allSectionsFound) {
        console.log('✅ All sections updated successfully');
        return updatedContent;
      } else {
        console.log('⚠️ Some sections not found, returning full content');
        console.log('Available sections in content:', currentContent.match(/(\d+\.\d+|[A-Z][A-Z\s]+:)/g));
        return fullContent || currentContent;
      }
    } else if (fullContent) {
      // This is a full report update
      console.log('📄 Processing full report update');
      return fullContent;
    } else {
      // No updates
      console.log('💬 No content updates');
      return currentContent;
    }
  };

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
    if (!project?.id || isInitialized) return;

    try {
      console.log('Initializing enhanced chat...');
      
      // Check if there are existing chat messages first
      if (chatMessages.length > 0) {
        console.log('Chat history exists, skipping welcome message but still initializing agent');
        
        // Initialize agent without generating a welcome message
        const response = await fetch('/api/enhanced-chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reportId,
            message: 'Silent initialization - do not generate welcome message',
            reportContent: content || 'Report generation in progress...',
            projectName: project?.project_name,
            bulletPoints: report?.bullet_points,
            images: [],
            projectId: project?.id,
            isInitialLoad: true,
            conversationHistory: chatMessages.map(msg => ({
              role: msg.role,
              content: msg.content
            }))
          }),
        });
        
        if (response.ok) {
          console.log('Agent initialized silently (no welcome message)');
        }
        
        setIsInitialized(true);
        return;
      }
      
      // Send an initialization message to set up the system prompt with welcome message
      const response = await fetch('/api/enhanced-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportId,
          message: 'Initialize chat assistant',
          reportContent: content || 'Report generation in progress...',
          projectName: project?.project_name,
          bulletPoints: report?.bullet_points,
          images: [],
          projectId: project?.id,
          isInitialLoad: true,
          conversationHistory: []
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Initialization response:', data);
        
        // Save the initialization message to database and display it
        if (data.message) {
          console.log('Saving initialization message:', data.message);
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
            console.log('Initialization message saved successfully');
            // Add the initialization message to local state
            setChatMessages(prev => [...prev, savedMessage as ChatMessage]);
          }
        } else {
          console.warn('No message in initialization response');
        }
        
        setIsInitialized(true);
        console.log('Enhanced chat initialized successfully');
      } else {
        console.error('Initialization failed:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error initializing chat:', error);
    }
  }, [project?.id, isInitialized, reportId, content, project?.project_name, report?.bullet_points, chatMessages.length]);

  // Search embeddings for relevant project knowledge
  const searchEmbeddings = useCallback(async (query: string): Promise<void> => {
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
  }, [project?.id]);

  const toggleEmbeddingResults = useCallback(() => {
    setShowEmbeddingResults(prev => !prev);
  }, []);

  const revertLastChange = useCallback(async (): Promise<string | null> => {
    if (!previousContent) return null;
    
    try {
      console.log('🔄 Reverting to previous content');
      
      // Save the revert action to chat
      const revertMessage = "I've reverted the last change as requested.";
      const { data: savedMessage, error: assistantMsgError } = await supabase
        .from('chat_messages')
        .insert({
          report_id: reportId,
          content: revertMessage,
          role: 'assistant'
        })
        .select()
        .single();
      
      if (assistantMsgError) throw assistantMsgError;
      
      // Add the revert message to local state
      if (savedMessage) {
        setChatMessages(prev => [...prev, savedMessage as ChatMessage]);
      }
      
      // Return the previous content to update the report
      setCanRevert(false);
      return previousContent;
    } catch (error) {
      console.error('Error reverting change:', error);
      return null;
    }
  }, [previousContent, reportId]);

  const sendChatMessage = useCallback(async (): Promise<string | null> => {
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
      
      // Prepare conversation history for the API with intelligent limiting
      let conversationHistory = chatMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      // If conversation is getting long, keep only recent messages
      if (conversationHistory.length > 20) {
        console.log('Conversation history is long, keeping only recent messages');
        conversationHistory = conversationHistory.slice(-20); // Keep last 20 messages
      }

      // IMAGE PROCESSING TEMPORARILY DISABLED - Images consume too many tokens
      /*
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
        
        // Reduce image count if conversation is long to prevent token overflow
        if (conversationHistory.length > 10) {
          const maxImages = Math.max(3, 10 - Math.floor(conversationHistory.length / 5));
          if (processedImages.length > maxImages) {
            console.log(`Reducing images from ${processedImages.length} to ${maxImages} due to long conversation`);
            processedImages = processedImages.slice(0, maxImages);
          }
        }
      }
      */
      
      // No images sent to reduce token usage - only report content is provided
      const processedImages: ReportImage[] = [];
      const isAskingAboutImages = false; // Disabled for now

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
        if (response.status === 429) {
          if (errorData.type === 'token_limit') {
            // Token limit error - don't retry, just show helpful message
            const tokenLimitMessage = `${errorData.error} ${errorData.suggestion || ''}`;
            setChatMessages(prev => [...prev, {
              id: Date.now().toString(),
              report_id: reportId,
              content: tokenLimitMessage,
              role: 'assistant',
              created_at: new Date().toISOString()
            } as ChatMessage]);
            return null;
          } else if (errorData.type === 'rate_limit') {
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
            
            // Log the distinction between chat message and report update
            if (data.message) {
              console.log('📝 Chat message to display (retry):', data.message.substring(0, 100) + '...');
            }
            if (data.updatedContent) {
              console.log('📄 Report update received (retry) - length:', data.updatedContent.length);
              console.log('📄 Report update preview (retry):', data.updatedContent.substring(0, 200) + '...');
            } else {
              console.log('💬 No report update (retry) - this was just a chat response');
            }
            
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
            
            // Process updated content - handle both full updates and section updates
            if (data.fullUpdatedContent || data.partialUpdatedContent || data.removeContent) {
              // Save current content as previous content before making changes
              setPreviousContent(content);
              setCanRevert(true);
              
              const processedContent = processUpdatedContent(data.fullUpdatedContent, data.partialUpdatedContent, data.removeContent, content);
              return processedContent;
            }
            return null;
          }
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
      
      // Log the distinction between chat message and report update
      if (data.message) {
        console.log('📝 Chat message to display:', data.message.substring(0, 100) + '...');
      }
      if (data.updatedContent) {
        console.log('📄 Report update received - length:', data.updatedContent.length);
        console.log('📄 Report update preview:', data.updatedContent.substring(0, 200) + '...');
      } else {
        console.log('💬 No report update - this was just a chat response');
      }
      
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
      
      // Process updated content - handle both full updates and section updates
      if (data.fullUpdatedContent || data.partialUpdatedContent || data.removeContent) {
        // Save current content as previous content before making changes
        setPreviousContent(content);
        setCanRevert(true);
        
        const processedContent = processUpdatedContent(data.fullUpdatedContent, data.partialUpdatedContent, data.removeContent, content);
        return processedContent;
      }
      return null;
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
  }, [chatMessage, user, reportId, chatMessages, content, project?.project_name, report?.bullet_points, reportImages]);

  return {
    chatMessages,
    chatMessage,
    isSendingMessage,
    isSearchingEmbeddings,
    embeddingResults,
    showEmbeddingResults,
    isInitialized,
    canRevert,
    setChatMessage,
    sendChatMessage,
    revertLastChange,
    searchEmbeddings,
    toggleEmbeddingResults,
    initializeChat,
    chatContainerRef
  };
}; 