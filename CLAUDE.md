# Monument Valley "曲柄之章" 复刻 — 工作档案

本文件记录项目现状、标定数据、转子机关逆向工程的全部进展与未决问题。
**任何新会话请先读本文件**，避免重走弯路。

## 2026-09-24 根版重建：迁移到 fable 等轴测引擎（现行实现）✓

**背景**：像素 diff 热力图证实旧正交标定版（下文"相机标定/转子最终解"等章节
描述的实现）与参考视频存在**系统性结构偏移**——楼梯/祭坛/顶梁/底梁整体错位，
建筑主体区域结构性差异占比 37%；而 `fable/` 的实现与视频仅有边缘级差异（26%）。
旧版"标定"自洽但整体错误（按错误锚点反解了相机与几何），已整体退役
（代码见 git 历史，逆向工具链保留在 tools/ 作档案）。

**现行实现**：根 `index.html` + `js/main.js`（ESM 入口，importmap 引
`vendor/three/three.module.js` r160）= fable 引擎 + 主版增强。**模块化结构**
（2026-09-25 拆分，行为与拆分前逐像素一致；桌面尺寸 1280×800 vs fable diff
仅 0.48% = 月亮/雪片/按钮等刻意增强项）：

```
js/main.js              入口/装配：引擎+章节注册表+玩法+UI+调试接口（window.MV/#参数）
js/game.js              玩法状态机（通用「曲柄+行走链」型章节）：state/update/输入语义/演示/重置
js/core/engine.js       渲染器/正交相机/resize/主循环（onUpdate/onRender 注册制）/上下文丢失事件
js/core/materials.js    facetMaterial（法线选色）/PAL 调色板/box
js/core/chain.js        行走链数学：buildChain（seam/needsRotor/rotorEnd/stairs 标记）/posAt/可达性
js/core/ida.js          艾达模型
js/core/sky.js          背景层：天空渐变/柔光/月亮/星点/极光（月亮等配置来自章节）
js/core/fx.js           前景层：点击涟漪/虚化雪片
js/core/ui.js           提示显隐闩（12s 真实时间）/章节标题/按钮 a11y
js/core/input.js        指针事件归一（坐标换算/capture/cancel）
js/chapters/chapter1.js 第一章内容 + 章节编写指南（新章节照接口实现并注册 main.js 的 CHAPTERS 表）
```

- **视觉机制 = fable 原样**：真等轴测相机（CAM_TARGET 使原点落在视频 (175,766)、
  CAM_HALF_H 锁竖直视高，全窗口自适应无 letterbox）；facetMaterial 按世界法线
  选色；行走链 + 两处"seam"视错觉接缝；曲柄绕 x 轴、θ≈-π/2 连接、松手吸附 90°；
  艾达站构件上曲柄锁定缩回；结尾镜头上移 + 极光 + 章节标题。
- **相对 fable 的增强**（均不改变机制观感）：pointercancel/指针捕获恢复、悬停
  grab 光标、hint 12s 真实时间闩（dtRaw 累加）、THREE 加载失败与
  webglcontextlost/restored 兜底、小月亮+虚化雪片（视频中有）、涟漪按视频调参
  （删 fable 杜撰的尘埃气泡与红色无效涟漪）、按钮 a11y、原地重置、自动演示按钮。
- **MV 调试接口**：`window.MV` = {THREE,scene,camera,renderer,ida,rotor,crank,
  camState,TOTAL,GOAL,ROTOR_RANGE,getTheta,setTheta,dock,init,go,reset,hubScreen,
  appOffset,hideHint,showHint,state}。URL hash：#theta/#s/#target/#nohint/#demo/
  #ff=秒（固定步长快进，确定性测试）。
- **接缝/旋转机构调参史（勿重蹈）**：① 拖拽高亮（视频拖拽帧偏白实为臂旋转时
  亮色面片转向相机的自然效果）→ 用户否决"变色"，已删；② 接缝链点"精确配对"
  (2.5,2,-2.0)↔(8.5,8,4.0) → 艾达落在臂端边缘穿模感，已回退 fable 原值
  (2.5,2,-1.7)↔(8.5,8,3.7)。fable 接缝 8px 投影失配是原生特性，用户未再追究。
  **教训：视觉机制层面以 fable 为准不做推断式加戏；验证必须在真实桌面窗口
  尺寸（1280×800）下与 fable 并排 diff，只在 576×1280 下验会漏掉取景类差异。**
- **接缝/旋转机构 = fable 原样（2026-09-25 定稿，用户裁决）**：曾尝试两轮"改进"
  均被用户否决并回退——① 拖拽高亮（视频拖拽帧里曲柄偏白的读法有误：那是臂旋转
  时亮色面片转向相机的自然效果，加 uHi 提亮反而造成"变色/重叠/穿模感"，
  已整体删除）；② 接缝链点"精确配对" (2.5,2,-2.0)↔(8.5,8,4.0)（艾达落在臂端
  边缘产生穿模感，已回退 fable 原值 (2.5,2,-1.7)↔(8.5,8,3.7)，艾达落在臂内 0.3）。
  回退后与 fable 逐像素 diff：结构区域零差异（仅月亮/bokeh/文案等刻意增强项）。
  **教训：视觉机制层面一律以 fable 为准，不做视频推断式加戏；用户以 fable 为
  验收基准。** fable 接缝 8px 投影失配是原生特性，用户未再追究。
- **取景对齐 fable（2026-09-25 二次修正，用户裁决）**：letterbox 竖屏适配、
  暗角、开场压暗全部删除——它们是从旧版沿袭/自行发明的，桌面窗口下使主版
  取景与 fable 完全不同（窄竖条 vs 全窗口自适应），即用户所指"没和 fable 对齐"。
  现 #app 铺满窗口，相机竖直视高固定（与 fable 同），窗口变宽只增两侧天空。
  **教训：视觉验证必须在真实桌面窗口尺寸（如 1280×800）下与 fable 并排 diff，
  只在 576×1280（视频尺寸）下验证会漏掉取景类差异。** 月亮改为世界锚定
  （相对画面中心偏移 242px·S，S=h/1280），任意窗口下贴着结构右侧。
- **量化验收**：与视频帧 t_002 对比（difference→boxblur6→阈值25），建筑主体区
  结构性差异占比 26.1%（fable 同为 26.1%，旧版 37.3%）；余项为雪花随机位、
  视频压缩噪声、曲柄转动状态差（不可归约）。
- **回归门禁**（全部在本机 Windows 跑通）：`shot2.js`（三态截图 hash 确定性设态，
  注意**仅改 hash 不会重载页面**，需加 query 强制刷新）、`play2.js`（拖拽→吸附→
  通关→章节标题）、`e2e_check.js`（pointercancel/构件上锁曲柄/重置 12 断言）、
  `autocheck.js`（自动演示按钮全流程）、`ctxprobe.js`（resize 跟随+上下文事件）。
  `walkcheck.js` 已随旧版退役（新引擎参数化路径无逐边穿模问题）。

## 项目概况（历史，旧正交标定版）

- 目标：按 `demo1.mp4`（参考视频，39 帧样本在 `frames/f_001..f_039.png`，576×1280）
  像素级复刻 Monument Valley 第一章曲柄关。
- ~~three.js r128 UMD，`js/game.js` 单文件~~ → **2026-09-24 起根版为 fable 引擎重建，
  见上方章节**。下文所有"相机标定/转子解/walkcheck"内容均针对已退役的旧实现，
  仅作逆向工程档案保留。
- 截图探针：`tools/serve.js`（8123 端口）+ 现行门禁见上节。
- **环境已迁移**：逆向工程当时在 macOS（路径见下）；当前在 Windows 也已跑通
  （tools/chrome.js 三平台缓存探测，本机 chromium-1243）。
- 本项目所有 python/node 命令直接执行，不要询问。
- **git 仓库**（main 分支）。`frames/ frames_dense/ crops/ shots/
  *.npy node_modules .venv` 均在 .gitignore——其他设备复刻环境见 **README.md**。

## 相机标定（旧版存档，已不再使用）

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

## 已知问题：Ida 行走穿模（v1.0 发现，**已修复**）

**验收为何漏过**：视觉验收只覆盖三个静止机位（init/f3/dock，Ida 在起点）+ 终幕 +
程序状态断言；行走过程无任何视觉采样。现已由 `tools/walkcheck.js` 门禁补上
（逐边射线断言 + 全程截图，行走段纳入回归）。

**修复内容**（walkcheck 189 采样 0 失败，端到端通关 ✓）：
1. **新增拱廊前阶梯**（参考 f_001 隐约/f_017 明确有此网格而我们没建）：
   `stairs(N1→NA)`，NA=(0.846,0.848,1.335)=悬臂根 N2 沿斜面轴反延 0.05。
2. **拱洞窗台 1.42→1.30**：走线过中拱 z1.32-1.37 必须低于窗台，否则穿拱段
   埋进实心墙（walkcheck 实测）。悬臂板改为 NA→N3（根端反延）。
3. **e1 改线 + e1x**：e1=N1→NA（stairs），e1x=NA→N2（走悬臂板顶过拱）。
4. **e4 拆三段**：e4a N4→NB(1.24,0.03,2.23) 沿梁、e4b NB→NC(1.30,0.12,2.30)
   上台阶（梁顶2.2→墩顶2.27 的 0.07 高差，参考 f_025 踏步上墩）、e4c NC→N6
   墩面。原直线斜切悬空+钻墩。
5. **静态对齐**：TL 角墩顶 2.50→2.27（=N6-0.03，参考帧该处无亮顶面带）；
   TR 角墩顶 2.44→2.20 与梁齐平；立柱顶 2.37→2.20（原 N4/N6/e5 起步段埋墩）。
6. **Ida 脚底补偿**：`tilt.position.z=0.02`（原点在身体中部，梁浮/梯沉均 ≤2.8px）。
7. 新节点 NA/NB/NC 已入 EDGES/ADJ/addPick/idaOnArm/MV.N。

**walkcheck 口径备忘**：docked 后必须手动 `updateMatrixWorld`（quaternion 到
渲染才进矩阵，否则射线用旧姿态）；FrontSide 剔除使"从体内/面上发射"的向下
射线假性落空 → 地面射线从腰高发射；体嵌入检验用 +x 射线奇偶法、只查腰部以上
（脚部没入踏步立面是楼梯固有形态）；e2 t≥0.85 TIP 交汇楔豁免（平臂压斜板构造，
参考同构）。

## 2026-09 本轮工程优化（稳定性/性能/体验/打磨，全部验收 ✓）

> 注：本轮最初落在旧正交标定版上；同日晚些时候根版重建为 fable 引擎（见最上方
> 章节），下列增强项已全部重新移植到新引擎（实现方式等价，个别细节以新引擎
> 代码为准：hint 走 style.opacity、月亮画进 bg 2D 层、MV 接口换新语义）。

**稳定性**
- **修复 resize 自锁回归**（dfd2eb4 引入）：`renderer.setSize(w,h)` 默认写内联
  style 覆盖 `#game{width/height:100%}`，此后 clientWidth 永远读旧值、窗口变化
  不再适配。现改 `setSize(w,h,false)` + resize 内重设 pixelRatio（跨 DPI/缩放）。
  验证：viewport 400×800 → canvas 360×800（CSS 锁宽生效）、buffer 同步、
  无内联 style（tools/ctxprobe.js）。
- 拖拽 setPointerCapture + pointercancel → endDrag（状态复位+吸附），
  修复来电/手势接管后拖拽卡死。
- 门控行走锁定曲柄：已排路线尚含 gated 边时 onDown 拒绝拖拽
  （`gateRoutePending`），堵住「Ida 未上门控边但路线将经过」时被拖走踩空的洞。

**性能**
- win 幕布 g>=1 后置 winState=false 停止每帧重建 SVG 路径。
- hint 12s 计时改 levelT 布尔闩。**坑：dt 钳制 0.05 会让低帧率下按 dt 累加的
  计时慢于真实时间（headless 软渲染 ~10fps 时差一倍）——levelT 必须用未钳制
  dtRaw 累加**（clock.elapsedTime 语义的等价物）。
- 悬停 raycast 移入主循环每帧最多一次；rect/毂屏幕坐标 resize 时缓存
  （syncPointerCache + pointerCacheDirty）。
- 涟漪过期 geometry/material dispose；setRotorAngle/updateIda/hubScreen 零分配
  （模块级 _v1.._v4；edgePoint 因 mFrom/mTo 跨帧持有而保持返回新向量）。

**体验**
- 原地重置 resetLevel() 替代 location.reload()（枚举恢复全部可变状态；
  window 派发 `mv:reset` 供 autoplay 取消）。MV 新增 getTheta()/reset。
- autoplay 清理：getTheta() 替代 `2*atan2(q.z,q.w)` 四元数耦合；删重复 dock()；
  settle/watchdog 定时器分离；监听 mv:reset。
- THREE 缺失兜底提示（不再白屏抛异常）；webglcontextlost preventDefault +
  restored 撤销提示（headless swiftshader 实测 lost@~250ms→restored@~1.3s 属
  环境常态，渲染自动恢复）。
- a11y：两圆钮 role/tabindex/Enter/Space 触发；移除 user-scalable=no；
  #game 显式 touch-action:none；标题统一「曲柄之章」。

**视觉（原「下一步」仅剩两项可选项，已完成）**
- 小月亮：参考 t_002 实测圆心 (530,680)、r≈14.5px、中心色 rgb(184,188,195)
  （淡银白，非粉色——小图预览有色觉偏差）。星野同层：anchor+V*12 远平面、
  r/u 屏幕基系定位、CircleGeometry+radialTexture 柔边、fog:false、renderOrder -1。
- 暗角+开场淡入：纯减光 CSS（#app::after 边缘 radial 压暗 0.24；::before
  2.2s 0.32→0 淡出、prefers-reduced-motion 跳过）。不动 3D 灯光不破坏标定色，
  动画结束=像素验收基线。替代「逐镜头动态打光」（单静态视角无意义）。

**Windows 工具链（本机 win32 已跑通）**
- `cd tools && npm install`；chrome.js 已兼容三平台 playwright 缓存目录
  （win=%LOCALAPPDATA%\ms-playwright），本机 chromium-1243/chrome-win64/chrome.exe。
- 新回归门禁：`e2e_check.js`（pointercancel/门控锁定/原地重置 10 断言）、
  `autocheck.js`（autoplay 全流程+通关清态+重置后重启）、`ctxprobe.js`
  （resize 跟随+上下文事件探测）。
- python 逆向管线本机不可用；shot2 四态截图（含月亮/暗角）目视对齐通过，
  walkcheck/play2/e2e_check/autocheck 全绿。

## 环境/杂项（历史）

- `tools/zoomgrid.py <frame> <x0> <y0> <x1> <y1> <out> [scale]`：带网格放大帧。
- 颜色掩膜 `(bright>140)&(B-R>12)&(B>150)` 对"冰蓝建材"有效；Ida 橙裙不在掩膜内。
- f038/39 掩膜为空：通关夜幕使画面变暗——分析时跳过。
- serve.js 常驻 8123 端口（本会话已起，后台任务）。
