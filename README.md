# Monument Valley「曲柄之章」复刻

按参考视频 `demo1.mp4`（576×1280@30fps）复刻第一章曲柄关：three.js r160 ESM
（`vendor/three/three.module.js`）单页实现，无构建步骤。
渲染方案为真等轴测 + 按世界法线选色的平面着色（源自 `fable/` 的逐像素实测实现；
早前的正交标定版存在系统性结构偏移，已于 2026-09-24 退役，见 [CLAUDE.md](CLAUDE.md)）。

## 本地试玩

用**相对路径本地 three.js**，必须通过 HTTP 打开（不要双击用 `file://`，ES module / importmap 会失败）。

```bash
node tools/serve.js          # 默认 8123；可传端口：node tools/serve.js 9000
```

| 版本 | 地址 |
|---|---|
| 主版（完整曲柄关） | http://localhost:8123/ |
| fable 5.1（主版的实现来源） | http://localhost:8123/fable/ |

拖动右侧转轮旋转机关 → 竖臂摆到 +z 与小平台连成一线 → 点击路面让 Ida 走上终点平台通关
（结尾：镜头上移、极光幕布与章节标题）。

> 本地开发与 GitHub Pages 布局一致：同一静态根目录、相对路径资源。详见 [DEPLOYMENT.md](DEPLOYMENT.md) §3.1。

## 环境复刻（新设备 clone 后）

仓库只含源码与参考视频；帧序列、截图、python 依赖等中间产物按下述步骤再生。

### 1. 游戏运行（仅需 Node）

```bash
node tools/serve.js
```

### 2. 截图 / 自动化验证（Node + Chromium）

```bash
cd tools && npm ci           # 安装 playwright-core（有 package-lock.json）
npx playwright install chromium   # 下载匹配的浏览器；或设 CHROME_PATH 指向本机 Chrome
                             # chrome.js 已自动探测 macOS/Windows/Linux 缓存目录
node shot2.js                # 三态截图 init/mid/dock → shots/v2/（hash 参数确定性设态）
node play2.js                # 端到端：拖拽→90°吸附停靠→艾达通关→章节标题
node e2e_check.js            # 专项：pointercancel/构件上锁定曲柄/原地重置
node autocheck.js            # 自动演示按钮：全流程+重置后可重启
node ctxprobe.js             # resize 跟随 + WebGL 上下文事件探测
```

### 3. Python 分析工具链（逆向/拟合/对比脚本，旧标定版存档）

```bash
python3 -m venv .venv && source .venv/bin/activate   # Windows: py -m venv .venv
pip install -r tools/requirements.txt                # numpy scipy pillow
```

### 4. 再生成分析中间产物

```bash
bash tools/extract_frames.sh          # frames/ 39帧 + frames_dense/ 118帧（需 ffmpeg）
.venv/bin/python tools/dump_static.py     # staticmask.npy + staticedt.npy（静态蓝色掩膜/距离场）
.venv/bin/python tools/rotortrace.py      # rotortrace.npy（全帧方位角射线测度）
.venv/bin/python tools/orbit_table.py     # 轨道对照表（stdout）
```

> 注意：`dump_static.py` / `rotortrace.py` 需在**项目根目录**执行（脚本内部按相对路径读 `frames/`）。
> 这些脚本服务于**旧正交标定版**（已退役），保留作为逆向工程档案。

## 验收基线（现行版）

- 与视频帧对比：建筑主体区域结构性差异占比 ≈26%（与 fable 持平；旧标定版为 37%，
  差异算法：difference→boxblur6→阈值25，余项为雪花随机位/视频压缩噪声/曲柄状态差）
- init：长臂藏于横梁内延续至立柱；dock：竖臂摆到 +z 与小平台连成一线（接缝视错觉）
- 端到端：顺时针拖拽 → 90° 吸附停靠 → 艾达沿行走链（含两处视错觉接缝）通关 → 章节标题浮现
- 三态截图：`shots/v2/`（init / mid / dock，hash 参数确定性复现）
- 行走穿模门禁 `walkcheck.js` 已随旧版退役（新引擎为参数化路径，无逐边穿模问题）

## 工具链地图（tools/）

部署：见 [DEPLOYMENT.md](DEPLOYMENT.md)（GitHub Pages 双路径方案：`/` 完整版、`/fable/` fable 版）。

| 类别 | 脚本 |
|---|---|
| 服务/截图/端到端 | `serve.js` `shot2.js` `play2.js` `diag.js`（Chromium 路径解析见 `chrome.js`，可用 `CHROME_PATH` 覆盖） |
| 现行回归门禁 | `play2.js`（端到端）`e2e_check.js`（中断/锁定/重置）`autocheck.js`（自动演示）`ctxprobe.js`（resize/上下文） |
| 旧版存档 | `walkcheck.js`（已退役，旧版逐边射线断言）`probe*.js` `rotorsolve*.py` 等逆向工具链 |
| 帧序列/掩膜 | `extract_frames.sh` `dump_static.py` `rotortrace.py` `rotorx.py` `zoomgrid.py` |
| 轴扫描/拟合（缝安全） | `rotorgrid4.py` `rank_f3v2.py` `verify_final.py` `orbit_table.py` `make_comparisons.py` |

逆向工程的完整结论、标定数据与死路清单见 [CLAUDE.md](CLAUDE.md)。
