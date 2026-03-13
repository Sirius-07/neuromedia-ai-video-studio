/**
 * 任务队列管理器
 * 用于处理即梦AI的并发限制问题
 * 
 * 即梦AI的API有并发限制(code 50430)，同时只能处理一个任务
 * 这个队列管理器确保任务按顺序执行，避免并发冲突
 */

class TaskQueueManager {
  constructor() {
    this.queue = [];           // 待处理任务队列
    this.isProcessing = false; // 是否正在处理任务
    this.currentTask = null;   // 当前正在执行的任务
  }

  /**
   * 添加任务到队列
   * @param {Function} taskFn - 要执行的异步任务函数
   * @returns {Promise} - 任务执行结果
   */
  async addTask(taskFn) {
    return new Promise((resolve, reject) => {
      const task = {
        fn: taskFn,
        resolve,
        reject,
        addedAt: Date.now()
      };

      this.queue.push(task);
      console.log(`📋 任务已加入队列，当前队列长度: ${this.queue.length}`);

      // 如果当前没有任务在执行，立即开始处理
      if (!this.isProcessing) {
        this.processNext();
      }
    });
  }

  /**
   * 处理队列中的下一个任务
   */
  async processNext() {
    // 如果队列为空，停止处理
    if (this.queue.length === 0) {
      this.isProcessing = false;
      this.currentTask = null;
      console.log('✅ 队列已清空');
      return;
    }

    this.isProcessing = true;
    this.currentTask = this.queue.shift();

    const waitTime = Date.now() - this.currentTask.addedAt;
    console.log(`⚡ 开始处理任务 (等待时间: ${(waitTime / 1000).toFixed(1)}s, 剩余队列: ${this.queue.length})`);

    try {
      // 执行任务
      const result = await this.currentTask.fn();
      this.currentTask.resolve(result);
      console.log(`✅ 任务执行成功`);
    } catch (error) {
      console.error(`❌ 任务执行失败:`, error.message);
      this.currentTask.reject(error);
    }

    // 延迟一小段时间再处理下一个任务，避免过快请求
    setTimeout(() => {
      this.processNext();
    }, 500); // 500ms 延迟
  }

  /**
   * 获取队列状态
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      currentTask: this.currentTask ? '执行中' : '空闲'
    };
  }

  /**
   * 清空队列
   */
  clear() {
    // 拒绝所有待处理的任务
    this.queue.forEach(task => {
      task.reject(new Error('队列已清空'));
    });
    
    this.queue = [];
    console.log('🗑️ 队列已清空');
  }
}

// 创建单例实例
const imageTaskQueue = new TaskQueueManager();
const videoTaskQueue = new TaskQueueManager();

export { imageTaskQueue, videoTaskQueue };
export default TaskQueueManager;



