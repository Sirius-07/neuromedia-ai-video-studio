export type TabId = 'discussion' | 'activity' | 'tasks';

export type MemberRole = 'director' | 'editor' | 'designer' | 'writer';
export type TaskStatus = 'todo' | 'inProgress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ActivityType =
  | 'edit'
  | 'comment'
  | 'upload'
  | 'approve'
  | 'task'
  | 'join'
  | 'version';

export type SystemEventType =
  | 'version_saved'
  | 'member_joined'
  | 'asset_uploaded'
  | 'task_completed'
  | 'milestone';

export interface Member {
  id: string;
  name: string;
  initials: string;
  color1: string;
  color2: string;
  isOnline: boolean;
  role: MemberRole;
  roleLabel: string;
}

export interface Reaction {
  emoji: string;
  count: number;
  reacted?: boolean;
}

// ── Chat message types ────────────────────────────────────────────────────────

export interface UserChatMessage {
  id: string;
  type: 'user';
  senderId: string;
  content: string;
  time: string;
  date?: string;
  reactions?: Reaction[];
}

export interface SystemChatMessage {
  id: string;
  type: 'system';
  systemType: SystemEventType;
  description: string;
  authorId?: string;
  target?: string;
  time: string;
  date?: string;
}

export type ChatMessage = UserChatMessage | SystemChatMessage;

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  authorId: string;
  description: string;
  target?: string;
  timestamp: string;
}

// ── Project Activity (rich activity stream) ───────────────────────────────────

export type ProjectActivityType =
  | 'script_update'
  | 'shot_added'
  | 'shot_deleted'
  | 'style_changed'
  | 'soundtrack_replaced'
  | 'storyboard_approved'
  | 'asset_uploaded'
  | 'member_comment';

export type ActivityPriority = 'high' | 'medium' | 'low';

/** 对应 StudioApp 中的工作流阶段 */
export type ProjectStage = 'script' | 'style' | 'storyboard' | 'editor';

export interface ProjectActivity {
  id: string;
  actionType: ProjectActivityType;
  title: string;
  summary: string;
  operatorId: string;
  relatedShotId?: string;
  timestamp: string;
  timeAgo: string;
  impactRoles: MemberRole[];
  priority: ActivityPriority;
  /** 该动态发生在哪个工作阶段 */
  stage?: ProjectStage;
}

export interface Task {
  id: string;
  title: string;
  assigneeId?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  tags?: string[];
}

// ── Todo item (rich todo list) ────────────────────────────────────────────────

export type TodoStatus = 'todo' | 'in_progress' | 'done';
export type TodoPriority = 'high' | 'medium' | 'low';

export interface TodoItem {
  id: string;
  title: string;
  description: string;
  assigneeId: string;
  status: TodoStatus;
  priority: TodoPriority;
  relatedShotId?: string;
  dueTime: string;
  tags?: string[];
}

// ── Shot Annotation ───────────────────────────────────────────────────────────

export type AnnotationStatus = 'open' | 'in_progress' | 'resolved';

export interface Annotation {
  id: string;
  shotId: string;
  authorId: string;
  content: string;
  time: string;
  status: AnnotationStatus;
  /** 批注气泡在缩略图上的位置（百分比，左上角为 0,0） */
  position: { x: number; y: number };
}
