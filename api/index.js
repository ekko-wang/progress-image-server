module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const host = req.headers['x-forwarded-host'] || req.headers.host || 'progress-image-server.vercel.app';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const base = `${proto}://${host}/dotpaper`;

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
    a { color: #9fe870; text-decoration: none; }
    code { color: #f27a49; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Dotpaper API</h1>
    <p>服务已正常运行。请访问 <code>/dotpaper</code> 并附带参数生成图片。</p>
    <p>入口：<a href="${base}">${base}</a></p>
  </div>
</body>
</html>`;

  res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
};

