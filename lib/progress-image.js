const Jimp = require('jimp');
const dayjs = require('dayjs');
const weekOfYear = require('dayjs/plugin/weekOfYear');
const customParseFormat = require('dayjs/plugin/customParseFormat');

dayjs.extend(weekOfYear);
dayjs.extend(customParseFormat);

const DOT_CONFIG = {
  size: 16,
  margin: 8,
  maxWidth: 1200,
  colors: {
    past: '#f2f2f2',
    current: '#f27a49',
    future: '#3f4044'
  }
};

const COLORS = {
  background: '#151618',
  past: '#f2f2f2',
  current: '#f27a49',
  future: '#3f4044',
  textSecondary: '#9b9ca0',
  monthLabel: '#7f8187',
  emptyHint: '#d0d1d5'
};

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return Jimp.rgbaToInt(r, g, b, 255);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function weekdayIndexMondayFirst(d) {
  return (d.day() + 6) % 7;
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
    Jimp.FONT_SANS_16_WHITE,
    Jimp.FONT_SANS_16_BLACK,
    Jimp.FONT_SANS_32_WHITE,
    // 显式路径兜底，避免某些 serverless 打包环境下常量路径失效
    require.resolve('@jimp/plugin-print/fonts/open-sans/open-sans-16-white/open-sans-16-white.fnt'),
    require.resolve('@jimp/plugin-print/fonts/open-sans/open-sans-16-black/open-sans-16-black.fnt')
  ];
  let lastError;
  for (const path of candidates) {
    try {
      return await Jimp.loadFont(path);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

function uiScale(canvasWidth) {
  // 以 iOS 常见 360pt 宽度作为 1x 参考，1080px 输出约为 3x
  return Math.max(1, canvasWidth / 360);
}

const TINY_GLYPHS = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '001', '001', '001'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  'd': ['110', '101', '101', '101', '110'],
  'h': ['100', '100', '110', '101', '101'],
  'm': ['000', '110', '111', '101', '101'],
  'w': ['000', '101', '101', '101', '111'],
  'l': ['100', '100', '100', '100', '111'],
  'e': ['111', '100', '111', '100', '111'],
  'f': ['111', '100', '111', '100', '100'],
  't': ['111', '010', '010', '010', '010'],
  '%': ['101', '001', '010', '100', '101'],
  '.': ['000', '000', '000', '000', '010'],
  ' ': ['000', '000', '000', '000', '000']
};

function drawFallbackText(image, text, x, y, color, pixel = 2, charGap = 1) {
  let cursorX = x;
  const lowered = String(text).toLowerCase();
  for (const ch of lowered) {
    const glyph = TINY_GLYPHS[ch] || TINY_GLYPHS[' '];
    for (let row = 0; row < glyph.length; row++) {
      const line = glyph[row];
      for (let col = 0; col < line.length; col++) {
        if (line[col] !== '1') continue;
        for (let dx = 0; dx < pixel; dx++) {
          for (let dy = 0; dy < pixel; dy++) {
            image.setPixelColor(color, cursorX + col * pixel + dx, y + row * pixel + dy);
          }
        }
      }
    }
    cursorX += glyph[0].length * pixel + charGap * pixel;
  }
}

function parseCanvasSize(width, height, fallbackW = 1080, fallbackH = 1920) {
  const parsedW = Number.parseInt(width, 10);
  const parsedH = Number.parseInt(height, 10);
  return {
    canvasWidth: Number.isFinite(parsedW) && parsedW > 0 ? parsedW : fallbackW,
    canvasHeight: Number.isFinite(parsedH) && parsedH > 0 ? parsedH : fallbackH
  };
}

function parseDateYYYYMMDD(input, fieldName) {
  const d = dayjs(input, 'YYYYMMDD', true);
  if (!d.isValid()) {
    throw new Error(`${fieldName} 格式错误！必须是 YYYYMMDD，例如 19900101`);
  }
  return d;
}

async function drawBottomText(image, width, height, leftText, rightText) {
  try {
    const font = await loadFontWithFallback();
    const leftLayer = await createTintedTextLayer(leftText, font, COLORS.current);
    const rightLayer = await createTintedTextLayer(rightText, font, COLORS.textSecondary);
    const totalTextWidth = leftLayer.bitmap.width + rightLayer.bitmap.width;
    const textX = Math.floor((width - totalTextWidth) / 2);
    const textY = Math.floor(height - Math.max(48, height * 0.09));
    image.composite(leftLayer, textX, textY);
    image.composite(rightLayer, textX + leftLayer.bitmap.width, textY);
  } catch (_err) {
    // 字体加载失败时，使用内置像素字兜底，保证线上可见
    const scale = uiScale(width);
    const pixel = Math.max(2, Math.floor(scale));
    const allText = `${leftText}${rightText}`;
    const approxCharWidth = 3 * pixel + pixel;
    const totalWidth = allText.length * approxCharWidth;
    const textX = Math.max(0, Math.floor((width - totalWidth) / 2));
    const textY = Math.floor(height - Math.max(48, height * 0.09));
    drawFallbackText(image, leftText, textX, textY, hexToRgb(COLORS.current), pixel, 1);
    drawFallbackText(
      image,
      rightText,
      textX + leftText.length * approxCharWidth,
      textY,
      hexToRgb(COLORS.textSecondary),
      pixel,
      1
    );
  }
}

async function drawHintCenter(image, width, height, text) {
  try {
    const font = await loadFontWithFallback();
    const layer = await createTintedTextLayer(text, font, COLORS.emptyHint);
    const x = Math.floor((width - layer.bitmap.width) / 2);
    const y = Math.floor((height - layer.bitmap.height) / 2);
    image.composite(layer, x, y);
  } catch (_err) {
    // no-op
  }
}

async function renderTodayImage(todayObj, canvasWidth, canvasHeight) {
  const scale = uiScale(canvasWidth);
  const cols = 8;
  const rows = 6;
  const totalDots = 48;
  const minutesPerDot = 30;
  const topReservedHeight = canvasHeight * 0.25;

  const image = await Jimp.create(canvasWidth, canvasHeight, hexToRgb(COLORS.background));

  const gridWidth = canvasWidth * 0.8;
  const step = Math.max(Math.min(canvasWidth, canvasHeight) / 16, gridWidth / cols);
  const dotSize = Math.max(8, Math.floor(12 * scale));
  const gridActualWidth = (cols - 1) * step + dotSize;
  const startX = (canvasWidth - gridActualWidth) / 2;
  const startY = topReservedHeight + (canvasHeight - topReservedHeight) * 0.15;

  const currentTotalMinutes = todayObj.hour() * 60 + todayObj.minute();
  const currentDotIndex = clamp(Math.floor(currentTotalMinutes / minutesPerDot), 0, totalDots - 1);

  for (let index = 0; index < totalDots; index++) {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const x = Math.floor(startX + col * step);
    const y = Math.floor(startY + row * step);
    const color =
      index < currentDotIndex ? COLORS.past :
      index === currentDotIndex ? COLORS.current : COLORS.future;
    drawCircle(image, x, y, dotSize, hexToRgb(color));
  }

  const leftHours = Math.max(0, totalDots - currentDotIndex - 1) * minutesPerDot / 60;
  const progressPercent = clamp(Math.round(((currentDotIndex + 1) / totalDots) * 100), 0, 100);
  await drawBottomText(image, canvasWidth, canvasHeight, `${leftHours}h left`, ` · ${progressPercent}%`);
  return image.getBufferAsync(Jimp.MIME_PNG);
}

async function renderCurrentMonthImage(todayObj, canvasWidth, canvasHeight) {
  const scale = uiScale(canvasWidth);
  const dotsPerRow = 7;
  const dotSize = Math.max(8, Math.floor(12 * scale));
  const topReservedHeight = canvasHeight * 0.25;

  const monthStart = todayObj.startOf('month');
  const totalDays = monthStart.daysInMonth();
  const firstWeekday = weekdayIndexMondayFirst(monthStart);
  const currentDayIndex = todayObj.date() - 1;
  const totalRows = Math.ceil((totalDays + firstWeekday) / dotsPerRow);

  const image = await Jimp.create(canvasWidth, canvasHeight, hexToRgb(COLORS.background));

  const horizontalPadding = Math.max(16, canvasWidth * 0.08);
  const verticalPadding = Math.max(16, canvasHeight * 0.08);
  const bottomTextPadding = Math.max(20, canvasHeight * 0.08);
  const bottomReservedHeight = bottomTextPadding + 28;
  const availableWidth = canvasWidth - horizontalPadding * 2;
  const availableHeight = canvasHeight - verticalPadding * 2 - topReservedHeight - bottomReservedHeight;

  const rawStep = Math.min(availableWidth / dotsPerRow, availableHeight / Math.max(1, totalRows));
  const baseStep = Math.max(dotSize + 4, rawStep);
  const step = Math.max(dotSize + 2, dotSize + (baseStep - dotSize) * 0.7);

  const gridActualWidth = (dotsPerRow - 1) * step + dotSize;
  const gridActualHeight = (totalRows - 1) * step + dotSize;
  const startX = (canvasWidth - gridActualWidth) / 2;
  const startY = topReservedHeight + Math.min(
    (canvasHeight - topReservedHeight - bottomReservedHeight - gridActualHeight) / 2,
    (canvasHeight - topReservedHeight - bottomReservedHeight) * 0.15
  );

  for (let dayIndex = 0; dayIndex < totalDays; dayIndex++) {
    const dayOffset = dayIndex + firstWeekday;
    const row = Math.floor(dayOffset / dotsPerRow);
    const col = dayOffset % dotsPerRow;
    const x = Math.floor(startX + col * step);
    const y = Math.floor(startY + row * step);
    const color =
      dayIndex < currentDayIndex ? COLORS.past :
      dayIndex === currentDayIndex ? COLORS.current : COLORS.future;
    drawCircle(image, x, y, dotSize, hexToRgb(color));
  }

  const leftDays = Math.max(0, totalDays - currentDayIndex - 1);
  const progressPercent = clamp(Math.round(((currentDayIndex + 1) / totalDays) * 100), 0, 100);
  await drawBottomText(image, canvasWidth, canvasHeight, `${leftDays}d left`, ` · ${progressPercent}%`);
  return image.getBufferAsync(Jimp.MIME_PNG);
}

async function renderYearDayImage(todayObj, canvasWidth, canvasHeight) {
  const scale = uiScale(canvasWidth);
  const dotsPerRow = 15;
  const dotSize = Math.max(5, Math.floor(8 * scale));
  const topReservedHeight = canvasHeight * 0.25;

  const yearStart = todayObj.startOf('year');
  const totalDays = todayObj.endOf('year').diff(yearStart, 'day') + 1;
  const currentDayIndex = clamp(todayObj.diff(yearStart, 'day'), 0, totalDays - 1);
  const totalRows = Math.ceil(totalDays / dotsPerRow);

  const image = await Jimp.create(canvasWidth, canvasHeight, hexToRgb(COLORS.background));

  const horizontalPadding = Math.max(16, canvasWidth * 0.08);
  const verticalPadding = Math.max(16, canvasHeight * 0.08);
  const bottomTextPadding = Math.max(20, canvasHeight * 0.08);
  const bottomReservedHeight = bottomTextPadding + 28;
  const availableWidth = canvasWidth - horizontalPadding * 2;
  const availableHeight = canvasHeight - verticalPadding * 2 - topReservedHeight - bottomReservedHeight;

  const rawStep = Math.min(availableWidth / dotsPerRow, availableHeight / totalRows);
  const maxStepToFit = Math.min(
    (availableWidth - dotSize) / Math.max(1, dotsPerRow - 1),
    (availableHeight - dotSize) / Math.max(1, totalRows - 1)
  );
  const baseStep = Math.min(maxStepToFit, Math.max(dotSize + 3, rawStep));
  const softMaxStep = maxStepToFit * 1.08;
  const step = Math.min(softMaxStep, dotSize + (baseStep - dotSize) * 1.1);

  const gridActualWidth = (dotsPerRow - 1) * step + dotSize;
  const gridActualHeight = (totalRows - 1) * step + dotSize;
  const startX = (canvasWidth - gridActualWidth) / 2;
  const startY = topReservedHeight + Math.min(
    (canvasHeight - topReservedHeight - bottomReservedHeight - gridActualHeight) / 2,
    (canvasHeight - topReservedHeight - bottomReservedHeight) * 0.15
  );

  for (let dayIndex = 0; dayIndex < totalDays; dayIndex++) {
    const row = Math.floor(dayIndex / dotsPerRow);
    const col = dayIndex % dotsPerRow;
    const x = Math.floor(startX + col * step);
    const y = Math.floor(startY + row * step);
    const color =
      dayIndex < currentDayIndex ? COLORS.past :
      dayIndex === currentDayIndex ? COLORS.current : COLORS.future;
    drawCircle(image, x, y, dotSize, hexToRgb(color));
  }

  const leftDays = Math.max(0, totalDays - currentDayIndex - 1);
  const progressPercent = clamp(Math.round(((currentDayIndex + 1) / totalDays) * 100), 0, 100);
  await drawBottomText(image, canvasWidth, canvasHeight, `${leftDays}d left`, ` · ${progressPercent}%`);
  return image.getBufferAsync(Jimp.MIME_PNG);
}

async function renderYearWeekImage(todayObj, canvasWidth, canvasHeight) {
  const scale = uiScale(canvasWidth);
  const dotsPerRow = 8;
  const dotSize = Math.max(8, Math.floor(12 * scale));
  const topReservedHeight = canvasHeight * 0.25;

  const yearStart = todayObj.startOf('year');
  const totalDays = todayObj.endOf('year').diff(yearStart, 'day') + 1;
  const totalWeeks = Math.ceil(totalDays / 7);
  const dayOfYear = todayObj.diff(yearStart, 'day') + 1;
  const currentWeekIndex = clamp(Math.floor((dayOfYear - 1) / 7), 0, totalWeeks - 1);
  const totalRows = Math.ceil(totalWeeks / dotsPerRow);

  const image = await Jimp.create(canvasWidth, canvasHeight, hexToRgb(COLORS.background));

  const horizontalPadding = Math.max(16, canvasWidth * 0.08);
  const verticalPadding = Math.max(16, canvasHeight * 0.08);
  const bottomTextPadding = Math.max(20, canvasHeight * 0.08);
  const bottomReservedHeight = bottomTextPadding + 28;
  const availableWidth = canvasWidth - horizontalPadding * 2;
  const availableHeight = canvasHeight - verticalPadding * 2 - topReservedHeight - bottomReservedHeight;

  const rawStep = Math.min(availableWidth / dotsPerRow, availableHeight / totalRows);
  const baseStep = Math.max(dotSize + 4, rawStep);
  const step = Math.max(dotSize + 2, dotSize + (baseStep - dotSize) * 0.7);

  const gridActualWidth = (dotsPerRow - 1) * step + dotSize;
  const gridActualHeight = (totalRows - 1) * step + dotSize;
  const startX = (canvasWidth - gridActualWidth) / 2;
  const startY = topReservedHeight + Math.min(
    (canvasHeight - topReservedHeight - bottomReservedHeight - gridActualHeight) / 2,
    (canvasHeight - topReservedHeight - bottomReservedHeight) * 0.15
  );

  for (let weekIndex = 0; weekIndex < totalWeeks; weekIndex++) {
    const row = Math.floor(weekIndex / dotsPerRow);
    const col = weekIndex % dotsPerRow;
    const x = Math.floor(startX + col * step);
    const y = Math.floor(startY + row * step);
    const color =
      weekIndex < currentWeekIndex ? COLORS.past :
      weekIndex === currentWeekIndex ? COLORS.current : COLORS.future;
    drawCircle(image, x, y, dotSize, hexToRgb(color));
  }

  const leftWeeks = Math.max(0, totalWeeks - currentWeekIndex - 1);
  const progressPercent = clamp(Math.round(((currentWeekIndex + 1) / totalWeeks) * 100), 0, 100);
  await drawBottomText(image, canvasWidth, canvasHeight, `${leftWeeks}w left`, ` · ${progressPercent}%`);
  return image.getBufferAsync(Jimp.MIME_PNG);
}

async function renderYearMonthImage(todayObj, canvasWidth, canvasHeight) {
  const scale = uiScale(canvasWidth);
  const monthsColumns = 3;
  const monthsRows = 4;
  const dotsPerRow = 7;
  const maxDotRows = 6;
  const dotSize = Math.max(2, Math.floor(4 * scale));
  const topReservedHeight = canvasHeight * 0.25;

  const image = await Jimp.create(canvasWidth, canvasHeight, hexToRgb(COLORS.background));

  const horizontalPadding = Math.max(16, canvasWidth * 0.08);
  const verticalPadding = Math.max(16, canvasHeight * 0.08);
  const bottomTextPadding = Math.max(20, canvasHeight * 0.08);
  const bottomReservedHeight = bottomTextPadding + 28;

  const contentWidth = canvasWidth - horizontalPadding * 2;
  const contentHeight = canvasHeight - verticalPadding * 2 - topReservedHeight - bottomReservedHeight;
  const blockGapX = 0;
  const blockGapY = 0;
  const blockWidth = (contentWidth - (monthsColumns - 1) * blockGapX) / monthsColumns;
  const blockHeight = (contentHeight - (monthsRows - 1) * blockGapY) / monthsRows;

  const gridActualWidth = monthsColumns * blockWidth + (monthsColumns - 1) * blockGapX;
  const gridActualHeight = monthsRows * blockHeight + (monthsRows - 1) * blockGapY;
  const startX = (canvasWidth - gridActualWidth) / 2;
  const startY = topReservedHeight + Math.max(0, (contentHeight - gridActualHeight) / 2);

  const yearStart = todayObj.startOf('year');
  const yearEnd = todayObj.endOf('year');
  const totalDays = yearEnd.diff(yearStart, 'day') + 1;
  const currentDayOfYear = clamp(todayObj.diff(yearStart, 'day') + 1, 1, totalDays);
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  let labelFont = null;
  try {
    labelFont = await loadFontWithFallback();
  } catch (_err) {
    labelFont = null;
  }

  for (let month = 1; month <= 12; month++) {
    const monthIndex = month - 1;
    const blockRow = Math.floor(monthIndex / monthsColumns);
    const blockCol = monthIndex % monthsColumns;
    const blockX = startX + blockCol * (blockWidth + blockGapX);
    const blockY = startY + blockRow * (blockHeight + blockGapY);

    const monthTopInset = 4;
    const labelHeight = 12;
    const topSpacing = 0;
    const bottomInset = 2;
    const dotAreaTop = monthTopInset + labelHeight + topSpacing;
    const dotAreaWidth = blockWidth;
    const dotAreaHeight = Math.max(0, blockHeight - monthTopInset - labelHeight - topSpacing - bottomInset);
    const dotStep = Math.min(
      (dotAreaWidth - dotSize) / Math.max(1, dotsPerRow - 1),
      (dotAreaHeight - dotSize) / Math.max(1, maxDotRows - 1)
    );
    const dotsGridWidth = (dotsPerRow - 1) * dotStep + dotSize;
    const dotStartX = Math.max(0, (dotAreaWidth - dotsGridWidth) / 2);

    if (labelFont) {
      const monthLayer = await createTintedTextLayer(monthLabels[monthIndex], labelFont, COLORS.monthLabel);
      image.composite(monthLayer, Math.floor(blockX + dotStartX), Math.floor(blockY + monthTopInset));
    }

    const monthStart = yearStart.month(monthIndex).startOf('month');
    const daysInMonth = monthStart.daysInMonth();
    const firstWeekday = weekdayIndexMondayFirst(monthStart);

    for (let dayIndex = 0; dayIndex < daysInMonth; dayIndex++) {
      const day = dayIndex + 1;
      const offset = firstWeekday + dayIndex;
      const row = Math.floor(offset / dotsPerRow);
      const col = offset % dotsPerRow;
      const x = Math.floor(blockX + dotStartX + col * dotStep);
      const y = Math.floor(blockY + dotAreaTop + row * dotStep);
      const color =
        month < todayObj.month() + 1 ? COLORS.past :
        month > todayObj.month() + 1 ? COLORS.future :
        day < todayObj.date() ? COLORS.past :
        day === todayObj.date() ? COLORS.current : COLORS.future;
      drawCircle(image, x, y, dotSize, hexToRgb(color));
    }
  }

  const leftDays = Math.max(0, totalDays - currentDayOfYear);
  const progressPercent = clamp(Math.round((currentDayOfYear / totalDays) * 100), 0, 100);
  await drawBottomText(image, canvasWidth, canvasHeight, `${leftDays}d left`, ` · ${progressPercent}%`);
  return image.getBufferAsync(Jimp.MIME_PNG);
}

function birthdayGridShape(totalMonths) {
  const total = Math.max(1, totalMonths);
  const targetRatio = 2 / 3;
  const estimatedRows = Math.max(1, Math.round(Math.sqrt(total * targetRatio)));

  let bestRows = estimatedRows;
  let bestCols = Math.max(1, Math.ceil(total / estimatedRows));
  let bestScore = Number.POSITIVE_INFINITY;

  for (let rows = Math.max(1, estimatedRows - 8); rows <= estimatedRows + 8; rows++) {
    const cols = Math.max(1, Math.ceil(total / rows));
    const ratioPenalty = Math.abs(rows / cols - targetRatio);
    const areaPenalty = (rows * cols - total) / total;
    const score = ratioPenalty * 10 + areaPenalty;
    if (score < bestScore) {
      bestScore = score;
      bestRows = rows;
      bestCols = cols;
    }
  }

  return { rows: bestRows, cols: bestCols };
}

async function renderBirthdayImage(todayObj, birth, targetAge, canvasWidth, canvasHeight) {
  const scale = uiScale(canvasWidth);
  const totalMonths = Math.max(1, targetAge * 12);
  const elapsedMonths = clamp(todayObj.diff(birth, 'month'), 0, totalMonths);
  const leftMonths = Math.max(0, totalMonths - elapsedMonths);
  const progressPercent = clamp(Math.round((elapsedMonths / totalMonths) * 100), 0, 100);

  const image = await Jimp.create(canvasWidth, canvasHeight, hexToRgb(COLORS.background));

  const topReservedHeight = canvasHeight * 0.25;
  const bottomTextPadding = Math.max(20, canvasHeight * 0.08);
  const bottomReservedHeight = bottomTextPadding + 28;
  const horizontalPadding = Math.max(10, canvasWidth * 0.04);
  const verticalPadding = Math.max(10, canvasHeight * 0.04);

  const grid = birthdayGridShape(totalMonths);
  const dotsPerRow = grid.cols;
  const totalRows = grid.rows;

  const availableWidth = canvasWidth - horizontalPadding * 2;
  const availableHeight = canvasHeight - verticalPadding * 2 - topReservedHeight - bottomReservedHeight;
  const step = Math.min(availableWidth / dotsPerRow, availableHeight / Math.max(1, totalRows));
  const dotSize = Math.max(2 * scale, Math.min(8.5 * scale, step * 0.82));

  const gridActualWidth = (dotsPerRow - 1) * step + dotSize;
  const gridActualHeight = (totalRows - 1) * step + dotSize;
  const startX = (canvasWidth - gridActualWidth) / 2;
  const startY = topReservedHeight + Math.min(
    (canvasHeight - topReservedHeight - bottomReservedHeight - gridActualHeight) / 2,
    (canvasHeight - topReservedHeight - bottomReservedHeight) * 0.15
  );

  for (let index = 0; index < totalMonths; index++) {
    const row = Math.floor(index / dotsPerRow);
    const col = index % dotsPerRow;
    const x = Math.floor(startX + col * step);
    const y = Math.floor(startY + row * step);
    const color =
      elapsedMonths >= totalMonths || index < elapsedMonths ? COLORS.past :
      index === elapsedMonths ? COLORS.current : COLORS.future;
    drawCircle(image, x, y, dotSize, hexToRgb(color));
  }

  await drawBottomText(image, canvasWidth, canvasHeight, `${leftMonths}m left`, ` · ${progressPercent}%`);
  return image.getBufferAsync(Jimp.MIME_PNG);
}

async function renderRangeImage(todayObj, start, end, canvasWidth, canvasHeight) {
  const scale = uiScale(canvasWidth);
  const totalDays = end.diff(start, 'day') + 1;
  const passedDays = clamp(todayObj.diff(start, 'day') + 1, 0, totalDays);
  const leftDays = Math.max(0, end.diff(todayObj, 'day'));
  const progressPercent = clamp(Math.round((passedDays / totalDays) * 100), 0, 100);

  const units = [];
  let cursor = start;
  while (cursor.isBefore(end) || cursor.isSame(end, 'day')) {
    units.push(cursor.isBefore(todayObj, 'day') ? 'past' : cursor.isSame(todayObj, 'day') ? 'current' : 'future');
    cursor = cursor.add(1, 'day');
  }

  const image = await Jimp.create(canvasWidth, canvasHeight, hexToRgb(COLORS.background));
  const cols = Math.max(8, Math.ceil(Math.sqrt(units.length * 1.5)));
  const rows = Math.ceil(units.length / cols);
  const topReservedHeight = canvasHeight * 0.25;
  const bottomTextPadding = Math.max(20, canvasHeight * 0.08);
  const bottomReservedHeight = bottomTextPadding + 28;
  const horizontalPadding = Math.max(16, canvasWidth * 0.08);
  const verticalPadding = Math.max(16, canvasHeight * 0.08);
  const availableWidth = canvasWidth - horizontalPadding * 2;
  const availableHeight = canvasHeight - verticalPadding * 2 - topReservedHeight - bottomReservedHeight;
  const step = Math.min(availableWidth / cols, availableHeight / Math.max(1, rows));
  const dotSize = Math.max(3 * scale, Math.min(10 * scale, step * 0.75));
  const gridActualWidth = (cols - 1) * step + dotSize;
  const gridActualHeight = (rows - 1) * step + dotSize;
  const startX = (canvasWidth - gridActualWidth) / 2;
  const startY = topReservedHeight + Math.min(
    (canvasHeight - topReservedHeight - bottomReservedHeight - gridActualHeight) / 2,
    (canvasHeight - topReservedHeight - bottomReservedHeight) * 0.15
  );

  units.forEach((status, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const x = Math.floor(startX + col * step);
    const y = Math.floor(startY + row * step);
    drawCircle(image, x, y, dotSize, hexToRgb(status === 'past' ? COLORS.past : status === 'current' ? COLORS.current : COLORS.future));
  });

  await drawBottomText(image, canvasWidth, canvasHeight, `${leftDays}d left`, ` · ${progressPercent}%`);
  return image.getBufferAsync(Jimp.MIME_PNG);
}

function normalizeMode(query = {}) {
  const viewType = String(query.viewType || '').toLowerCase();
  const unit = String(query.unit || query.yearUnit || query.subType || query.granularity || '').toLowerCase();

  if (viewType === 'today') return 'today';
  if (viewType === 'month') return 'month'; // 本月
  if (viewType === 'birthday') return 'birthday';
  if (viewType === 'range') return 'range';

  if (viewType === 'year') {
    return unit === 'week' ? 'year-week' : unit === 'month' ? 'year-month' : 'year-day';
  }

  // 兼容旧参数
  if (viewType === 'day') return 'year-day';
  if (viewType === 'week') return 'year-week';
  if (viewType === 'yearmonth' || viewType === 'calendar') return 'year-month';

  return '';
}

async function generateProgressImage(query = {}) {
  const { canvasWidth, canvasHeight } = parseCanvasSize(query.width, query.height);
  const todayObj = dayjs();
  const mode = normalizeMode(query);

  switch (mode) {
    case 'today':
      return renderTodayImage(todayObj, canvasWidth, canvasHeight);

    case 'month':
      return renderCurrentMonthImage(todayObj, canvasWidth, canvasHeight);

    case 'year-day':
      return renderYearDayImage(todayObj, canvasWidth, canvasHeight);

    case 'year-week':
      return renderYearWeekImage(todayObj, canvasWidth, canvasHeight);

    case 'year-month':
      return renderYearMonthImage(todayObj, canvasWidth, canvasHeight);

    case 'birthday': {
      if (!query.birthDate) {
        const image = await Jimp.create(canvasWidth, canvasHeight, hexToRgb(COLORS.background));
        await drawHintCenter(image, canvasWidth, canvasHeight, 'Please set birthDate');
        return image.getBufferAsync(Jimp.MIME_PNG);
      }
      const birth = parseDateYYYYMMDD(query.birthDate, 'birthDate');
      if (birth.isAfter(todayObj, 'day')) {
        throw new Error('birthDate 不能晚于今天');
      }
      const targetAgeRaw = Number.parseInt(query.targetAge, 10);
      const targetAge = Number.isFinite(targetAgeRaw) ? clamp(targetAgeRaw, 60, 120) : 90;
      return renderBirthdayImage(todayObj, birth, targetAge, canvasWidth, canvasHeight);
    }

    case 'range': {
      if (!query.startDate || !query.endDate) {
        throw new Error('viewType=range 时必传 startDate 和 endDate，格式 YYYYMMDD');
      }
      const start = parseDateYYYYMMDD(query.startDate, 'startDate');
      const end = parseDateYYYYMMDD(query.endDate, 'endDate');
      if (end.isBefore(start, 'day')) {
        throw new Error('endDate 必须晚于或等于 startDate');
      }
      return renderRangeImage(todayObj, start, end, canvasWidth, canvasHeight);
    }

    default:
      throw new Error('viewType 不支持。请使用 today / month / year / birthday / range');
  }
}

module.exports = { generateProgressImage, DOT_CONFIG };
