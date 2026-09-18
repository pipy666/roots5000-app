# IELTS Roots 5000 · App 开发状态 v0.3

## 当前版本

- App: v0.3
- 词库：5000 条
- Core：3000
- Reading：2000
- 数据源：`IELTS_Roots_5000_Master_CURRENT.md`
- 词库内容状态：QA 进行中

## 已完成，不要重复

### 学习卡
- 正面：word / IPA / POS / 前缀-词根-后缀 / mnemonic cue
- 3D 点击翻卡
- 背面：中文义 / 推导 / IELTS 例句 / 搭配
- 展开更多：拆解可信度 / prefix / root / suffix / tier
- 词族联动
- 常见易混词提醒
- 单词自动朗读一次
- 单词与例句手动朗读
- 英音 / 美音

### v0.3 手势
- 翻面后右滑 = 我会了
- 翻面后左滑 = 不会
- 模糊保留按钮
- 正面禁止滑动评分
- 手机端评分栏 sticky

### 每日任务
- 默认 50 新词，可设 75 / 100
- 到期复习不占新词额度
- 3 新词 + 1 复习交错
- 不会 / 模糊有限回流
- 学习节奏条显示接下来的新词 / 复习 / 重现
- 今日完成后停止
- 主动额外学习 10 词

### 完成页
- 新词完成量
- 复习完成量
- 稳定度（只计算“我会了”）
- 学习时长
- known / fuzzy / unknown 数量
- 未来 24h 到期量
- 当日薄弱结构

### 辅助页
- A–Z 词库
- Core / Reading 筛选
- 中文 / 英文搜索
- 前缀地图
- 词根地图
- 后缀地图
- 错词本
- 薄弱结构排行
- Core / Reading 学习进度

### 测验
- 每轮固定 20 题
- 混合
- 认义
- 构词
- 拼写
- 错词

### 响应式 / PWA
- iPhone 单卡
- iPad 竖屏宽卡
- iPad 横屏左卡 + 右词族
- localStorage 存档
- Service Worker
- PWA manifest
- GitHub Pages 零构建部署

## v0.3 已修 Bug

- 修复 `.seg` 全局监听导致词库筛选 / 构词切换误触测验状态的问题。
- 修复同一张卡切页面返回后自动发音重复触发。
- 滑动后抑制额外 click，避免评分同时触发卡片翻面。
- Service Worker cache key 升级到 `roots5000-app-v0.3`。

## 下一版从这里继续（v0.4.1）

优先级：
1. 真实设备上的 iPhone / iPad 触控与 safe-area 微调。
2. 增加“撤回上一张评分”能力，避免手滑。
3. 学习历史 / 日历热力图（只显示学习记录，不增加压力型无限指标）。
4. 错词本支持直接打开该词卡，而不是只能做测验。
5. 词库页点击单词打开轻量预览卡。
6. 更细的复习调度：Core 与 Reading 不同 mastery 阈值。
7. 等词库 QA 推进后重新生成 `data/words.js`，无需改 UI。

## 当前 QA

- `app.js`：`node --check` 通过
- `scripts/build_data.py`：Python compile 通过
- HTML 静态 ID 与 JS 静态 selector：无缺失
- 词库：5000 / Core 3000 / Reading 2000
- ZIP：`unzip -t` 通过
- 尚未在本环境进行真实 iOS Safari 实机测试


## v0.4.1 修复记录
- 已修复：`.flashcard` 的 `cardIn` 入场动画使用 `transform` + `animation-fill-mode: both`，覆盖 `.is-flipped{transform:rotateY(180deg)}`，导致点击后 class 已变化但视觉不翻转。
- 修复方式：入场动画仅使用 opacity/filter，不再竞争 transform。


## v0.4.1 interaction pass
- 学习参考交互：正面思考 → 揭晓停留 → 主动评分后才离开。
- 背面成为稳定阅读区，不再任意点击翻回。
- 每类按钮增加语义化可爱音效；音效可在设置独立开关。
- 翻面与滑动评分之间加入防误触时间窗。
- 后续继续从实机 Safari 手势/音量体验测试开始。
