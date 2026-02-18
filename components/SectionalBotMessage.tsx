
import React, { useMemo } from 'react';
import { Message } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import { parseMarkdownSections } from '../utils/sectionParser';
import { useAuth } from '../contexts/AuthContext';
import { ChatMode } from '../constants';
import SmartOptions, { parseSmartOptions } from './SmartOptions';

interface SectionalBotMessageProps {
  message: Message;
  sessionId?: string;
  userId?: string;
  isDarkMode: boolean;
  mode?: ChatMode; 
  onSendMessage?: (text: string) => void; // New prop for handling smart option clicks
}

const SectionalBotMessage: React.FC<SectionalBotMessageProps> = ({
  message,
  sessionId = "preview_session",
  userId,
  isDarkMode,
  mode = 'diretoria',
  onSendMessage
}) => {
  const content = message.text || "";
  const { user } = useAuth();

  // 1. Parse Smart Options first
  const { cleanText, options } = useMemo(() => parseSmartOptions(content), [content]);

  // 2. Parse Markdown Sections from the cleaned text
  const sections = useMemo(() => parseMarkdownSections(cleanText), [cleanText]);

  // If simple message (no sections) or short content
  if (sections.length <= 1 && !cleanText.includes('##')) {
     return (
       <div className="flex flex-col gap-2">
         <MarkdownRenderer 
            content={cleanText} 
            isDarkMode={isDarkMode} 
            groundingSources={message.groundingSources} // Pass sources here
         />
         {options.length > 0 && onSendMessage && (
            <SmartOptions 
              options={options} 
              onSelect={onSendMessage} 
            />
         )}
       </div>
     );
  }

  return (
    <div className="sectional-message space-y-4">
      {sections.map((section) => (
        <div key={section.key} className="section-block group relative">
          
          <div className="section-content">
             <MarkdownRenderer 
                content={section.key === 'intro' ? section.content : `${'#'.repeat(section.level)} ${section.title}\n\n${section.content}`} 
                isDarkMode={isDarkMode}
                groundingSources={message.groundingSources} // Pass sources here too
             />
          </div>
        </div>
      ))}

      {/* Render Smart Options at the end if they exist */}
      {options.length > 0 && onSendMessage && (
        <div className="pt-2 border-t border-dashed border-gray-500/20 mt-4">
           <SmartOptions 
              options={options} 
              onSelect={onSendMessage} 
           />
        </div>
      )}
    </div>
  );
};

export default SectionalBotMessage;
