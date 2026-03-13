import React, { RefObject } from 'react';
import { MessageList } from './MessageList';
import type { ChatMessage } from './types';

interface DiscussionTabProps {
  messages: ChatMessage[];
  currentUserId: string;
  onReaction: (messageId: string, emoji: string) => void;
  scrollRef: RefObject<HTMLDivElement | null>;
}

export const DiscussionTab: React.FC<DiscussionTabProps> = ({
  messages,
  currentUserId,
  onReaction,
  scrollRef,
}) => {
  return (
    <MessageList
      messages={messages}
      currentUserId={currentUserId}
      onReaction={onReaction}
      scrollRef={scrollRef}
    />
  );
};
