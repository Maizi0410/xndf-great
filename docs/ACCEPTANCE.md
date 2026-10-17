# 0.1.0 验收记录

验证环境：Linux x64 云环境，Node 24.19.0，系统 Chromium + SwiftShader，以及实际 Electron 44.9.0（headless Linux）。这份记录不代表 Mac 实机已验收。

| 要求 | 当前真实结果 |
| --- | --- |
| 鼠标从开始完整通关 | **通过**：Playwright 真实拖拽/点击完成 A→B→C、结局、重新开始 |
| 真实摄像头手势输入接入 | **已接入**：MediaPipe Hand Landmarker、getUserMedia、原生权限桥；实际真人摄像头识别**未验证** |
| 冰路与游戏规则一致 | **通过**：12 项状态机/手势过滤测试；包含切换互斥、道路锁定、错误路径、完整流程、连续任意输入 |
| 摄像头失败后继续游玩 | **通过模拟拒绝测试**：随后鼠标完整通关；macOS TCC 拒绝实测**未验证** |
| 离线资源正确打包 | **通过**：生产目录和真实 ARM64 app.asar 内的 HTML 引用、任务包 SHA-256、全部 JS/WASM 变体检查；完整鼠标流程拒绝任何外部请求 |
| TypeScript / 生产构建 | **通过**：npm ci、typecheck、12 项测试、vite build；重新安装后复验成功 |
| 本地 MediaPipe 模型确实运行 | **通过**：浏览器与真实 Electron 安全本地协议内，加载模型并对合成摄像头视频进行推理，正常报告无手 |
| GitHub Actions 配置并实际执行 | **已配置，实际执行未验证**：GitHub API 请求被当前环境拒绝；尚未上传或触发工作流 |
| DMG 真正生成 | **未生成**：当前 Linux 无法完成 macOS DMG 构建；macOS workflow 中已配置 |
| DMG 为 ARM64 | **未验证**：没有 DMG；但已交叉生成真实 `.app` 目录，并通过 Mach-O 头与 `file` 确认为 arm64 |
| 实际 Mac 启动 | **未验证**：仅 Linux Electron 启动通过；CI 配置了打包后 Mac 冒烟测试，尚未执行 |
| 摄像头真实设备 | **未验证**：合成视频仅证明模型加载、预处理、推理和本地资源链路 |
| 另一台 Mac 下载、安装 | **未验证** |
| 当前签名、公证 | **未签名、未公证**：Linux 交叉构建明确跳过签名；内部 DMG 工作流配置 ad-hoc 签名，正式分支预留 Developer ID 与公证 |
| 最低 macOS 版本 | **配置为 13.0**，符合 Electron 44 官方支持范围；最低版本实机**未验证** |
| 美术与体验质量 | **原创可运行首版**：程序化石质建筑、人物、水雪、冰路、灯光和声音已实现；电影级最终美术及 3–5 分钟玩家体验时长**尚未用户验收** |

## 执行过的关键命令

```bash
npm ci --no-audit --no-fund
NODE_USE_ENV_PROXY=1 electron_config_cache=/tmp/xndf-electron npx --no-install install-electron
npm run typecheck
npm test
npm run build
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
npm run test:desktop
```

端到端测试 3 项：完整鼠标旅程与拒绝摄像头后的降级、本地资源完整性、实际 MediaPipe 合成视频推理。`test-results/` 包含标题、两次道路许可、结局与桌面截图，为本地验证产物。

Linux 上额外执行了（只生成目录，未生成 DMG）：

```bash
NODE_USE_ENV_PROXY=1 ELECTRON_CACHE=/tmp/xndf-electron \
ELECTRON_BUILDER_CACHE=/tmp/xndf-builder-cache XDG_CACHE_HOME=/tmp/xndf-cache \
CSC_IDENTITY_AUTO_DISCOVERY=false npx --no-install electron-builder \
  --mac --arm64 --dir --publish never -c.mac.identity=null -c.mac.hardenedRuntime=false
node scripts/verify-bundle.mjs
```

输出 `.app` 在 `release/mac-arm64/`，属于未经 Mac 启动验证、未签名的交叉构建产物，不能作为正式发行版提供给普通用户。`verify-bundle` 验证了 arm64 Mach-O、860 个 ASAR 条目内的所需离线资源、模型校验、JS/CSS 相对引用、Bundle ID 与摄像头用途声明。`verify:mac` 还要求原生 ARM64 macOS，并增加 lipo、plutil、hdiutil 检查；当前未在 Mac 执行。

## 后续设备验收（请填写真实结果）

| 设备 / 系统 | 下载来源 | 安装与首次启动 | 鼠标通关 | 摄像头允许 / 拒绝 / 重启 | 断网通关 | 退出重开 | 签名 / 公证 / Gatekeeper |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 主测试 Mac | 待填写 | 未验证 | 未验证 | 未验证 | 未验证 | 未验证 | 未验证 |
| 第二台 Mac | 待填写 | 未验证 | 未验证 | 未验证 | 未验证 | 未验证 | 未验证 |

不要将“工作流文件已写好”改写成“Actions 已成功运行”，也不要将 Linux 的架构和资源检查改写成“Mac 安装已通过”。正式发布步骤见 README。
