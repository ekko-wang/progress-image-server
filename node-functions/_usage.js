function usageHtml(base) {
  const links = [
    { label: '本日', href: `${base}?viewType=today` },
    { label: '本月', href: `${base}?viewType=month` },
    { label: '本年-按天', href: `${base}?viewType=year&unit=day` },
    { label: '本年-按周', href: `${base}?viewType=year&unit=week` },
    { label: '本年-按月', href: `${base}?viewType=year&unit=month` },
    { label: '生日', href: `${base}?viewType=birthday&birthDate=19900101&targetAge=90` }
  ];

  return `<!doctype html>
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
}

function responseHtml(html, status = 200) {
  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-cache'
    }
  });
}

function methodNotAllowed() {
  return new Response('Method Not Allowed', { status: 405 });
}

module.exports = {
  usageHtml,
  responseHtml,
  methodNotAllowed
};

