# 进度图服务逻辑说明（必须与代码保持同步）

> 本文档描述 `progress-image-server` 的核心业务逻辑。**今后每次修改生成图片的逻辑，必须同步更新本文件。**

## 一、整体设计

- **用途**：对外提供一个返回 PNG 图片的 HTTP 接口，用来展示一段时间范围内的进度（用圆点表示）。
- **运行形态**：
  - 本地 / 局域网：`index.js` 使用 `express` 起服务，路径为 `GET /dotpaper`。
  - 线上（Vercel）：
    - `api/dotpaper/index.js` 作为 Serverless 函数。
    - `vercel.json` 通过 rewrites 将 `/dotpaper` → `/api/dotpaper`。
- **核心逻辑只有一份**：`lib/progress-image.js` 中的 `generateProgressImage(query)`，本地和 Vercel 都复用。
- **依赖说明**：
  - `jimp`：纯 JS 图片处理库，用于在内存中生成 PNG。
  - `dayjs`：轻量日期库，需额外加载 `dayjs/plugin/weekOfYear` 插件才能使用 `.week()` 方法（按周模式依赖此插件）。
  - `express`：本地开发时使用的 HTTP 服务框架（Vercel 部署时不需要）。

## 二、接口行为

- **请求方式**：`GET`
- **返回内容**：
  - 成功：`Content-Type: image/png`，Body 为 PNG 二进制。
  - 失败：HTTP 400 或 405，Body 为错误文案字符串（包含中文提示）。
- **禁止的方法**：
  - Vercel 版本如果不是 `GET`，直接返回 405：`Method Not Allowed`。

## 三、请求参数

`generateProgressImage(query)` 读取 `query` 中的参数：

- **必填参数**
  - `viewType`：字符串，决定时间颗粒度和模式。
    - `day`：按“年度每天”显示（今年 1 月 1 日到 12 月 31 日，每天一个点）。
    - `week`：按“年度每周”显示（从年初开始每周一个点）。
    - `range`：自定义起止日期，每天一个点。
    - `birthday`：生日模式，用圆点表示从出生到 90 岁整段人生的进度。

- **当 `viewType = range` 时额外必填**
  - `startDate`：开始日期，格式 `YYYYMMDD`，例如 `20260101`。
  - `endDate`：结束日期，格式 `YYYYMMDD`，例如 `20261231`。

- **当 `viewType = birthday` 时额外必填**
  - `birthDate`：出生日期，格式 `YYYYMMDD`，例如 `19900101`。

- **校验逻辑**
  - 未传 `viewType`：抛错，提示必须传 `viewType`，并说明可选值。
  - `viewType = range` 且未传 `startDate` 或 `endDate`：抛错，提示两者都必传。
  - 起止日期格式错误或 `endDate < startDate`：抛错，提示日期必须是 `YYYYMMDD` 且结束日期 ≥ 开始日期。

所有错误最终会在 HTTP 层变成 `400` 状态码和错误文案。

## 四、时间轴与状态数组

核心思想：把一个时间范围拆成若干离散的时间单位（天或周），每一个单位映射为一个状态：

- `past`：已经过去。
- `current`：当前这一天或这一周。
- `future`：未来。

使用 `dayjs` 处理时间，当前日期记为 `today = dayjs().format('YYYY-MM-DD')`。

### 1. `viewType = day`（年度按天）

- 起点：`yearStart = dayjs().startOf('year')`。
- 终点：`yearEnd = dayjs().endOf('year')`。
- 循环从 `yearStart` 到 `yearEnd`（包含结束那天），步长为 1 天。
- 对每一天：
  - 这一天等于 `today` → `'current'`
  - 早于 `today` → `'past'`
  - 晚于 `today` → `'future'`
- 最终得到一个长度为“当年天数”的数组 `timeUnits`。

### 2. `viewType = week`（年度按周）

- 起点：`yearStart = dayjs().startOf('year')`。
- 终点：`yearEnd = dayjs().endOf('year')`。
- 当前周序号：`currentWeek = dayjs().week()`。
- 循环从 `yearStart` 开始，每次加 1 周，直到超过 `yearEnd`。
- 用 `weekIndex` 记录当前循环到第几周：
  - `weekIndex === currentWeek` → `'current'`
  - `weekIndex < currentWeek` → `'past'`
  - 其他 → `'future'`

### 3. `viewType = range`（自定义日期范围）

- 起点：`start = dayjs(startDate, 'YYYYMMDD')`。
- 终点：`end = dayjs(endDate, 'YYYYMMDD')`。
- 循环从 `start` 到 `end`（包含结束那天），步长为 1 天。
- 对每一天：
  - 这一天等于 `today` → `'current'`
  - 早于 `today` → `'past'`
  - 晚于 `today` → `'future'`

最终三种模式都会得到同一种结构：`timeUnits = ['past', 'past', 'current', 'future', ...]`。

### 4. `viewType = birthday`（生日模式，人生进度）

- 输入：`birthDate`（出生日期，`YYYYMMDD`），假定预估寿命为 90 年。
- 终点：`lifeEnd = birthDate + 90 年 - 1 天`。
- 颗粒度：**一个圆点代表 14 天**（约两周），在“点数量不过于密集”和“每个点又不至于太大一段时间”之间做权衡。
- 循环方式：
  - 从 `blockStart = birthDate` 开始，每个 block 覆盖 `daysPerDot = 14` 天：
    - `blockEnd = blockStart + 13 天`。
  - 对每一个 block：
    - 若 `blockEnd < today` → `'past'`。
    - 若 `blockStart > today` → `'future'`。
    - 否则（`today` 落在 `[blockStart, blockEnd]` 内）→ `'current'`。
  - 每次循环结束后：`blockStart += 14 天`，直到超过 `lifeEnd`。

最终 birthday 模式也会生成一个 `timeUnits` 数组，数组长度约等于：`90 年 × 365 天 / 14 ≈ 2340` 个圆点。

## 五、画布和圆点排布

相关配置在 `DOT_CONFIG` 中：

- `size`: 单个圆点的直径（像素），当前是 `16`。
- `margin`: 圆点之间的水平/垂直间距，当前是 `8`。
- `maxWidth`: 画布最大宽度，当前是 `1200` 像素。
- 颜色（十六进制）：
  - `past`: `#fafad2`（淡黄色）。
  - `current`: `#ff1493`（亮粉色）。
  - `future`: `#cccccc`（灰色）。

推导画布大小：

- 单个点的“占位宽度”：`dotTotalSize = size + margin`。
- 每行最多放多少个圆点：`dotsPerRow = floor(maxWidth / dotTotalSize)`。
- 总行数：`totalRows = ceil(timeUnits.length / dotsPerRow)`。
- 画布宽度：`canvasWidth = min(timeUnits.length * dotTotalSize, maxWidth)`。
- 画布高度：`canvasHeight = totalRows * dotTotalSize`。
- 背景颜色固定为浅灰色（`0xf5f5f5ff`）。

## 六、绘制逻辑（Jimp）

1. 创建画布：
   - 使用 `Jimp.create(canvasWidth, canvasHeight, 背景色)`。
   - 使用 `hexToRgb` 把十六进制颜色转换为 `Jimp` 需要的 `rgba` 整数。
2. 遍历 `timeUnits`：
   - 对于索引 `index`：
     - 行号：`row = floor(index / dotsPerRow)`。
     - 列号：`col = index % dotsPerRow`。
     - 起始像素坐标：
       - `x = col * dotTotalSize + margin / 2`
       - `y = row * dotTotalSize + margin / 2`
   - 在 `size × size` 的小方块内，以圆心为中心，根据 \( cx^2 + cy^2 \le r^2 \) 判断是否在圆内，使用对应状态颜色填充。
3. 已过去状态（`status === 'past'`）的描边：
   - 单独再用浅灰色（`#cccccc`）扫描一遍 `size × size`，只在靠近圆半径边缘的一圈像素上着色，形成圆环描边效果。
4. 最终：
   - 调用 `image.getBufferAsync(Jimp.MIME_PNG)` 返回 PNG 二进制 `Buffer`。

## 七、典型调用方式示例

唯一路径为 `/dotpaper`。

- 年度按天：
  - `GET /dotpaper?viewType=day`
- 年度按周：
  - `GET /dotpaper?viewType=week`
- 自定义日期范围：
  - `GET /dotpaper?viewType=range&startDate=20260101&endDate=20261231`
- 生日模式（人生进度）：
  - `GET /dotpaper?viewType=birthday&birthDate=19900101`


> **维护要求**：今后如果修改了日期计算规则、状态定义、圆点样式（大小、颜色、布局）或接口参数格式，务必同步更新本文件对应章节，保证文档与代码一致，方便以后查阅和排错。

