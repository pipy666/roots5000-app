# IELTS Roots 5000 · App 开发状态 v0.5

## 当前版本

- App: v0.5
- 词库：5000 条（Core 3000 / Reading 2000）
- 例句中文：4745 / 5000（Core 全覆盖；Reading 模板句已翻，唯一句待 QA 后补）
- 数据源：`IELTS_Roots_5000_Master_CURRENT.md`

## v0.5 已完成（六大阶段）

### Phase 1 · 6 主题皮肤
- styles.css 全部颜色变量化（45 个语义变量 × 6 套主题取值）
- 草莓牛奶 / 云朵软糖 / 奶油甜点 / 抹茶红豆 / 星空猫猫(夜间) / 彩虹糖果
- ⚙️ 设置 → 皮肤色卡选择，localStorage 记忆，theme-color meta 联动
- 每主题专属背景漂浮装饰（夜间=星空闪烁），主题切换琶音
- 夜间主题下评分按钮/测验反馈/滑动提示全部适配深色

### Phase 2 · 4 tab 合并
- 词库页 = A–Z 查词 + 构词地图，页内 seg 切换
- seg 监听保持属性作用域（[data-tier-filter]/[data-structure-mode]/[data-quiz-mode]），未回归 v0.2 bug

### Phase 3 · 卡片改造
- 正面瘦身：移除 tier/状态/置信度 chips；提示裁掉"→ 中文义"结尾防剧透；整体记忆词用中性提示
- 音节分色：按 前缀(蓝)/词根(粉)/后缀(绿) 边界给单词上色（排序算法经"拼回比对"验证）
- 翻面后点空白翻回正面；答案停留到主动评分
- 背面层级徽章：🎓 Core·深度掌握 / 📖 Reading·阅读识别 + 拆解等级；展开更多含学习目标
- 例句中文点按显示（默认隐藏）；生词点查气泡（本地词库→英英词典→离线发音）
- 阅读辅助：OpenDyslexic 字体（本地打包）、句首字母加粗、行距 1.9
- 假搭配过滤（in academic research / pattern or effect / different / academic use of / evidence or data / under conditions）
- 美化：3D 鼠标倾斜（触屏关闭）、翻面星光、评分 emoji 爆发、🔥 连击系统（3 连卡面闪光）
- 音效：翻纸声、和弦+高音、连击音阶、切页 whoosh、主题琶音
- 低性能模式：自动检测（≤2GB 内存或 ≤4 核）+ 手动 自动/开/关；尊重 prefers-reduced-motion

### Phase 4 · 例句翻译
- `data/i18n/templates.json`：18 个模板句式（槽位 {m} 替换释义首段，形容词性首段自动去"的"）
- `data/i18n/example_zh.json`：831 条逐句翻译 sidecar（记录源句，build 时校验，语料改句后翻译自动失效）
- `scripts/build_data.py`：sidecar 优先 → 模板替换 → 空串，写入 `exampleZh` 字段
- 覆盖：Core 3000/3000 + Reading 1745/2000 = 4745 条

### Phase 5 · 部署
- sw.js 缓存版本 v0.5，fonts 纳入预缓存
- README：Cloudflare Pages（推荐，国内可访问）+ GitHub Pages 双方案部署文档
- 决策：暂不做按字母分块（全局检索场景多、风险高；brotli + SW 缓存已覆盖主要收益）

### Phase 6 · 学习数据
- 导出/导入 JSON 备份（设置面板；导入校验结构后恢复；导出重置提醒计时）
- 每周备份轻提醒（完成页，7 天一次）
- 完成页未来 7 天到期复习预报（D+1 … D+7）
- 每日目标新增 20 / 30 轻量档（保留 50/75/100）

## 验证记录

- 6 主题计算值探测：变量与关键元素样式全部随主题切换
- 4 tab 交互模拟：词库页双容器切换、构词地图 90 组渲染正常
- 卡片全链路模拟：翻面→评分→连击 🔥x2→点词气泡（本地中文义）→点按翻译显示/隐藏
- 假搭配过滤：模板搭配不渲染；整体记忆词中性提示生效
- 数据完整性：5000 条、19 字段、words.js 结尾合法、exampleZh 4745 条
- 翻译抽检：逐句翻译自然通顺；形容词槽位"心理因素"式表达正确

## 待办（后续）

1. 真实 iOS Safari 实机测试（safe-area、TTS 音量、PWA 安装）
2. Reading 255 条唯一例句翻译（等 Reading QA）
3. Core 2176 条模板例句重写为真实例句（语料层大工程，重写后旧翻译自动失效，机制已就绪）
4. IPA draft 校订
5. 学习历史日历热力图（原 roadmap）
6. 错词本直接打开词卡（原 roadmap）
