import axios from 'axios';

console.log('测试 API...\n');

// 测试健康检查
axios.get('http://localhost:3000/health')
  .then(res => {
    console.log('✓ 健康检查通过:', res.data);
    
    // 测试创建任务
    return axios.post('http://localhost:3000/api/v1/soundtrack/create', {
      videoId: 'https://1926289158.tos-cn-guangzhou.volces.com/a1.mp4'
    });
  })
  .then(res => {
    console.log('\n✓ 任务创建成功:');
    console.log(JSON.stringify(res.data, null, 2));
  })
  .catch(err => {
    console.error('\n✗ 错误:', err.message);
    if (err.response) {
      console.error('状态码:', err.response.status);
      console.error('响应:', err.response.data);
    }
  });















