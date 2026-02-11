// index.js - 完整的进度图生成服务（本地/局域网可用）
const express = require('express');
const Jimp = require('jimp');
const dayjs = require('dayjs');

// 创建Express应用
const app = express();
const PORT = 3000; // 本地端口，可修改

// 圆点样式配置（可自定义）
const DOT_CONFIG = {
  size: 16,      // 圆点大小
  margin: 8,     // 圆点间距
  maxWidth: 1200,// 画布最大宽度
  colors: {
    past: '#fafad2',    // 已过去的圆点颜色
    current: '#ff1493', // 今天的圆点颜色
    future: '#cccccc'   // 未来的圆点颜色
  }
};

// 十六进制颜色转Jimp兼容格式
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return Jimp.rgbaToInt(r, g, b, 255);
}

// 核心接口：生成进度图
app.get('/progress.png', async (req, res) => {
  try {
    const { startDate, endDate, viewType } = req.query;
    let timeUnits = [];
    const today = dayjs().format('YYYY-MM-DD');

    // 1. 模式1：自定义日期范围（startDate+endDate，格式YYYYMMDD）
    if (startDate && endDate) {
      const start = dayjs(startDate, 'YYYYMMDD');
      const end = dayjs(endDate, 'YYYYMMDD');
      
      // 校验日期合法性
      if (!start.isValid() || !end.isValid() || end.isBefore(start)) {
        throw new Error('日期参数错误！格式必须是YYYYMMDD，且结束日期≥开始日期');
      }

      // 生成日期数组
      let current = start;
      while (current.isBefore(end) || current.isSame(end)) {
        const dateStr = current.format('YYYY-MM-DD');
        // 判断当前日期状态（已过去/今天/未来）
        timeUnits.push(
          dateStr === today ? 'current' : 
          dayjs(dateStr).isBefore(today) ? 'past' : 'future'
        );
        current = current.add(1, 'day');
      }
    }

    // 2. 模式2：年度进度（viewType=day/week）
    else if (viewType) {
      const yearStart = dayjs().startOf('year');
      const yearEnd = dayjs().endOf('year');

      // 按天统计
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
      }

      // 按周统计
      else if (viewType === 'week') {
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
      }

      // 非法viewType
      else {
        throw new Error('viewType仅支持day（按天）或week（按周）！');
      }
    }

    // 无有效参数
    else {
      throw new Error('请传入参数：\n1. 自定义日期：startDate=20260102&endDate=20260401\n2. 年度进度：viewType=day 或 viewType=week');
    }

    // 3. 计算画布尺寸
    const { size, margin, maxWidth } = DOT_CONFIG;
    const dotTotalSize = size + margin; // 单个圆点占的总宽度（大小+间距）
    const dotsPerRow = Math.floor(maxWidth / dotTotalSize); // 每行能放的圆点数量
    const totalRows = Math.ceil(timeUnits.length / dotsPerRow); // 总行数
    const canvasWidth = Math.min(timeUnits.length * dotTotalSize, maxWidth); // 画布实际宽度
    const canvasHeight = totalRows * dotTotalSize; // 画布高度

    // 4. 创建画布（背景色：浅灰色 #f5f5f5）
    const image = await Jimp.create(canvasWidth, canvasHeight, 0xf5f5f5ff);
    const colorMap = {
      past: hexToRgb(DOT_CONFIG.colors.past),
      current: hexToRgb(DOT_CONFIG.colors.current),
      future: hexToRgb(DOT_CONFIG.colors.future)
    };

    // 5. 绘制所有圆点
    timeUnits.forEach((status, index) => {
      // 计算当前圆点的坐标
      const row = Math.floor(index / dotsPerRow); // 所在行
      const col = index % dotsPerRow; // 所在列
      const x = col * dotTotalSize + margin / 2; // X坐标
      const y = row * dotTotalSize + margin / 2; // Y坐标

      // 绘制实心圆
      for (let dx = 0; dx < size; dx++) {
        for (let dy = 0; dy < size; dy++) {
          const cx = dx - size / 2;
          const cy = dy - size / 2;
          // 仅绘制圆内的像素（距离圆心≤半径）
          if (cx * cx + cy * cy <= (size / 2) * (size / 2)) {
            image.setPixelColor(colorMap[status], x + dx, y + dy);
          }
        }
      }

      // 给已过去的圆点加边框（灰色 #cccccc）
      if (status === 'past') {
        const borderColor = hexToRgb('#cccccc');
        for (let dx = 0; dx < size; dx++) {
          for (let dy = 0; dy < size; dy++) {
            const cx = dx - size / 2;
            const cy = dy - size / 2;
            const dist = cx * cx + cy * cy;
            const r = size / 2;
            // 仅绘制边框（距离圆心在r-1到r之间）
            if (dist >= (r - 1) * (r - 1) && dist <= r * r) {
              image.setPixelColor(borderColor, x + dx, y + dy);
            }
          }
        }
      }
    });

    // 6. 返回图片流（PNG格式，禁用缓存）
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache');
    const buffer = await image.getBufferAsync(Jimp.MIME_PNG);
    res.send(buffer);

  } catch (error) {
    // 错误响应（友好提示）
    res.status(400).send(`❌ 错误：${error.message}`);
  }
});

// 启动服务（监听所有网络接口，支持局域网访问）
app.listen(PORT, '0.0.0.0', () => {
  console.log('====================================');
  console.log(`✅ 进度图服务启动成功！端口：${PORT}`);
  console.log('📌 测试地址：');
  console.log(`   1. 年度按天：http://localhost:${PORT}/progress.png?viewType=day`);
  console.log(`   2. 年度按周：http://localhost:${PORT}/progress.png?viewType=week`);
  console.log(`   3. 自定义日期：http://localhost:${PORT}/progress.png?startDate=20260102&endDate=20260401`);
  console.log(`🌐 局域网访问：替换localhost为你的内网IP（如192.168.1.105）`);
  console.log('====================================');
});