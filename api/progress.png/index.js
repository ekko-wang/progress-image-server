// Vercel Serverless：进度图生成接口
const Jimp = require('jimp');
const dayjs = require('dayjs');

const DOT_CONFIG = {
  size: 16,
  margin: 8,
  maxWidth: 1200,
  colors: {
    past: '#ffffff',
    current: '#ff7d00',
    future: '#cccccc'
  }
};

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return Jimp.rgbaToInt(r, g, b, 255);
}

module.exports = async (req, res) => {
  // 仅允许 GET
  if (req.method !== 'GET') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    const { startDate, endDate, viewType } = req.query || {};
    let timeUnits = [];
    const today = dayjs().format('YYYY-MM-DD');

    if (startDate && endDate) {
      const start = dayjs(startDate, 'YYYYMMDD');
      const end = dayjs(endDate, 'YYYYMMDD');
      if (!start.isValid() || !end.isValid() || end.isBefore(start)) {
        throw new Error('日期参数错误！格式必须是YYYYMMDD，且结束日期≥开始日期');
      }
      let current = start;
      while (current.isBefore(end) || current.isSame(end)) {
        const dateStr = current.format('YYYY-MM-DD');
        timeUnits.push(
          dateStr === today ? 'current' :
            dayjs(dateStr).isBefore(today) ? 'past' : 'future'
        );
        current = current.add(1, 'day');
      }
    } else if (viewType) {
      const yearStart = dayjs().startOf('year');
      const yearEnd = dayjs().endOf('year');
      if (viewType === 'day') {
        let current = yearStart;
        while (current.isBefore(yearEnd) || current.isSame(yearEnd)) {
          const dateStr = current.format('YYYY-MM-DD');
          timeUnits.push(
            dateStr === today ? 'current' :
              dayjs(dateStr).isBefore(today) ? 'past' : 'future'
          );
          current = current.add(1, 'day');
        }
      } else if (viewType === 'week') {
        let current = yearStart;
        const currentWeek = dayjs().week();
        let weekIndex = 1;
        while (current.isBefore(yearEnd) || current.isSame(yearEnd)) {
          timeUnits.push(
            weekIndex === currentWeek ? 'current' :
              weekIndex < currentWeek ? 'past' : 'future'
          );
          current = current.add(1, 'week');
          weekIndex++;
        }
      } else {
        throw new Error('viewType仅支持day（按天）或week（按周）！');
      }
    } else {
      throw new Error('请传入参数：\n1. 自定义日期：startDate=20260102&endDate=20260401\n2. 年度进度：viewType=day 或 viewType=week');
    }

    const { size, margin, maxWidth } = DOT_CONFIG;
    const dotTotalSize = size + margin;
    const dotsPerRow = Math.floor(maxWidth / dotTotalSize);
    const totalRows = Math.ceil(timeUnits.length / dotsPerRow);
    const canvasWidth = Math.min(timeUnits.length * dotTotalSize, maxWidth);
    const canvasHeight = totalRows * dotTotalSize;

    const image = await Jimp.create(canvasWidth, canvasHeight, 0xf5f5f5ff);
    const colorMap = {
      past: hexToRgb(DOT_CONFIG.colors.past),
      current: hexToRgb(DOT_CONFIG.colors.current),
      future: hexToRgb(DOT_CONFIG.colors.future)
    };

    timeUnits.forEach((status, index) => {
      const row = Math.floor(index / dotsPerRow);
      const col = index % dotsPerRow;
      const x = col * dotTotalSize + margin / 2;
      const y = row * dotTotalSize + margin / 2;

      for (let dx = 0; dx < size; dx++) {
        for (let dy = 0; dy < size; dy++) {
          const cx = dx - size / 2;
          const cy = dy - size / 2;
          if (cx * cx + cy * cy <= (size / 2) * (size / 2)) {
            image.setPixelColor(colorMap[status], x + dx, y + dy);
          }
        }
      }

      if (status === 'past') {
        const borderColor = hexToRgb('#cccccc');
        for (let dx = 0; dx < size; dx++) {
          for (let dy = 0; dy < size; dy++) {
            const cx = dx - size / 2;
            const cy = dy - size / 2;
            const dist = cx * cx + cy * cy;
            const r = size / 2;
            if (dist >= (r - 1) * (r - 1) && dist <= r * r) {
              image.setPixelColor(borderColor, x + dx, y + dy);
            }
          }
        }
      }
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache');
    const buffer = await image.getBufferAsync(Jimp.MIME_PNG);
    res.send(buffer);
  } catch (error) {
    res.status(400).send(`❌ 错误：${error.message}`);
  }
};
