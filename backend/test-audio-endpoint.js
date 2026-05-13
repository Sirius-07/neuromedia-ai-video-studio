import axios from 'axios';

console.log('测试音频生成端点...\n');

axios.post('http://localhost:4300/api/v1/audio/quick-generate', {
  prompt: 'test sound effect',
  duration: 1
})
.then(res => {
  console.log('✓ 成功:', res.data);
})
.catch(err => {
  console.error('✗ 失败:', err.message);
  if (err.response) {
    console.error('状态码:', err.response.status);
    console.error('响应:', err.response.data);
  }
});















