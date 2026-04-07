// index.js - 本地/局域网 Express 服务（逻辑在 lib/progress-image.js）
const express = require('express');
const { generateProgressImage } = require('./lib/progress-image');

const app = express();
const PORT = 3000;

app.get('/dotpaper', async (req, res) => {
  try {
    const buffer = await generateProgressImage(req.query);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(buffer);
  } catch (error) {
    res.status(400).send(`❌ 错误：${error.message}`);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('====================================');
  console.log(`✅ 进度图服务启动成功！端口：${PORT}`);
  console.log('📌 测试地址：');
  console.log(`   1. 本日：http://localhost:${PORT}/dotpaper?viewType=today`);
  console.log(`   2. 本月：http://localhost:${PORT}/dotpaper?viewType=month`);
  console.log(`   3. 本年按天：http://localhost:${PORT}/dotpaper?viewType=year&unit=day`);
  console.log(`   4. 本年按周：http://localhost:${PORT}/dotpaper?viewType=year&unit=week`);
  console.log(`   5. 本年按月：http://localhost:${PORT}/dotpaper?viewType=year&unit=month`);
  console.log(`   6. 生日：http://localhost:${PORT}/dotpaper?viewType=birthday&birthDate=19900101&targetAge=90`);
  console.log(`🌐 局域网访问：替换localhost为你的内网IP（如192.168.1.105）`);
  console.log('====================================');
});
