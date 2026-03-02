// index.js - 本地/局域网 Express 服务（逻辑在 lib/progress-image.js）
const express = require('express');
const { generateProgressImage } = require('./lib/progress-image');

const app = express();
const PORT = 3000;

// 新规范路径：/dotpaper.png
app.get('/dotpaper.png', async (req, res) => {
  try {
    const buffer = await generateProgressImage(req.query);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(buffer);
  } catch (error) {
    res.status(400).send(`❌ 错误：${error.message}`);
  }
});

// 兼容旧路径 /progress.png，内部复用相同逻辑
app.get('/progress.png', async (req, res) => {
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
  console.log(`   1. 年度按天：http://localhost:${PORT}/dotpaper.png?viewType=day`);
  console.log(`   2. 年度按周：http://localhost:${PORT}/dotpaper.png?viewType=week`);
  console.log(`   3. 自定义日期：http://localhost:${PORT}/dotpaper.png?startDate=20260102&endDate=20260401`);
  console.log(`🌐 局域网访问：替换localhost为你的内网IP（如192.168.1.105）`);
  console.log('====================================');
});
