// index.js - 本地/局域网 Express 服务（逻辑在 lib/progress-image.js）
const express = require('express');
const { generateProgressImage } = require('./lib/progress-image');

const app = express();
const PORT = 3000;

function sendUsageResponse(req, res) {
  const base = `${req.protocol}://${req.get('host')}/dotpaper`;
  const links = [
    { label: '本日', href: `${base}?viewType=today` },
    { label: '本月', href: `${base}?viewType=month` },
    { label: '本年-按天', href: `${base}?viewType=year&unit=day` },
    { label: '本年-按周', href: `${base}?viewType=year&unit=week` },
    { label: '本年-按月', href: `${base}?viewType=year&unit=month` },
    { label: '生日', href: `${base}?viewType=birthday&birthDate=19900101&targetAge=90` }
  ];

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Dotpaper API</title>
  <style>
    body { margin: 0; padding: 24px; background: #151618; color: #f2f2f2; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .card { max-width: 760px; margin: 24px auto; background: #1f2024; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 18px; }
    h1 { margin: 0 0 10px; font-size: 22px; }
    p { margin: 0 0 12px; color: #bfc1c7; line-height: 1.6; }
    ul { margin: 8px 0 0; padding-left: 18px; }
    li { margin: 8px 0; }
    a { color: #9fe870; text-decoration: none; }
    code { color: #f27a49; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Dotpaper API</h1>
    <p>服务已正常运行。请在 <code>/dotpaper</code> 后携带参数访问图片接口。</p>
    <p>快速测试：</p>
    <ul>
      ${links.map((it) => `<li><a href="${it.href}" target="_blank" rel="noreferrer">${it.label}</a></li>`).join('')}
    </ul>
  </div>
</body>
</html>`;

  res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}

app.get('/dotpaper', async (req, res) => {
  if (!req.query || Object.keys(req.query).length === 0) {
    sendUsageResponse(req, res);
    return;
  }

  try {
    const buffer = await generateProgressImage(req.query);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(buffer);
  } catch (error) {
    res.status(400).send(`❌ 错误：${error.message}`);
  }
});

app.get('/', (req, res) => {
  sendUsageResponse(req, res);
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
