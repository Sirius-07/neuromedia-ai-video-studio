import { useState, useEffect, useRef } from 'react'
import { getSoundtrackTaskStatus } from '../api/soundtrackApi'

interface UseSoundtrackTaskResult {
  status: 'processing' | 'completed' | 'failed' | null
  finalAssetMap: any | null
  error: string | null
  isPolling: boolean
  refetch: () => Promise<void>
}

/**
 * useSoundtrackTask - 轮询配乐任务状态的 React Hook
 * 
 * @param taskId - 任务ID（如果为 null 则不轮询）
 * @returns 任务状态、最终资产地图、错误信息和轮询状态
 */
export function useSoundtrackTask(taskId: string | null): UseSoundtrackTaskResult {
  const [status, setStatus] = useState<'processing' | 'completed' | 'failed' | null>(null)
  const [finalAssetMap, setFinalAssetMap] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)

  // 使用 ref 来存储定时器 ID，避免闭包问题
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // 如果没有 taskId，不进行轮询
    if (!taskId) {
      return
    }

    console.log(`🔄 开始轮询任务: ${taskId}`)
    setIsPolling(true)
    setError(null)

    // 轮询函数
    const pollTaskStatus = async () => {
      try {
        console.log(`📡 请求任务状态: ${taskId}`)
        const response = await getSoundtrackTaskStatus(taskId)

        if (!response.success) {
          throw new Error(response.error || '获取任务状态失败')
        }

        const { status: taskStatus, finalAssetMap: assetMap, errorMessage } = response.data

        console.log(`📊 任务状态: ${taskStatus}`)
        setStatus(taskStatus)

        if (taskStatus === 'completed') {
          // ✅ 任务完成
          console.log('✅ 任务已完成，停止轮询')
          setFinalAssetMap(assetMap)
          setIsPolling(false)
          
          // 清除定时器
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }
        } else if (taskStatus === 'failed') {
          // ❌ 任务失败
          console.log('❌ 任务失败，停止轮询')
          setError(errorMessage || '任务处理失败')
          setIsPolling(false)
          
          // 清除定时器
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }
        } else if (taskStatus === 'processing') {
          // ⏳ 任务处理中，继续轮询
          console.log('⏳ 任务处理中，继续轮询...')
        }

      } catch (err: any) {
        console.error('❌ 轮询出错:', err)
        setError(err.message || '网络请求失败')
        setIsPolling(false)
        
        // 清除定时器
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
      }
    }

    // 立即执行一次
    pollTaskStatus()

    // 每2秒轮询一次
    pollingIntervalRef.current = setInterval(pollTaskStatus, 2000)

    // 清理函数：组件卸载时清除定时器
    return () => {
      console.log('🛑 停止轮询（组件卸载或 taskId 变化）')
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
      setIsPolling(false)
    }
  }, [taskId]) // 当 taskId 变化时重新执行

  // 手动刷新函数
  const refetch = async () => {
    if (!taskId) return

    try {
      console.log(`🔄 手动刷新任务状态: ${taskId}`)
      const response = await getSoundtrackTaskStatus(taskId)

      if (response.success) {
        const { status: taskStatus, finalAssetMap: assetMap } = response.data
        setStatus(taskStatus)
        if (assetMap) {
          setFinalAssetMap(assetMap)
        }
      }
    } catch (err: any) {
      console.error('❌ 手动刷新失败:', err)
    }
  }

  return {
    status,
    finalAssetMap,
    error,
    isPolling,
    refetch
  }
}





