<p align="center">
  <img src="docs/img/hero.png" width="680" alt="Roots 5000 手机背单词">
</p>

<h1 align="center">🌸 Roots 5000</h1>
<p align="center">
  手机优先的 IELTS 背单词 PWA · 5000 词根拆解 · 每日复习计划 · 六套可爱皮肤
</p>

<p align="center">
  <a href="https://pipy666.github.io/roots5000-app/"><img src="https://img.shields.io/badge/📱_在线体验-GitHub_Pages-ff6b9d" alt="在线体验"></a>
  <img src="https://img.shields.io/badge/词库-5000_词-ff8fba" alt="词库">
  <img src="https://img.shields.io/badge/例句中文-4745_条-b9a3ff" alt="例句中文">
  <img src="https://img.shields.io/badge/PWA-离线可用-69d7bf" alt="PWA">
</p>

---

## ✨ 功能亮点

- 🃏 **3D 翻转卡**：正面推理（提示不剧透）→ 翻面验证 → 固定评分栏一键评分进下一张
- 🧩 **词根拆解**：前缀/词根/后缀分色显示，拆解可信度分级（✓可靠 / ◇词源关联 / ○整体记忆）
- 📅 **每日计划**：新词目标 20~100 自选，到期复习自动混入（1分钟→10分钟→1天→3天→…→60天 间隔阶梯），🔥 连续打卡
- 🀄 **例句中英对照**：中文翻译点按显示（先自己理解再对答案），4745 条例句已翻译
- 🔍 **生词点查**：点例句里任意单词即时发音 + 词义气泡（本地 5000 词库 → 英英词典 → 离线兜底）
- 📖 **阅读辅助**：单词首字母加粗、大行距、按构词边界分色
- 🎨 **六套主题皮肤** + 动态背景装饰 + 🌙 夜间模式
- 🔊 音效与激励：连击系统 🔥、翻面星光、答对彩带 + 大 emoji 庆祝
- 💾 **数据备份**：导出/导入 JSON，换手机不丢进度；未来 7 天复习预报
- ⚡ 低性能模式自动降级，弱机也流畅

## 🎨 六套主题皮肤

<p align="center">
  <img src="docs/img/themes.png" width="680" alt="六套主题皮肤">
</p>

## 📱 顺手的学习体验

<p align="center">
  <img src="docs/img/features.png" width="680" alt="功能截图">
</p>

## 🚀 部署到手机

### 方案 A：Cloudflare Pages（推荐，国内访问稳定）

1. 把本目录推到 GitHub 仓库
2. Cloudflare 面板 → Workers & Pages → Create → Pages → Connect to Git → 选仓库
3. 构建命令留空、输出目录 `/` → 部署完成得到 `https://xxx.pages.dev`

### 方案 B：GitHub Pages

1. 仓库 → Settings → Pages → Deploy from a branch → `main` → `/ (root)` → Save
2. 访问 `https://pipy666.github.io/roots5000-app/`

### 手机安装（PWA）

- iPhone：Safari 打开网址 → 分享 → **添加到主屏幕** → 全屏运行
- 安卓：Chrome 打开网址 → 菜单 → **安装应用**
- 首次打开点一下屏幕解锁发音；SW 缓存保证首次加载后断网也能学

## 👥 想用自己的词库？（fork 三步，无需装任何工具）

1. **Fork**：点仓库右上角 Fork 按钮，复制到自己账号
2. **改词库**：在网页上编辑 `IELTS_Roots_5000_Master_CURRENT.md`（词条格式见下）——保存后 GitHub Actions 自动重新生成数据并部署，全程不需要 python
3. **开 Pages**：自己的仓库 Settings → Pages → 选 main 分支 → Save，得到专属网址

> ⚠️ Fork 后首次要在自己仓库的 **Actions** 标签页点一次"启用"按钮，自动构建才会跑。

词条**最简格式**（只写三行也能背）：

```markdown
## R0001 · apple  [Core]
- **POS**: n.
- **中文**: 苹果
- **IELTS 阅读式例句**: The apple fell from the tree.
```

完整字段参考现有词条（前缀/词根/拆解/搭配/记忆提示均为可选，不写自动按"整体记忆"处理）。编号 `R0001` 保持唯一递增即可；`[Core]` 与 `[Reading]` 二选一。

## 📦 数据层

- `data/words.js` / `words.json`：5000 词条（Core 3000 + Reading 2000），含 `exampleZh` 例句中文
- `data/i18n/templates.json`：模板句式中英对照（槽位替换，语料改句后自动失效）
- `data/i18n/example_zh.json`：逐句翻译 sidecar（按英文原句校验）
- 重新生成：`python scripts/build_data.py <母词库.md> <data目录>`

## 本地预览

```bash
python -m http.server 8000
```

浏览器打开 `http://localhost:8000/`。直接双击 `index.html` 可用主要功能；Service Worker / PWA 需要 HTTP(S)。

## 📌 已知状态

- 例句中文：Core 3000 全覆盖；Reading 模板句已翻、唯一句待语料 QA 后补
- IPA 仍为 draft 待校订；Reading 例句以"见词识义"为目标
