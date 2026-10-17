# V2.0 验收记录

日期：2026-10-18。V1 历史记录继续保留；本页仅对应 V2 增量升级。

| 项目 | 实际证据 |
| --- | --- |
| V1 回退 | 已推送 `v1.0-stable`，对应 `5c788cedaaf2996f9755e3f6a59f0f9c772aa242` |
| 原始参考图 | 1672×941；SHA-256 `6565c82eb0920961c79146e87d1651b962b5436e3fdc9641c36e7eea85395c06`；原文件未改动 |
| 类型检查 | `npm run typecheck` 通过 |
| 单元测试 | `npm test`：20 项通过。包含 4 种视口投影、方向/可达性误导、实际遮挡射线、视角变化拒绝、五段连续路径、通行锁定、旧路撤销、各安全节点恢复、微小手势偏差、闭合倒角几何与保留的手势过滤测试 |
| 生产构建 | 网页 `build:web` 和 Electron `build` 均实际成功；本地模型校验通过 |
| Linux Chromium 网页回归 | 最终版本本地 3 项通过（约 3 分钟），GitHub Actions build 也通过：摄像头拒绝后真实鼠标拖动完成五次跨越与重开；两个误导状态拒绝；子路径模型 SHA-256、6 个 JS/WASM 与 MIME；合成视频实际推理 |
| Linux Electron 离线回归 | 生产 dist 在重载前屏蔽全部 HTTP(S)/WebSocket；五段鼠标通关与本地合成视频推理通过，外部请求 0 |
| 网页部署 | **已部署并实测线上资源**：[运行 39049874611](https://github.com/guoanze550-commits/xndf-great/actions/runs/39049874611) 的 build、deploy、live validation 全部 success；线上版本核对为 `925a2f3150fe0f6cc9e0fe0c272f01114f1ac096` |
| 原生 Mac V2 ZIP | **已实际生成**：[原生 ARM64 Mac 运行 39049874566](https://github.com/guoanze550-commits/xndf-great/actions/runs/39049874566) 的 build、package validation、offline runtime 全部 success；[Artifact 12106789164](https://github.com/guoanze550-commits/xndf-great/actions/runs/39049874566/artifacts/12106789164) |
| 性能 | 已发现初版新增反射的开销并优化水面网格、反射刷新与阴影；最终同条件 Chromium SwiftShader 对照：1440×1000，DPR 0.65，预热 5 帧后采样 30 帧；V1 平均 140.8 ms / 中位 139.9 ms，V2 平均 175.6 ms / 中位 166.8 ms。相对首轮 V2 的 280.8 ms 降低约 37%；相对 V1 仍增加约 25% 帧耗时，不能标为实机性能通过。软件渲染数据不能代表实际 Mac / Windows 帧率 |
| 真人手势 / 摄像头 | 未实测；模型、识别阈值与稳定窗口保留，机构切换仅重建控制基准 |
| Safari / Windows / 课堂 Mac | 未实机验收；课堂设备首次解压、安全提示和物理断网仍需测试 |
| 视觉错觉与游玩时长 | 已检查浏览器截图及数值连续性；跨缝遮挡观感、真人初见时长仍需人工验收 |

执行命令：`npm run typecheck`、`npm test`、`npm run build:web`、`npm run build`、子路径下的 `npm run test:e2e`、`npm run test:offline`。浏览器与桌面证据保存在当前工作区的 `test-results/`，不把缓存与生成文件提交到源代码仓库。

发布以 Actions 的成功结果为准：网页的独立 `web-deploy-status` 分支记录真实运行号和线上校验结果；Mac 的 `classroom-build-status` 分支记录真实 Artifact ID 和原生离线验证结果。网页线上 `build-info.json` 的源提交须与构建源提交一致。


## 已核实的交付入口

- 游戏：**https://guoanze550-commits.github.io/xndf-great/**
- V2 游戏源提交：[925a2f3](https://github.com/guoanze550-commits/xndf-great/commit/925a2f3150fe0f6cc9e0fe0c272f01114f1ac096)。之后仅更新交付记录的文档提交不重建同一份游戏。
- Mac 内层 ZIP：`The-Permitted-World-0.2.0-classroom-macOS-Apple-Silicon-arm64.zip`
- ZIP SHA-256：`3823a2b4ea4729ea064d24b1277bf6c2129565b8e66daf16bd460addb28b55ba`

本云端直接请求 Pages 域名仍被代理拒绝（CONNECT 403）；线上可用性依据 GitHub Actions 中真实执行的 HTTPS 请求、提交号匹配和资源校验，非本地预览推断。成功结果已由独立状态分支实际读取。原生 Mac CI 的自动启动与断网通关不等于课堂 Mac 首次安装或真实摄像头验收。
