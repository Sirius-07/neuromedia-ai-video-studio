/**
 * 时间工具函数测试用例
 * 
 * 运行测试：在浏览器控制台中运行这些测试
 */

import { convertTimestampToSeconds, convertSecondsToTimestamp, formatDuration } from './timeUtils'

// 测试用例
export const runTimeUtilsTests = () => {
  console.log('🧪 开始测试时间工具函数...\n')

  // 测试 convertTimestampToSeconds
  console.group('📝 测试 convertTimestampToSeconds')
  
  const testCases = [
    { input: '00:00:00.000', expected: 0, description: '零时间' },
    { input: '00:00:15.033', expected: 15.033, description: '15.033秒' },
    { input: '00:00:05.000', expected: 5, description: '5秒' },
    { input: '00:00:30.500', expected: 30.5, description: '30.5秒' },
    { input: '00:00:45.200', expected: 45.2, description: '45.2秒' },
    { input: '00:01:00.000', expected: 60, description: '1分钟' },
    { input: '00:01:30.500', expected: 90.5, description: '1分30.5秒' },
    { input: '01:00:00.000', expected: 3600, description: '1小时' },
    { input: '01:23:45.678', expected: 5025.678, description: '1小时23分45.678秒' },
  ]

  let passed = 0
  let failed = 0

  testCases.forEach(({ input, expected, description }) => {
    const result = convertTimestampToSeconds(input)
    const isPass = Math.abs(result - expected) < 0.001 // 允许浮点误差
    
    if (isPass) {
      console.log(`✅ ${description}: "${input}" → ${result}秒`)
      passed++
    } else {
      console.error(`❌ ${description}: "${input}" → ${result}秒 (期望: ${expected}秒)`)
      failed++
    }
  })

  console.groupEnd()
  console.log(`\n测试结果: ${passed} 通过, ${failed} 失败\n`)

  // 测试 convertSecondsToTimestamp
  console.group('📝 测试 convertSecondsToTimestamp')
  
  const reverseCases = [
    { input: 15.033, expected: '00:00:15.033' },
    { input: 90.5, expected: '00:01:30.500' },
    { input: 5025.678, expected: '01:23:45.678' },
  ]

  reverseCases.forEach(({ input, expected }) => {
    const result = convertSecondsToTimestamp(input)
    console.log(`${input}秒 → "${result}" (期望: "${expected}")`)
  })

  console.groupEnd()

  // 测试 formatDuration
  console.group('📝 测试 formatDuration')
  
  const formatCases = [
    { input: 15.033, expected: '15.0秒' },
    { input: 90.5, expected: '1分30.5秒' },
    { input: 5025.678, expected: '83分45.7秒' },
  ]

  formatCases.forEach(({ input, expected }) => {
    const result = formatDuration(input)
    console.log(`${input}秒 → "${result}"`)
  })

  console.groupEnd()

  console.log('\n✅ 所有测试完成！')
}

// 在开发模式下自动运行测试
if (import.meta.env.DEV) {
  console.log('🔧 开发模式：可在控制台运行 runTimeUtilsTests() 来测试时间工具函数')
}





