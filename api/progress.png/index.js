// Vercel Serverless：进度图接口（逻辑在 lib/progress-image.js）
const { generateProgressImage } = require('../../lib/progress-image');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    const buffer = await generateProgressImage(req.query || {});
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(buffer);
  } catch (error) {
    res.status(400).send(`❌ 错误：${error.message}`);
  }
};
