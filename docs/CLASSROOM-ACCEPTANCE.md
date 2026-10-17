> 以下为 **V1 / 0.1.0 历史记录**，保留用于稳定版回退；不是 V2 验收或 V2 下载证明。当前结果见 [V2-ACCEPTANCE.md](V2-ACCEPTANCE.md)。

# 课堂交付验收记录

本次仅整理现有《界限》的课堂说明、ZIP 打包与验证，没有修改游戏源码、规则或场景，也没有修改原有 Pages / DMG 工作流。目标为课堂展示，Apple Developer ID、公证和 App Store 不作为本次完成条件。

| 项目 | 实际结果 |
| --- | --- |
| TypeScript / 规则测试 | **通过**：类型检查、12 项已有规则与手势过滤测试 |
| 网页构建 | **通过**：`build:web` 输出 `/xndf-great/` 子路径，模型与全部 WASM 同源本地加载 |
| 网页鼠标完整通关 | **通过（Linux Chromium）**：真实鼠标完成 A→B→C、结局、重开；拒绝摄像头后继续通关 |
| 网页资源 | **通过**：模型 SHA-256、全部 6 个 JS/WASM 文件的字节和 MIME；无外部资源请求的鼠标流程 |
| 网页实际部署 / 公网访问 | **未验证**：当前云端代理拒绝连接 GitHub API 与 Pages 域名，未取得站点实际 HTTP 响应，无法读取部署状态 |
| Mac / Windows 真实浏览器 | **未验证**：当前只在 Linux Chromium 执行；建议课前用课堂电脑检查 Safari / Chrome / Edge |
| 本地版基础启动 | **通过（Linux Electron / macOS ARM64 CI）**：Mac 成功运行 39046168262 使用实际打包 `.app`，加载安全本地协议、生产资源和模型；课堂实机仍待验证 |
| 本地版屏蔽网络后通关 | **通过（Linux Electron / macOS ARM64 CI 打包应用）**：重载页面前屏蔽全部 HTTP、HTTPS、WebSocket；鼠标完整 A→B→C、结局和本地模型合成视频推理；课堂电脑物理断网仍待实测 |
| MediaPipe 合成视频 | **通过**：网页与 Electron 中实际加载任务包、WASM 并执行推理，正常报告没有手 |
| 真人摄像头 / 系统权限弹窗 | **未验证**：自动测试使用合成帧和模拟权限响应，不代表真实设备 |
| ARM64 `.app` 资源 | **通过静态检查**：本轮独立交叉构建到 `release-classroom/mac-arm64/`；arm64 Mach-O、ASAR HTML/JS/CSS、模型 SHA-256、6 个 JS/WASM 文件和摄像头声明均在 |
| 本地 ZIP 实际生成 | **原生 Mac ZIP 已生成并上传 Artifact 12106205558**；旧 `UNVERIFIED-crossbuild` 备份也仍保留，实际解压、ASAR 字节、执行位、14 个框架符号链接及资源检查通过 |
| 原生 Mac 课堂 ZIP / Actions | **已通过**：[运行 39046168262](https://github.com/guoanze550-commits/xndf-great/actions/runs/39046168262)，源提交 `324a79f`。原生构建、签名与 ZIP 校验、Artifact 上传及打包应用离线自动通关均成功 |
| Mac 安装 / 启动 / 物理断网 | **CI 打包应用启动已通过；课堂设备未验证**：首次安全提示、另一台 Mac 下载解压及物理断网运行仍需课前实测 |
| Developer ID / 公证 / App Store | **非本次课堂目标**；原可选发行配置保留，不需要提供相关账户或密钥 |

## 本轮执行命令

```bash
npm run typecheck
npm test
npm run build
npm run test:desktop  # Linux 云端将 XDG_CONFIG_HOME / XDG_CACHE_HOME 指向可写临时目录
npm run test:offline
npm run build:web
PLAYWRIGHT_BASE_URL=http://127.0.0.1:4175/xndf-great/ \
PLAYWRIGHT_SERVER_COMMAND='npm run preview:web -- --port 4175 --strictPort' \
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
```

测试脚本为 Linux 云端使用独立可写缓存，在首屏加载完成后重载并测试网络屏蔽；游戏代码未因此修改。原生 Mac 工作流不会使用 Linux headless 或 no-sandbox 参数。

本轮额外在 Linux 执行 `electron-builder --mac --arm64 --dir`，指定独立输出 `release-classroom` 并跳过 Mac 签名，然后运行 `node scripts/package-classroom-mac.mjs --cross-build`。这是交叉构建备份，不可据此把 Mac 安装标为通过。原生课堂构建请使用 `npm run classroom:mac` 或 GitHub Actions。

本地生成目录不提交到 GitHub。`release-classroom/classroom-verification.json` 和 `SHA256SUMS.txt` 记录实际 ZIP 的名称、字节大小、架构、资源检查与校验值；自动离线测试记录在 `test-results/classroom-offline.json`。

## 课堂验收补记

| 演示机器 | 日期 | 网页打开 | 鼠标通关 | `.app` 解压与启动 | 断网重开并通关 | 真人手势（可选） |
| --- | --- | --- | --- | --- | --- | --- |
| Apple Silicon Mac / macOS：待填 | 待填 | 未测试 | 未测试 | 未测试 | 未测试 | 未测试 |
| Windows / 浏览器：待填 | 待填 | 未测试 | 未测试 | 不提供 Windows 本地版 | 不适用 | 未测试 |

课堂步骤及入口见 [CLASSROOM.md](CLASSROOM.md)。网页若尚未启用，请在仓库 Settings → Pages 选择 GitHub Actions，并运行现有网页部署工作流；当前记录不声称该操作已经完成。

更新：2026-10-17，已通过独立 Git 状态分支读取真实 Actions 结果与 Artifact ID；即使云端 API 仍被拦截，原生 Mac 构建结果已确认。精确下载入口及 SHA-256 见 [CLASSROOM-DOWNLOAD.md](CLASSROOM-DOWNLOAD.md)。
