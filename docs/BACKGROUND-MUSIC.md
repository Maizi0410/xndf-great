# 探索背景音乐接入记录

日期：2026-10-20。本轮只接入用户提供的 `music_001.WAV`；不修改场景、建筑、角色、镜头、谜题或手势逻辑。

## 资产

- 母版：`assets/audio/bgm_exploration.wav`，与原始附件逐字节一致（23,189,804 字节），48 kHz / PCM 16-bit / Stereo / 120.78 秒。
- 母版 SHA-256：`0b40cec5ec6d933af3d5efb11ce2e8aab3f9d67f24bf552bf66439cba2c812bc`。
- 发布：`public/audio/bgm_exploration.mp3`，256 kbps MP3，3,866,924 字节；约比 WAV 减少 83%。不引入新 npm 依赖。
- 发布 SHA-256：`19ab6da9b48a82e70ab734a86f61ab604dd3270a480b1aa1e587ad715327cffa`。
- 编码信息与校验值：`public/audio/bgm_exploration.json`。MP3 容器时长约 120.816 秒（含编码填充），实际解码播放时长由浏览器验证。
- 母版位于 public 以外，不进入 Pages 和 `.app`；发布资源通过 `new URL('audio/bgm_exploration.mp3', document.baseURI)` 读取，兼容 `/xndf-great/` 与 `permitted://world/`。无外链/CDN。

## 播放与设置

进入标题页不创建 AudioContext，也不播放/请求音乐；点击现有「进入界限」时在用户操作栈内解锁 AudioContext，待本地 MP3 读取解码后开始 2 秒淡入。首次冷加载仍有文件获取与解码延迟，不承诺未缓存时零延迟出声。默认独立音乐增益 0.35。

探索、旋转、对齐、凝结、人物行走和镜头变化都不调用音乐重启。保留原有环境噪声与操作音效；唯一的背景音乐是用户提供的这首。移除原有结局合成和弦序列，终点仅让此音乐 3 秒淡出并停止。静音再恢复不会重启结局音乐。「重新开始」或「再看一次」会从原曲开头开始新一局。

复用原「声 ON/OFF」总静音，音乐旁边的「乐」滑块仅调整背景音乐音量（不改变音效）。音量与静音通过 `permitted-audio` 保存到 localStorage，失败时仍可正常玩；改变音量/静音用 120 ms 增益过渡。

本项目没有独立暂停按钮，本轮不新增游戏操作。音乐跟随现有 `document.hidden` 游戏暂停、`pagehide` / `pageshow`：记录偏移、停止并释放当前音乐 source，恢复时从相同位置续播，不从头开始。保留同一 AudioContext 和解码 buffer。浏览器自行中断/冻结 AudioContext 时，音频时钟由浏览器冻结；必要时可通过现有声音按钮再次解锁。

## 循环处理与边界

原始 WAV 头部前 100 ms RMS 约 -52.44 dBFS，120.53 秒附近的 100 ms RMS 约 -12.70 dBFS；尾部回到接近零并不代表音量/乐句天然首尾匹配。未经人工试听不将其标记为天然无缝。

只在内存中把解码音频最后 0.75 秒与最初 0.75 秒进行余弦权重交叉淡化：首次从 0 秒播放，之后从交叉淡化末尾接到 0.75 秒位置。原曲中段不裁剪，首尾以短重叠合并；母版和磁盘 MP3 均保持不变。使用一个 sample-clock `AudioBufferSource`、`loopStart` / `loopEnd` 实现，不使用 setTimeout 拼接、不启动第二条音乐，也不会因多个加载回调叠加音乐 source。

自动验证会覆盖真实自然循环和离线渲染接缝的波形连续性，但不能代替人耳确认乐句衔接、音量下降、耳机/扬声器听感。短重叠可能仍可听出曲式回环，需要人工决定是否调整。

## 验收记录

- 类型检查通过；单元测试 **47 项通过 / 6 文件**，其中新增音频专项 14 项。
- 网页与桌面生产构建均通过；压缩音乐字节与源文件一致，两个产物都不含 WAV 母版。
- 原有场景、镜头、角色、谜题、手势和三张参考图均未修改。
- 本地 Chromium 浏览器最终回归 **8 项全部通过（6.8 分钟）**，含原4项与新增4项音频专项。实际等待120.78秒自然循环；用真实解码 buffer 跨边界离线渲染，检查双声道无长静音/异常采样跳变。此为数值验证，不是人耳试听结论。
- 完整五次鼠标跨越中 `starts=1`、活动音乐 source 为1；通关后停止，重开后从头播放。音量/静音保存、加载失败仍能完成第一段跨越均实际通过。
- 模拟浏览器 visibility 通知，真实 AudioContext 暂停和原位置续播通过；不等同于真实 Safari / macOS 系统切后台验证。
- Linux Electron 生产产物离线测试 **通过**：重载前屏蔽 HTTP(S)/WebSocket，本地 MP3 实际解码播放；五次跨越、单源连续播放与结尾停止成功，外部请求0，本地合成视频推理也通过。
- 首次 Pages 运行 `39404692207` 的构建与全部浏览器测试通过，部署到线上后最后校验失败：站点实际返回 `audio/mp3`，而新增校验只允许 `audio/mpeg`。实际文件 HTTP 200、SHA-256 与本地一致。修正校验接受这两种 MP3 类型并保留强校验，不修改游戏或音频文件；最终成功记录见下文。
- 首轮完整通关已观测到音乐结尾停止；测试随后误点结局遮罩下的声音按钮，主动中断并修正测试操作。不为测试更改结局遮罩或游戏交互，最终以重跑完整结果为准。

待人工试听：默认音量与原音效比例；首尾乐句及交叉淡化；2 秒淡入与 3 秒结尾淡出；Mac Safari / Chrome 自动播放与切后台；课堂 Mac 离线播放、实际扬声器与耳机输出。


## 发布验证

- GitHub Pages **已成功**：[运行 39406157991](https://github.com/guoanze550-commits/xndf-great/actions/runs/39406157991) 的 build / deploy / live validation 全部通过；实际 HTTPS 版本为 `4d56508`，包含本次 MP3 的 HTTP/MIME/SHA-256 校验。
- 原生 Apple Silicon Mac **已成功**：[运行 39404692221](https://github.com/guoanze550-commits/xndf-great/actions/runs/39404692221) 构建新的有声 `.app`，ASAR 中 MP3 与清单校验通过且不含 WAV 母版；打包应用屏蔽网络后的音乐解码、连续五次跨越和结尾停止通过。此为 CI 音频图/时钟验证，不是物理扬声器试听或课堂 Mac 首次安装。
- [下载本次新 Artifact](https://github.com/guoanze550-commits/xndf-great/actions/runs/39404692221/artifacts/12256654195)；内层 ZIP：`The-Permitted-World-0.2.2-classroom-macOS-Apple-Silicon-arm64.zip`，SHA-256：`bb5e0d34856a1af26da0c44c712f69510091aee90c6e998b306e9aef003521ff`。登录 GitHub 下载外层 Artifact 后再解开内层 ZIP；保留30天。

## 本轮修改文件清单

- `assets/audio/bgm_exploration.wav`、`assets/audio/README.md`：原始母版与来源/编码说明。
- `public/audio/bgm_exploration.mp3`、`public/audio/bgm_exploration.json`：本地发布音频、参数与校验值。
- `src/game/background-music.ts`、`src/game/audio.ts`：单源循环、淡入淡出、暂停续播、设置持久化，与已有音效模块衔接。
- `src/main.ts`、`src/style.css`：仅音频生命周期接线与音量控件；无世界更新、摄影机、谜题或手势逻辑更改。
- `scripts/prepare-assets.mjs`、`scripts/verify-bundle.mjs`、`scripts/test-offline-electron.mjs`：资源校验、ASAR音乐完整性、实际离线播放验收。
- `.github/workflows/deploy-pages.yml`：保留原流程，增加线上 MP3 MIME/校验值验证。
- `tests/audio.test.ts`、`tests/e2e/music.spec.ts`、`tests/e2e/journey.spec.ts`：新增音频专项与连续通关集成断言。
- `README.md`、`docs/CLASSROOM.md`、`docs/BACKGROUND-MUSIC.md`、`docs/CLASSROOM-DOWNLOAD.md`、`docs/WEB.md`：入口、操作说明、当前产物链接与本轮真实验收。


## 实际交付入口

- 试玩：https://guoanze550-commits.github.io/xndf-great/
- 游戏与音频源提交：[adb61b4](https://github.com/guoanze550-commits/xndf-great/commit/adb61b48a518e29dc048406d2edb6c470a3c5e56)。
- 部署校验修复：[4d56508](https://github.com/guoanze550-commits/xndf-great/commit/4d565081e0149c84a910d3bfbba26a5bee3b227c)。
- 原生 Mac 对应音乐源提交 `adb61b4`；网页最终部署对应 `4d56508`（仅增加 MIME 兼容校验修复及记录）。两提交之间 `src/`、`assets/audio/`、`public/audio/` 与 Electron 内容完全一致。后续文档提交不改变游戏与音频。
- 本次已直接通过 HTTPS 读取实际页面版本及 MP3，HTTP 200、类型 `audio/mp3`、字节数和 SHA-256 与本地一致；另以 GitHub 官方 API 核对原生 Mac 运行成功、Artifact 存在且未过期。Pages 的最终 HTTPS 校验也由新 Actions 运行通过。
- 交付链接更新涉及 `docs/CLASSROOM-DOWNLOAD.md`、`docs/WEB.md`、`README.md` 与本说明；不触发新的游戏构建。

补充的公网 Chromium 冒烟尝试在打开页面时被云代理证书 `ERR_CERT_AUTHORITY_INVALID` 阻塞，未进入游戏，未计入通过数；未关闭 TLS 验证。上述8项为本地/CI Chromium 的真实回归，通过的公网验证为实际 HTTPS 资源/版本校验。Safari与课堂设备仍待实测。
