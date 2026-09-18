# Monument Valley「曲柄之章」复刻

按参考视频 `demo1.mp4`（576×1280@30fps）像素级复刻第一章曲柄关：
three.js r128（`vendor/`）单页实现，无构建步骤。

## 本地试玩

```bash
node tools/serve.js          # 起本地服务（默认 8123 端口）
# 打开 http://localhost:8123
```

拖动右侧曲柄旋转机关 → 长臂摆到悬臂搭接 → 点击路面让 Ida 走上祭坛通关。

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
node shot2.js                # 三态截图 init/f3/dock → shots/v9/
node play2.js                # 端到端：拖拽→停靠→Ida 过桥→通关
```

### 3. Python 分析工具链（逆向/拟合/对比脚本）

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

### 5. 视觉对比

```bash
.venv/bin/python tools/make_comparisons.py    # 生成 shots/v9/accept_final.png + init diff 像素数
```

## 验收基线

- init 态转子零可见（diff 仅雪花噪声，<400px）
- f003 姿态：长臂 az161 从拱廊后伸出；臂宽与参考一致（扫描线均 50px）
- dock：臂面与悬臂齐平、圆头短杆位于拐角下方
- 端到端：顺时针拖拽停靠、Ida 过桥通关
- 整幅对比图：`shots/v9/accept_final.png`（左=复刻，右=参考）

## 工具链地图（tools/）

| 类别 | 脚本 |
|---|---|
| 服务/截图/端到端 | `serve.js` `shot2.js` `play2.js` `diag.js`（Chromium 路径解析见 `chrome.js`，可用 `CHROME_PATH` 覆盖） |
| 帧序列/掩膜 | `extract_frames.sh` `dump_static.py` `rotortrace.py` `rotorx.py` `zoomgrid.py` |
| 轴扫描/拟合（缝安全） | `rotorgrid4.py` `rank_f3v2.py` `verify_final.py` `orbit_table.py` `make_comparisons.py` |
| 历史存档（含已知 bug，勿直接复用） | `rotorsolve*.py`（v3-v9 迭代）、`rotorgrid/2/3.py`（对跖点假交点）、`finalize.py`（b0d 反号）、`probe*.js`（早期硬编码路径） |

逆向工程的完整结论、标定数据与死路清单见 [CLAUDE.md](CLAUDE.md)。
