import React from 'react';
import { ActivityList } from './ActivityList';
import type { ProjectActivity, ProjectStage } from './types';

interface ActivityTabProps {
  activities: ProjectActivity[];
  latestActivityId: string | null;
  onFocusShot?: (shotId: string) => void;
  currentStage?: ProjectStage;
}

export const ActivityTab: React.FC<ActivityTabProps> = ({ activities, latestActivityId, onFocusShot, currentStage }) => {
  return (
    <ActivityList
      activities={activities}
      latestActivityId={latestActivityId}
      onFocusShot={onFocusShot}
      currentStage={currentStage}
    />
  );
};
