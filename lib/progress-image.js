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

// 年度按周模式样式 - 52周排成4行，每行13周，点更大更显眼
const WEEK_STYLE = {
  canvasWidth: 1080,
  canvasHeight: 1080,  // 使用正方形画布，更紧凑
  maxDisplayDots: 53,
  columns: 13,         // 4行 x 13列 = 52周
  gridTopRatio: 0.15,  // 更靠近顶部
  gridWidthRatio: 0.80,
  textGapRatio: 0.08,
  colors: {
    background: '#151618',
    past: '#f2f2f2',
    current: '#4ecdc4',  // 使用青色突出当前周
    future: '#3f4044',
    textSecondary: '#9b9ca0'
  }
};

// 年度按月模式样式 - 12个月排成4行 x 3列，Life Calendar 风格
const MONTH_STYLE = {
  canvasWidth: 1080,
  canvasHeight: 1920,
  maxDisplayDots: 12,
  columns: 3,           // 4行 x 3列 = 12个月
  gridTopRatio: 0.25,
  gridWidthRatio: 0.75,
  textGapRatio: 0.10,
  showMonthLabels: true,
  colors: {
    background: '#151618',
    past: '#f2f2f2',
    current: '#f27a49',  // 橙色/珊瑚色突出当前月份
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

async function renderBirthdayStyleImage(units, stats, canvasWidth, canvasHeight) {
  const { maxDisplayDots, columns, gridTopRatio, gridWidthRatio, textGapRatio, colors } = BIRTHDAY_STYLE;
  const effectiveWidth = canvasWidth || BIRTHDAY_STYLE.canvasWidth;
  const effectiveHeight = canvasHeight || BIRTHDAY_STYLE.canvasHeight;
  const displayUnits = downsampleUnits(units, maxDisplayDots);
  const rows = Math.ceil(displayUnits.length / columns);

  const image = await Jimp.create(effectiveWidth, effectiveHeight, hexToRgb(colors.background));

  const gridWidth = Math.floor(effectiveWidth * gridWidthRatio);
  const step = Math.max(8, Math.floor(gridWidth / columns));
  const dotSize = Math.max(8, Math.min(30, step - 12));
  const gridActualWidth = columns * step;
  const gridActualHeight = rows * step;
  const startX = Math.floor((effectiveWidth - gridActualWidth) / 2 + (step - dotSize) / 2);
  const startY = Math.floor(effectiveHeight * gridTopRatio);

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
    const textX = Math.floor((effectiveWidth - totalTextWidth) / 2);
    const textY = Math.floor(Math.min(effectiveHeight - 80, startY + gridActualHeight + effectiveHeight * textGapRatio));

    image.composite(leftLayer, textX, textY);
    image.composite(rightLayer, textX + leftLayer.bitmap.width, textY);
  } catch (_err) {
    // no-op fallback
  }

  return image.getBufferAsync(Jimp.MIME_PNG);
}

// 通用渲染函数 - 接受样式配置作为参数
async function renderStyleImage(units, stats, style, canvasWidth, canvasHeight) {
  const { maxDisplayDots, columns, gridTopRatio, gridWidthRatio, textGapRatio, colors } = style;
  const effectiveWidth = canvasWidth || style.canvasWidth || 1080;
  const effectiveHeight = canvasHeight || style.canvasHeight || 1080;
  const displayUnits = downsampleUnits(units, maxDisplayDots);
  const rows = Math.ceil(displayUnits.length / columns);

  const image = await Jimp.create(effectiveWidth, effectiveHeight, hexToRgb(colors.background));

  const gridWidth = Math.floor(effectiveWidth * gridWidthRatio);
  const step = Math.max(8, Math.floor(gridWidth / columns));
  const dotSize = Math.max(8, Math.min(30, step - 12));
  const gridActualWidth = columns * step;
  const gridActualHeight = rows * step;
  const startX = Math.floor((effectiveWidth - gridActualWidth) / 2 + (step - dotSize) / 2);
  const startY = Math.floor(effectiveHeight * gridTopRatio);

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

  // 部分 Serverless 环境可能缺失部分 Jimp 字体文件：优先尝试一组"默认字体"，全部失败时才降级为仅输出点阵。
  try {
    const leftLabel = `${stats.leftDays}d left`;
    const rightLabel = ` · ${stats.progressPercent}%`;
    const font = await loadFontWithFallback();
    const leftLayer = await createTintedTextLayer(leftLabel, font, colors.current);
    const rightLayer = await createTintedTextLayer(rightLabel, font, colors.textSecondary);

    const totalTextWidth = leftLayer.bitmap.width + rightLayer.bitmap.width;
    const textX = Math.floor((effectiveWidth - totalTextWidth) / 2);
    const textY = Math.floor(Math.min(effectiveHeight - 80, startY + gridActualHeight + effectiveHeight * textGapRatio));

    image.composite(leftLayer, textX, textY);
    image.composite(rightLayer, textX + leftLayer.bitmap.width, textY);
  } catch (_err) {
    // no-op fallback
  }

  return image.getBufferAsync(Jimp.MIME_PNG);
}

// 年度按周模式渲染函数
async function renderWeekStyleImage(units, stats, canvasWidth, canvasHeight) {
  return renderStyleImage(units, stats, WEEK_STYLE, canvasWidth, canvasHeight);
}

// 年度按月模式渲染函数 - 带月份标签
async function renderMonthStyleImage(units, stats, canvasWidth, canvasHeight) {
  const { maxDisplayDots, columns, gridTopRatio, gridWidthRatio, textGapRatio, colors } = MONTH_STYLE;
  const effectiveWidth = canvasWidth || MONTH_STYLE.canvasWidth;
  const effectiveHeight = canvasHeight || MONTH_STYLE.canvasHeight;
  const displayUnits = downsampleUnits(units, maxDisplayDots);
  const rows = Math.ceil(displayUnits.length / columns);

  const image = await Jimp.create(effectiveWidth, effectiveHeight, hexToRgb(colors.background));

  const gridWidth = Math.floor(effectiveWidth * gridWidthRatio);
  const step = Math.max(8, Math.floor(gridWidth / columns));
  const dotSize = Math.max(16, Math.min(40, step - 16));  // 更大的点
  const gridActualWidth = columns * step;
  const gridActualHeight = rows * step;
  const startX = Math.floor((effectiveWidth - gridActualWidth) / 2 + (step - dotSize) / 2);
  const startY = Math.floor(effectiveHeight * gridTopRatio);

  const colorMap = {
    past: hexToRgb(colors.past),
    current: hexToRgb(colors.current),
    future: hexToRgb(colors.future)
  };

  // 绘制月份圆点
  displayUnits.forEach((status, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const x = startX + col * step;
    const y = startY + row * step;
    drawCircle(image, x, y, dotSize, colorMap[status] || colorMap.future);
  });

  // 绘制大字体：左侧百分比 + 右侧剩余天数
  try {
    const font = await loadFontWithFallback();

    // 左侧大百分比
    const percentText = `${stats.progressPercent}%`;
    const percentLayer = await createTintedTextLayer(percentText, font, colors.current);

    // 右侧剩余天数
    const daysText = `${stats.leftDays}d left`;
    const daysLayer = await createTintedTextLayer(daysText, font, colors.textSecondary);

    // 百分比放在左侧中间位置
    const percentX = 60;
    const percentY = Math.floor(effectiveHeight * 0.12);

    // 天数放在右侧中间位置
    const daysX = effectiveWidth - daysLayer.bitmap.width - 60;
    const daysY = Math.floor(effectiveHeight * 0.12);

    image.composite(percentLayer, percentX, percentY);
    image.composite(daysLayer, daysX, daysY);
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
  const { viewType, startDate, endDate, birthDate, width, height } = query || {};

  // 验证必传参数
  if (!viewType) {
    throw new Error('请传入 viewType（必传）。可选：day（年度按天）、week（年度按周）、month（年度按月）、range（起止日期，需同时传 startDate、endDate，格式 YYYYMMDD）、birthday（生日模式，需要 birthDate，格式 YYYYMMDD）');
  }

  // 验证尺寸参数
  if (!width || !height) {
    throw new Error('请传入 width 和 height（必传），单位为像素，例如 width=1080&height=1920');
  }

  const canvasWidth = parseInt(width, 10);
  const canvasHeight = parseInt(height, 10);

  if (isNaN(canvasWidth) || isNaN(canvasHeight) || canvasWidth <= 0 || canvasHeight <= 0) {
    throw new Error('width 和 height 必须是正整数');
  }

  let timeUnits = [];
  const todayObj = dayjs();
  const today = todayObj.format('YYYY-MM-DD');
  let statsStart = null;
  let statsEnd = null;

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

    const totalDays = yearEnd.diff(yearStart, 'day') + 1;
    const passedDays = Math.min(totalDays, Math.max(0, todayObj.diff(yearStart, 'day') + 1));
    const leftDays = Math.max(0, yearEnd.diff(todayObj, 'day'));
    const progressPercent = Math.max(0, Math.min(100, Math.round((passedDays / totalDays) * 100)));

    return renderWeekStyleImage(timeUnits, { leftDays, progressPercent }, canvasWidth, canvasHeight);
  } else if (viewType === 'month') {
    // 年度按月模式：12个月，每个月一个圆点
    const yearStart = dayjs().startOf('year');
    const yearEnd = dayjs().endOf('year');
    statsStart = yearStart;
    statsEnd = yearEnd;

    const currentMonth = dayjs().month() + 1; // 1-12

    // 生成12个月的状态
    for (let month = 1; month <= 12; month++) {
      timeUnits.push(
        month === currentMonth ? 'current' :
          month < currentMonth ? 'past' : 'future'
      );
    }

    const totalDays = yearEnd.diff(yearStart, 'day') + 1;
    const passedDays = Math.min(totalDays, Math.max(0, todayObj.diff(yearStart, 'day') + 1));
    const leftDays = Math.max(0, yearEnd.diff(todayObj, 'day'));
    const progressPercent = Math.max(0, Math.min(100, Math.round((passedDays / totalDays) * 100)));

    return renderMonthStyleImage(timeUnits, { leftDays, progressPercent }, canvasWidth, canvasHeight);
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

    return renderBirthdayStyleImage(timeUnits, { leftDays, progressPercent }, canvasWidth, canvasHeight);
  } else {
    throw new Error('viewType 仅支持：day（年度按天）、week（年度按周）、month（年度按月）、range（起止日期）、birthday（生日模式）');
  }

  const totalDays = statsEnd.diff(statsStart, 'day') + 1;
  const passedDays = Math.min(totalDays, Math.max(0, todayObj.diff(statsStart, 'day') + 1));
  const leftDays = Math.max(0, statsEnd.diff(todayObj, 'day'));
  const progressPercent = Math.max(0, Math.min(100, Math.round((passedDays / totalDays) * 100)));

  return renderBirthdayStyleImage(timeUnits, { leftDays, progressPercent }, canvasWidth, canvasHeight);
}

module.exports = { generateProgressImage, DOT_CONFIG };
