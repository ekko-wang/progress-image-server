// 进度图生成逻辑（本地 Express + Vercel 共用，只改这一处即可）
const Jimp = require('jimp');
const dayjs = require('dayjs');
const weekOfYear = require('dayjs/plugin/weekOfYear');
dayjs.extend(weekOfYear);

// 圆点样式配置（可自定义）
const DOT_CONFIG = {
  size: 16,       // 圆点大小
  margin: 8,      // 圆点间距
  maxWidth: 1200, // 画布最大宽度
  colors: {
    past: '#fafad2',    // 已过去的圆点颜色
    current: '#ff1493', // 今天的圆点颜色
    future: '#cccccc'   // 未来的圆点颜色
  }
};

const BIRTHDAY_STYLE = {
  canvasWidth: 1080,
  canvasHeight: 1920,
  maxDisplayDots: 390,
  columns: 16,
  gridTopRatio: 0.20,
  gridWidthRatio: 0.68,
  textGapRatio: 0.06,
  colors: {
    background: '#151618',
    past: '#f2f2f2',
    current: '#f27a49',
    future: '#3f4044',
    textSecondary: '#9b9ca0'
  }
};

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return Jimp.rgbaToInt(r, g, b, 255);
}

function downsampleUnits(units, maxDots) {
  if (!Array.isArray(units) || units.length <= maxDots) return units || [];
  const groupSize = Math.ceil(units.length / maxDots);
  const result = [];
  for (let i = 0; i < units.length; i += groupSize) {
    const group = units.slice(i, i + groupSize);
    if (group.includes('current')) {
      result.push('current');
      continue;
    }
    const pastCount = group.filter((s) => s === 'past').length;
    const futureCount = group.length - pastCount;
    result.push(pastCount >= futureCount ? 'past' : 'future');
  }
  return result;
}

function drawCircle(image, x, y, diameter, color) {
  const radius = diameter / 2;
  for (let dx = 0; dx < diameter; dx++) {
    for (let dy = 0; dy < diameter; dy++) {
      const cx = dx - radius;
      const cy = dy - radius;
      if (cx * cx + cy * cy <= radius * radius) {
        image.setPixelColor(color, x + dx, y + dy);
      }
    }
  }
}

async function createTintedTextLayer(text, font, hex) {
  const width = Math.max(1, Jimp.measureText(font, text));
  const height = Math.max(1, Jimp.measureTextHeight(font, text, width));
  const layer = await Jimp.create(width, height, 0x00000000);
  layer.print(font, 0, 0, text);
  layer.color([{ apply: 'mix', params: [hex, 100] }]);
  return layer;
}

async function loadFontWithFallback() {
  const candidates = [
    Jimp.FONT_SANS_32_WHITE,
    Jimp.FONT_SANS_16_WHITE,
    Jimp.FONT_SANS_16_BLACK
  ];

  let lastError;
  for (const fontPath of candidates) {
    try {
      return await Jimp.loadFont(fontPath);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

async function renderBirthdayStyleImage(units, stats) {
  const { canvasWidth, canvasHeight, maxDisplayDots, columns, gridTopRatio, gridWidthRatio, textGapRatio, colors } = BIRTHDAY_STYLE;
  const displayUnits = downsampleUnits(units, maxDisplayDots);
  const rows = Math.ceil(displayUnits.length / columns);

  const image = await Jimp.create(canvasWidth, canvasHeight, hexToRgb(colors.background));

  const gridWidth = Math.floor(canvasWidth * gridWidthRatio);
  const step = Math.max(8, Math.floor(gridWidth / columns));
  const dotSize = Math.max(8, Math.min(30, step - 12));
  const gridActualWidth = columns * step;
  const gridActualHeight = rows * step;
  const startX = Math.floor((canvasWidth - gridActualWidth) / 2 + (step - dotSize) / 2);
  const startY = Math.floor(canvasHeight * gridTopRatio);

  const colorMap = {
    past: hexToRgb(colors.past),
    current: hexToRgb(colors.current),
    future: hexToRgb(colors.future)
  };

  displayUnits.forEach((status, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const x = startX + col * step;
    const y = startY + row * step;
    drawCircle(image, x, y, dotSize, colorMap[status] || colorMap.future);
  });

  // 部分 Serverless 环境可能缺失部分 Jimp 字体文件：优先尝试一组“默认字体”，全部失败时才降级为仅输出点阵。
  try {
    const leftLabel = `${stats.leftDays}d left`;
    const rightLabel = ` · ${stats.progressPercent}%`;
    const font = await loadFontWithFallback();
    const leftLayer = await createTintedTextLayer(leftLabel, font, colors.current);
    const rightLayer = await createTintedTextLayer(rightLabel, font, colors.textSecondary);

    const totalTextWidth = leftLayer.bitmap.width + rightLayer.bitmap.width;
    const textX = Math.floor((canvasWidth - totalTextWidth) / 2);
    const textY = Math.floor(Math.min(canvasHeight - 80, startY + gridActualHeight + canvasHeight * textGapRatio));

    image.composite(leftLayer, textX, textY);
    image.composite(rightLayer, textX + leftLayer.bitmap.width, textY);
  } catch (_err) {
    // no-op fallback
  }

  return image.getBufferAsync(Jimp.MIME_PNG);
}

/**
 * 根据 query 生成进度图 PNG buffer
 * viewType 必传，用于区分模式；再传该模式下的其他参数。
 * @param {{ viewType: string, startDate?: string, endDate?: string, birthDate?: string }} query
 *  - viewType: day | week | range | birthday
 *  - range 时必传 startDate、endDate（YYYYMMDD）
 *  - birthday 时必传 birthDate（YYYYMMDD）
 * @returns {Promise<Buffer>} PNG buffer
 */
async function generateProgressImage(query) {
  const { viewType, startDate, endDate, birthDate } = query || {};
  let timeUnits = [];
  const todayObj = dayjs();
  const today = todayObj.format('YYYY-MM-DD');
  let statsStart = null;
  let statsEnd = null;

  if (!viewType) {
    throw new Error('请传入 viewType（必传）。可选：day（年度按天）、week（年度按周）、range（起止日期，需同时传 startDate、endDate，格式 YYYYMMDD）、birthday（生日模式，需要 birthDate，格式 YYYYMMDD）');
  }

  if (viewType === 'range') {
    if (!startDate || !endDate) {
      throw new Error('viewType=range 时必传 startDate 和 endDate，格式 YYYYMMDD，例如 startDate=20260101&endDate=20261231');
    }
    const start = dayjs(startDate, 'YYYYMMDD');
    const end = dayjs(endDate, 'YYYYMMDD');
    if (!start.isValid() || !end.isValid() || end.isBefore(start)) {
      throw new Error('日期参数错误！格式必须是 YYYYMMDD，且结束日期 ≥ 开始日期');
    }
    statsStart = start;
    statsEnd = end;
    let current = start;
    while (current.isBefore(end) || current.isSame(end)) {
      const dateStr = current.format('YYYY-MM-DD');
      timeUnits.push(
        dateStr === today ? 'current' :
          dayjs(dateStr).isBefore(today) ? 'past' : 'future'
      );
      current = current.add(1, 'day');
    }
  } else if (viewType === 'day') {
    const yearStart = dayjs().startOf('year');
    const yearEnd = dayjs().endOf('year');
    statsStart = yearStart;
    statsEnd = yearEnd;
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
    const yearStart = dayjs().startOf('year');
    const yearEnd = dayjs().endOf('year');
    statsStart = yearStart;
    statsEnd = yearEnd;
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
  } else if (viewType === 'birthday') {
    // 生日模式：以出生日期为起点，预估寿命 90 年。
    // 一个圆点代表 14 天，既不过密也不过稀。
    if (!birthDate) {
      throw new Error('viewType=birthday 时必传 birthDate，格式 YYYYMMDD，例如 birthDate=19900101');
    }
    const birth = dayjs(birthDate, 'YYYYMMDD');
    if (!birth.isValid()) {
      throw new Error('birthDate 格式错误！必须是 YYYYMMDD，例如 19900101');
    }
    if (birth.isAfter(todayObj)) {
      throw new Error('birthDate 不能晚于今天');
    }

    const lifeEnd = birth.add(90, 'year').subtract(1, 'day');
    const daysPerDot = 14;
    const totalDays = lifeEnd.diff(birth, 'day') + 1;
    const passedDays = Math.min(totalDays, Math.max(0, todayObj.diff(birth, 'day') + 1));
    const leftDays = Math.max(0, lifeEnd.diff(todayObj, 'day'));
    const progressPercent = Math.max(0, Math.min(100, Math.round((passedDays / totalDays) * 100)));

    let blockStart = birth;
    while (blockStart.isBefore(lifeEnd) || blockStart.isSame(lifeEnd)) {
      const blockEnd = blockStart.add(daysPerDot - 1, 'day');

      let status;
      if (blockEnd.isBefore(todayObj)) {
        status = 'past';
      } else if (blockStart.isAfter(todayObj)) {
        status = 'future';
      } else {
        status = 'current';
      }

      timeUnits.push(status);
      blockStart = blockStart.add(daysPerDot, 'day');
    }

    return renderBirthdayStyleImage(timeUnits, { leftDays, progressPercent });
  } else {
    throw new Error('viewType 仅支持：day（年度按天）、week（年度按周）、range（起止日期）、birthday（生日模式）');
  }

  const totalDays = statsEnd.diff(statsStart, 'day') + 1;
  const passedDays = Math.min(totalDays, Math.max(0, todayObj.diff(statsStart, 'day') + 1));
  const leftDays = Math.max(0, statsEnd.diff(todayObj, 'day'));
  const progressPercent = Math.max(0, Math.min(100, Math.round((passedDays / totalDays) * 100)));

  return renderBirthdayStyleImage(timeUnits, { leftDays, progressPercent });
}

module.exports = { generateProgressImage, DOT_CONFIG };
