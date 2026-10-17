# 网页版部署与体验

网页版复用现有《界限》游戏，**不需要下载 DMG，也不需要 Electron**。本次只增加网页构建与 GitHub Pages 工作流，未改游戏规则、场景或桌面构建工作流。

## HTTPS 入口

目标站点：**https://guoanze550-commits.github.io/xndf-great/**

只有仓库已启用 Pages 且部署成功后，该地址才是可用游戏入口。当前云环境没有公开端口的分享工具，且网络策略阻止访问 GitHub API 和该 Pages 域名；在外部访问被放行前，不能把目标地址标记为已上线或已验证。

## 首次启用（仓库所有者只需做一次）

1. 打开 [仓库 Pages 设置](https://github.com/guoanze550-commits/xndf-great/settings/pages)。
2. 在 **Build and deployment → Source** 选择 **GitHub Actions**。
3. 打开 [网页部署工作流](https://github.com/guoanze550-commits/xndf-great/actions/workflows/deploy-pages.yml)。首次提交工作流会自动触发；如果当时尚未启用 Pages，选择 **Run workflow → main** 重试。
4. 等待 `build` 与 `deploy` 都成功，点击部署环境 `github-pages` 提供的 HTTPS 链接。

`GITHUB_TOKEN` 可以部署已启用的 Pages，但不能首次启用站点；这是 GitHub 官方 configure-pages action 的权限约定。此工作流无需个人访问令牌或 Apple 签名凭据。如仓库有部署审批规则，按现有规则完成该次部署审批。

后续对游戏源码、模型或网页配置的 `main` 提交会自动部署。Electron 的 `Build Apple Silicon Mac` 工作流保持手动触发，不会因网页版部署而构建 DMG。

## 已实现的路径处理

- `npm run build:web` 输出独立的 `dist-web/`，Vite base 为 `/xndf-great/`。
- 原桌面构建仍使用 `npm run build`、`dist/` 和 `./`，不受网页子路径影响。
- 手势资源仍通过 `new URL('vision/', document.baseURI)` 加载。Pages 上模型地址为 `/xndf-great/vision/hand_landmarker.task`，WASM 地址位于 `/xndf-great/vision/wasm/`。
- 模型随源码保存；全部 JS/WASM 变体从锁定 npm 依赖复制到网页产物，不依赖运行时 CDN。
- 冰、建筑、人物、水、雪、贴图和声音使用现有程序化实现；字体是系统字体，没有需要修补的外部素材 URL。
- 页面 CSP 保留，只允许同源资源与必要的 WASM 执行。
- 工作流仅上传 `dist-web/`，不发布源代码、node_modules、Electron 二进制或构建缓存。

## 在 Mac 浏览器体验

用最新 Safari 或 Chrome **直接打开 HTTPS 入口**，点击「进入界限」即可使用鼠标；浏览器需要支持 WebGL 2 和 WebAssembly。不要通过 `file://` 直接打开构建后的 HTML。

鼠标拖到 −60°，等 I—II 冰路形成后确认；到 II 后再拖到 +60°，等待旧路消失、新路形成，确认后到 III。人物通行时旋转锁定。按钮与流程和桌面版一致。

首次点击「启用手势」时，浏览器才会请求摄像头权限。Safari 可在该网站的设置中检查摄像头权限，Chrome 可在地址栏的网站设置中检查；macOS 系统也可能要求为浏览器授权摄像头。拒绝后仍能完整使用鼠标通关。

摄像头视频仍只在本机处理，不上传、不录制。真实 Mac 摄像头与 Safari/Chrome 的实际权限弹窗、手势识别精度尚需设备测试，不能用合成视频测试替代。

网页版需要网络完成首次页面和资源加载；没有新增 Service Worker，不承诺断网刷新或首次离线打开。模型和推理均在浏览器内执行，不依赖外部 API。

## 验证方式与当前边界

```bash
npm ci
npm run typecheck
npm test
npm run build:web
npx playwright install chromium
PLAYWRIGHT_BASE_URL=http://127.0.0.1:4175/xndf-great/ \
PLAYWRIGHT_SERVER_COMMAND='npm run preview:web -- --port 4175 --strictPort' \
npm run test:e2e
```

云端有系统 Chromium 时附加 `CHROMIUM_PATH=/usr/bin/chromium`。macOS 也可以直接执行 `npm run preview:web` 做本机预览。

网页工作流先验证类型、规则、子路径下的真实鼠标 A→B→C 与结局、摄像头拒绝降级、模型 SHA-256、六个 JS/WASM 文件的字节与 MIME、本地 MediaPipe 对合成视频的实际推理；通过后才上传并部署。部署后还检查实际 HTTPS 页面、构建脚本/样式、模型 SHA-256 和 WASM MIME。

这些自动检查不代表真实 Safari、Mac 摄像头或低性能设备已验证。实际公网部署状态必须以 Actions 和对站点的真实访问结果为准。

## 常见部署问题

| 现象 | 处理 |
| --- | --- |
| `configure-pages` 报没有 Pages site / 404 | 在 Settings → Pages 选择 GitHub Actions 后重新运行工作流 |
| 地址 404 | 检查 `deploy` 是否成功，并使用带 `/xndf-great/` 的完整路径 |
| JS、模型或 WASM 404 | 检查构建步骤是否为 `build:web`，上传目录是否为 `dist-web`，不能上传根目录或桌面 `dist` |
| 游戏显示但不能启用摄像头 | 确认 HTTPS、浏览器和 macOS 摄像头授权；关闭占用摄像头的程序；可继续用鼠标 |
| 无法从 Codex 检查 Actions / 站点 | 环境网络需允许 `api.github.com` 和 `guoanze550-commits.github.io`；可在环境设置保存相关网络配置，并发布环境用于后续任务 |
