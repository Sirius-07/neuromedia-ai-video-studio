import React from 'react';
import { TodoList } from './TodoList';

interface TasksTabProps {
  onFocusShot?: (shotId: string) => void;
}

export const TasksTab: React.FC<TasksTabProps> = ({ onFocusShot }) => {
  return <TodoList onFocusShot={onFocusShot} />;
};
