
// 简单的内存任务存储
// 在生产环境中应该使用 Redis 或数据库
class ScriptTaskService {
  constructor() {
    this.tasks = new Map();
  }

  createTask(type = 'script_generation') {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const task = {
      id: taskId,
      type,
      status: 'pending', // pending, processing, completed, error
      progress: 0,
      step: 'initializing', // initializing, analyzing_assets, generating, parsing, completed
      details: '准备中...',
      subProgress: null, // { current, total, item }
      result: null,
      error: null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    this.tasks.set(taskId, task);
    return task;
  }

  getTask(taskId) {
    return this.tasks.get(taskId);
  }

  updateTask(taskId, updates) {
    const task = this.tasks.get(taskId);
    if (!task) return null;
    
    const updatedTask = {
      ...task,
      ...updates,
      updatedAt: Date.now()
    };
    
    this.tasks.set(taskId, updatedTask);
    return updatedTask;
  }

  completeTask(taskId, result) {
    return this.updateTask(taskId, {
      status: 'completed',
      progress: 100,
      step: 'completed',
      details: '生成完成',
      result
    });
  }

  failTask(taskId, error) {
    return this.updateTask(taskId, {
      status: 'error',
      step: 'error',
      details: '生成失败',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

// 单例模式
export default new ScriptTaskService();






