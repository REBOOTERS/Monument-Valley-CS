# GitHub Pages 部署方案（双版本路径）

> 本文档为可复用的部署方案。2026-09-18 更新：fable 版 three.js **改为本地加载**（不再依赖 CDN），部署时必须一并发布 `vendor/`。  
> 执行状态：**未执行**（手动启用步骤见 §4）。

## 1. 目标架构

仓库根 = 站点根（Deploy from branch：`main` / `(root)`），两个路径对应两个版本：

| URL | 内容 | three.js |
|---|---|---|
| `https://rebooters.github.io/Monument-Valley-CS/` | 当前完整版（竖直轴转子 + 穿模修复） | 本地 `vendor/three.min.js`（r128 UMD） |
| `https://rebooters.github.io/Monument-Valley-CS/fable/` | fable 5.1 版本（ESM 单页） | 本地 `fable/vendor/three/three.module.js`（r160 ESM） |

两版均**不依赖外网 CDN**，避免 jsDelivr 超时/被墙导致白屏。

## 2. 前置条件（已核验，2026-09-18）

- [x] 远程仓库存在且本地同步：`git@github.com:REBOOTERS/Monument-Valley-CS.git`
      （origin/main = 本地 main；SSH key `~/.ssh/id_ed25519` 可用，此前推送成功）
- [x] 主版本资源引用全部为**相对路径**（`css/` `vendor/` `js/`），天然支持
      GitHub Pages 的 `/仓库名/` 子路径前缀，无需改代码
- [x] fable 版 `index.html` 经 importmap 引用**相对路径**
      `./vendor/three/three.module.js`（约 1.2MB，已纳入仓库），
      与主版一样依赖 Pages 原样发布 `vendor/`，**必须**配合 `.nojekyll`
- [ ] Pages 未启用（当前访问 404）——需执行 §4 手动步骤
- 备注：本机未安装 gh CLI、无 API token，凡涉及仓库设置的操作均需网页手动完成

## 3. 代码侧步骤（可直接复制）

```bash
cd /path/to/Monument-Valley-CS

# 1) 目录名即 URL 路径：规整为 /fable/
#    改名后相对路径 ./vendor/three/three.module.js 仍有效（vendor 跟 index.html 同树）
git mv fable-5.1-version fable

# 2) 跳过 Jekyll 处理，确保 vendor/（含 three.min.js / three.module.js）原样发布
#    不加 .nojekyll 时，Jekyll 可能忽略或改写静态资源，导致 three.js 404、页面白屏
touch .nojekyll

# 3) 确认本地 three 文件存在（缺一不可）
test -f vendor/three.min.js \
  && test -f fable/vendor/three/three.module.js \
  && echo "three.js local OK" || echo "MISSING three.js — abort deploy"

# 4) 提交并推送（含本地标签）
git add -A
git commit -m "部署：fable 改本地 three.js，规整 /fable/ 路径，加 .nojekyll"
git push origin main
git push origin v1.0 v1.1   # 标签不会随 git push 默认推送
```

顺带更新（可选）：README 加「在线访问」小节、CLAUDE.md 记录部署方式。

### 3.1 fable 版 three.js 约定（重要）

| 项 | 说明 |
|---|---|
| 引用方式 | `index.html` 内 `<script type="importmap">` → `"three": "./vendor/three/three.module.js"` |
| 文件位置 | `fable/vendor/three/three.module.js`（three@0.160.0 ESM build） |
| 禁止 | 再改回 `cdn.jsdelivr.net` / `unpkg.com` 等外链（部署环境可能拉不到） |
| 本地预览 | 必须用 HTTP 静态服务打开（ES module + importmap 不支持 `file://`） |

本地预览示例：

```bash
# 主版
node tools/serve.js          # http://localhost:8123/

# fable 版（任选一种静态服务）
cd fable && python3 -m http.server 8081
# 打开 http://localhost:8081/
```

## 4. 需要手动做的一步（无法脚本化）

仓库网页 → **Settings → Pages** → Source 选 **Deploy from a branch**
→ Branch 选 `main` / `(root)` → **Save**。约 1 分钟后生效。

## 5. 验证

```bash
# HTTP 状态
curl -sI https://rebooters.github.io/Monument-Valley-CS/       | head -1   # 期望 200
curl -sI https://rebooters.github.io/Monument-Valley-CS/fable/ | head -1   # 期望 200

# three.js 静态资源必须可访问（否则页面能开但 WebGL 起不来）
curl -sI https://rebooters.github.io/Monument-Valley-CS/vendor/three.min.js \
  | head -1   # 期望 200
curl -sI https://rebooters.github.io/Monument-Valley-CS/fable/vendor/three/three.module.js \
  | head -1   # 期望 200
```

浏览器再确认：打开 `/` 与 `/fable/`，DevTools → Network 中 three 相关请求应为**同源相对路径**，状态 200，无 CDN 域名。

本地行为不受影响（目录改名 + `.nojekyll` + 已有本地 three）；如需回归可跑 `node tools/shot2.js`。

## 6. 坑与备注

- **私有仓库**：GitHub Free 的 Pages 仅支持 public 仓库；若仓库为 private，
  需先转 public（Settings → General → Danger Zone）或升级 Pro
- **Jekyll / `.nojekyll`**：Pages 默认经 Jekyll 处理；不加 `.nojekyll`，
  `vendor/` 等目录可能无法按原路径提供，fable 的 ESM three 会 404
- **尾斜杠**：`/fable`（无斜杠）会被 Pages 自动重定向到 `/fable/`，无需处理
- **路径深度**：fable 的 importmap 使用 `./vendor/...`（相对当前 HTML），
  部署在 `/Monument-Valley-CS/fable/` 下无需再写仓库名前缀
- **体积**：fable 的 `three.module.js` ≈ 1.2MB，需纳入 git 跟踪；
  勿加入 `.gitignore`，否则 Pages 上缺文件
- **发布范围**：站点发布仓库全部跟踪文件，含 `tools/` 分析脚本、`CLAUDE.md`、
  `demo1.mp4`（444K）——公开仓库本就可见，无敏感信息
- **改版流程**：日后改代码 → `git push origin main` → Pages 自动重新发布
  （首次启用后无需再动设置）
