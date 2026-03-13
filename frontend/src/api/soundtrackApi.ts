import axios from 'axios'

const API_BASE_URL = '/api/v1/soundtrack'

export interface SoundtrackTask {
  taskId: string
  status: 'processing' | 'completed' | 'failed'
  videoId: string
  finalAssetMap?: any
  errorMessage?: string
  createdAt: string
  updatedAt: string
}

export interface CreateTaskResponse {
  success: boolean
  data: {
    taskId: string
    status: string
    videoId: string
    createdAt: string
  }
}

export interface GetStatusResponse {
  success: boolean
  data: SoundtrackTask
  error?: string
}

/**
 * 创建配乐任务
 */
export async function createSoundtrackTask(videoId: string): Promise<CreateTaskResponse> {
  const response = await axios.post(`${API_BASE_URL}/create`, { videoId })
  return response.data
}

/**
 * 获取任务状态
 */
export async function getSoundtrackTaskStatus(taskId: string): Promise<GetStatusResponse> {
  const response = await axios.get(`${API_BASE_URL}/status/${taskId}`)
  return response.data
}

/**
 * 上传视频文件
 */
export async function uploadVideo(file: File): Promise<any> {
  const formData = new FormData()
  formData.append('video', file)
  
  const response = await axios.post('/api/v1/video/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total) {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
        console.log(`上传进度: ${percentCompleted}%`)
      }
    }
  })
  
  return response.data
}

/**
 * 更新音效配置
 */
export async function updateSoundEffects(taskId: string, updates: any): Promise<any> {
  const response = await axios.put(`${API_BASE_URL}/${taskId}/effects`, updates)
  return response.data
}

/**
 * 合成视频（将音效合成到视频中）
 */
export async function mergeVideo(taskId: string): Promise<any> {
  const response = await axios.post(`${API_BASE_URL}/${taskId}/merge`)
  return response.data
}

