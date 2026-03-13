/**
 * 将时间戳字符串转换为秒数
 * 
 * @param timestamp - 时间戳字符串，格式：HH:MM:SS.mmm（例如："00:00:15.033"）
 * @returns 秒数（浮点数）
 * 
 * @example
 * convertTimestampToSeconds("00:00:15.033") // 返回 15.033
 * convertTimestampToSeconds("00:01:30.500") // 返回 90.5
 * convertTimestampToSeconds("01:23:45.678") // 返回 5025.678
 */
export function convertTimestampToSeconds(timestamp: string): number {
  // 分割时间戳：HH:MM:SS.mmm
  const parts = timestamp.split(':')
  
  if (parts.length !== 3) {
    console.error(`无效的时间戳格式: ${timestamp}`)
    return 0
  }

  const hours = parseInt(parts[0], 10)
  const minutes = parseInt(parts[1], 10)
  
  // 分割秒和毫秒：SS.mmm
  const secondsParts = parts[2].split('.')
  const seconds = parseInt(secondsParts[0], 10)
  const milliseconds = secondsParts[1] ? parseInt(secondsParts[1], 10) : 0

  // 将毫秒转换为小数部分（例如：033 -> 0.033）
  const millisecondsDecimal = milliseconds / 1000

  // 计算总秒数
  const totalSeconds = hours * 3600 + minutes * 60 + seconds + millisecondsDecimal

  return totalSeconds
}

/**
 * 将秒数转换为时间戳字符串
 * 
 * @param seconds - 秒数（浮点数）
 * @returns 时间戳字符串，格式：HH:MM:SS.mmm
 * 
 * @example
 * convertSecondsToTimestamp(15.033) // 返回 "00:00:15.033"
 * convertSecondsToTimestamp(90.5)   // 返回 "00:01:30.500"
 */
export function convertSecondsToTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const milliseconds = Math.round((seconds % 1) * 1000)

  const hh = String(hours).padStart(2, '0')
  const mm = String(minutes).padStart(2, '0')
  const ss = String(secs).padStart(2, '0')
  const mmm = String(milliseconds).padStart(3, '0')

  return `${hh}:${mm}:${ss}.${mmm}`
}

/**
 * 格式化秒数为可读的时间字符串
 * 
 * @param seconds - 秒数
 * @returns 格式化的时间字符串（例如："1分30秒"）
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}秒`
  }
  
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = (seconds % 60).toFixed(1)
  
  return `${minutes}分${remainingSeconds}秒`
}





