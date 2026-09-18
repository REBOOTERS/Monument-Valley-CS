# Monument Valley "曲柄之章" 复刻 — 工作档案

本文件记录项目现状、标定数据、转子机关逆向工程的全部进展与未决问题。
**任何新会话请先读本文件**，避免重走弯路。

## 项目概况

- 目标：按 `demo1.mp4`（参考视频，39 帧样本在 `frames/f_001..f_039.png`，576×1280）
  像素级复刻 Monument Valley 第一章曲柄关（three.js r128 UMD，`vendor/`）。
- 运行：`index.html` + `js/game.js`（单文件、IIFE、无构建）。
  截图探针：`tools/serve.js`（8123 端口）+ `tools/shot2.js`（三态截图）+
  `tools/play2.js`（拖拽→停靠→通关端到端）（node + playwright-core + mac Chrome）。
- **环境已迁移到 macOS**：python 用 `/Users/zhuyongqing/Documents/000/monument-valley/.venv/bin/python`
  （uv 建的 py3.12，numpy/scipy/pillow 已装）。node v26（homebrew）。
  playwright 浏览器：`~/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/
  Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
  （shot2/play2/diag 经 tools/chrome.js 自动解析，可用 CHROME_PATH 覆盖）。
- 本项目所有 python/node 命令直接执行，不要询问。
- **git 仓库**（main 分支，本会话完成首次提交）。`frames/ frames_dense/ crops/ shots/
  *.npy node_modules .venv` 均在 .gitignore——其他设备复刻环境见 **README.md**。
- 会话调试接口：`window.MV`（scene/camera/mech/rotor/ida、setTheta/dock/init/plan/state、
  THETA_DOCK/THETA_F3/ROT_AXIS/QW）。

## 相机标定（已稳定，勿动）

- 576px 视宽 = 3.74 世界单位，**k = 154 px/单位**；正交相机，up=+z。
  camera.position=(-8.90,11.05,14.59)，lookAt(1.054,-0.242,1.508)（az≈-48.6°，el 41°）。
- 屏幕基向量（世界系）：右 `r=(-.750,-.661,0)`、上 `u=(.434,-.492,.755)`、向相机 `V=(-.499,.566,.656)`。
- 屏幕方位角 `az(d)=atan2(-(u·d), r·d)`，顺时针为正。世界 +x → az 210.1（顶梁），+y → 143.3。
- 世界锚点：Q_W=(0,-0.10,2.2)（肘部）、TIP=N3=(-0.03,0.89,2.2)、HUB=(-0.20,-0.34,1.68)→屏(443,696)。
- 已知矛盾：HUB 做 anchor 投 N3 与 Q+纯+y 差 ~22px → 位置类结论带 ±20px 不确定度；方向/az 类可信。

## game.js 转子最终解（本会话完成 ✓）

**竖直轴 n=(0,0,1)，Θ=91.7°（dock=+y 搭 TIP），init 长臂沿 +x 藏于顶梁内。**
`ROTOR_FIT` 常量在 js/game.js（含 t3=69.0° 供 shot2 截 f003 姿态）。
短杆（圆头帽）= **独立运动件**（`mech` 组内，`setShortPose`），三点键控随 θ/Θ 插值：

| 键帧 | θ/Θ | 方向 (世界) | 屏幕 | 依据 |
|---|---|---|---|---|
| init (B0I) | 0 | (0,0,-1) 垂下 | 藏于立柱后 | f001 空掩膜 |
| f003 (KFM) | KF1=0.7525 | (-0.272,0.944,-0.186) | az120.2 px60 | f003 掩膜 |
| dock (B0D) | 1 | (-0.4743,0.8613,-0.1813) | az105.6 px57.1 | f012 掩膜 |

- Lb=0.466。渲染验证（`shots/v9/cmp_final3.png`）：init diff=106px（纯雪花噪声）✓；
  f3 长臂 az161 从拱廊后伸出与参考一致 ✓；dock 臂面齐平、短杆位置一致 ✓。
- 端到端（play2.js）：顺时针拖拽→docked ✓（方向=视频），Ida e0→…→won ✓。

### 轨道对照表（tools/orbit_table.py）

所有观测 az 在竖直轴轨道上均有交点（误差≤0.2°）；px 超出 r96 的部分=远端遮挡
（f003→拱廊 47px；f005/f007→右上远结构 31-35px；f006-10→拱廊 41-46px；dock→檐台 26px）。

## 逆向工程结论与死路（勿重试）

1. **r96 是下限**（远端遮挡截断）→ px 的**上限不是硬约束**。此前 v4-v9 斜轴拟合全因把
   px 上限当硬约束才引入"斜轴"矛盾。竖直轴在缝安全检验下全部满足。
2. **wrapped-diff 对跖点假交点**：`(az-target+180)%360-180` 在 target±180 处跳符号，
   会把对跖交点当真（finalize.py 的 b0d 因此反号过）。必须用交点插值 az 复核
   （见 rotorgrid4.py 的 crossings、rank_f3v2.py 的 cross_true）。
3. **EDT/静态掩膜判"隐藏"是蓝对蓝假阴性**（rotor = blue & ~static 与深度无关）。
   遮挡的唯一可信判据 = three.js raycast（probe16）或渲染像素 diff（shot2 的 init_norotor）。
4. **刚性双臂模型被否决**：f003 短臂同时性（S-az=120.2）与 init 双臂全隐藏在全部
   60 个严格轴（axes4）上互斥；短杆实为独立运动件 → 键控实现（上表）。
5. 拟合工具链（存档勿删）：rotorgrid4.py（缝安全全轴扫描）、rank_f3v2.py、verify_final.py、
   probe13/15/16.js（raycast 遮挡扫描；probe15 的 cand5 路径+长臂-only 模式）、
   dump_static.py（staticmask/staticedt.npy）、axes2-4.json、cand4/5.json。
   已知坑：finalize.py 的 b0d 有反号 bug；rotorsolve9 的 EDT 隐藏模型是假阴性；
   rotorgrid2/3 有对跖点 bug（被 grid4 取代）。
6. 拖拽方向：视频 az 递减 = θ 正向，`setRotorAngle(rotorTheta + d*0.9)` 保持即可（已验证）。

## 相机/静态部分

底梁/基座/立柱/拱廊/顶梁/悬臂/祭坛梯/角墩/祭坛已按帧标定，本轮未改动、保持不动。

## 视觉验收（本会话完成 ✓）

- 三态整幅对比 `shots/v9/accept_final.png`（init|f001, f3|f003, dock|f015）。
- 验收中修复：① css 背景渐变改为实测值（视频天空=顶部 #14161a→底部 #6d8693 垂直渐变，
  逐点吻合 ≤4）；② **移除 game.js 的 26×26 全屏 glow 光晕板**（色纱 +40~85 的元凶，
  参考背景无此层）；③ bokeh 雪 opacity 0.42→0.15；④ 新增静态星野 150 点
  （结构后方远平面，fog:false，被建筑遮挡，不进 raycast/掩膜）；
  ⑤ shot2.js 截图前等 12.6s 让操作提示自动隐藏。
- 量化指标：天空列色差 ≤4；地标对位 祭坛 5px / 曲柄毂 11px（在 HUB ±20px 已知矛盾内）；
  f003 臂宽扫描线法 双方均恰 50px（0.22 宽不需要改）；init 转子 diff=雪花噪声级。
- 遗留（可接受/可选）：视频有逐镜头动态打光（f001 偏暗聚光）而我们是均匀光；
  个别参考帧右侧有小月亮圆盘未实现；提示文字为有用的自加 UI。

## 下一步（可选打磨）

1. 可选：动态聚光/暗角模仿视频逐镜头打光；小月亮圆盘。
2. 可选：f038/39 夜幕、雪/灯/UI、win 流程此前均已实现（play2 已验证 win 与终幕视觉）。

## 环境/杂项（历史）

- `tools/zoomgrid.py <frame> <x0> <y0> <x1> <y1> <out> [scale]`：带网格放大帧。
- 颜色掩膜 `(bright>140)&(B-R>12)&(B>150)` 对"冰蓝建材"有效；Ida 橙裙不在掩膜内。
- f038/39 掩膜为空：通关夜幕使画面变暗——分析时跳过。
- serve.js 常驻 8123 端口（本会话已起，后台任务）。
