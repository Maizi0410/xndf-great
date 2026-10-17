# V2 / 0.2.0 课堂 Mac ZIP

- [成功运行 39049874566](https://github.com/guoanze550-commits/xndf-great/actions/runs/39049874566)
- [下载 Artifact 12106789164](https://github.com/guoanze550-commits/xndf-great/actions/runs/39049874566/artifacts/12106789164)
- 内层 ZIP：`The-Permitted-World-0.2.0-classroom-macOS-Apple-Silicon-arm64.zip`
- SHA-256：`3823a2b4ea4729ea064d24b1277bf6c2129565b8e66daf16bd460addb28b55ba`

本次源提交 `925a2f3`。原生 ARM64 Mac 的应用构建、ad-hoc 签名/资源/ZIP 校验、上传以及屏蔽网络后的五段鼠标通关和本地模型合成视频推理均成功。登录 GitHub 下载外层 Artifact，解开后再解开内层 ZIP，运行 `.app`。真实课堂电脑首次安全提示与真人摄像头尚未实测。Artifact 保留 30 天，可通过原有工作流重新生成。

---

> 以下为 **V1 / 0.1.0 历史记录**，保留用于稳定版回退；不是 V2 验收或 V2 下载证明。当前结果见 [V2-ACCEPTANCE.md](V2-ACCEPTANCE.md)。

# 从 GitHub 下载课堂 Mac ZIP

本地备份 ZIP 仍保存在云端，但课堂交付优先使用 GitHub Actions 的 Artifact，不依赖聊天附件预览。

## 已成功生成的课堂包（2026-10-17）

- [成功的 Actions 运行 39046168262](https://github.com/guoanze550-commits/xndf-great/actions/runs/39046168262)
- [直接进入 Artifact 下载](https://github.com/guoanze550-commits/xndf-great/actions/runs/39046168262/artifacts/12106205558)
- Artifact：`The-Permitted-World-Classroom-Mac-Apple-Silicon-arm64`
- 内层 ZIP：`The-Permitted-World-0.1.0-classroom-macOS-Apple-Silicon-arm64.zip`
- 内层 ZIP SHA-256：`8a0d689f37b96848d5381812c6e56493e82f806b3965719256c90aca6362ecf5`

该次运行在 `macos-15` ARM64 runner 上通过原生构建、应用与本地模型/WASM 检查、ad-hoc 签名验证、ZIP 解压校验，以及打包应用屏蔽网络后的鼠标 A→B→C 和结局测试。本地模型使用合成视频完成实际推理；真实摄像头、课堂 Mac 首次安装与系统安全提示仍未实测。

请登录 GitHub 下载；Artifact 保留期为 30 天。下载后的外层 Artifact ZIP 还需解压一次，才会看到上述内层课堂 ZIP。

1. 登录 GitHub，打开 [Build classroom Mac ZIP](https://github.com/guoanze550-commits/xndf-great/actions/workflows/build-classroom-mac.yml)，选择对应提交的运行。
2. 找到运行页下方 **Artifacts → The-Permitted-World-Classroom-Mac-Apple-Silicon-arm64**，点击下载。
3. 解开 GitHub 的外层 ZIP，再解开里面以 `classroom-macOS-Apple-Silicon-arm64.zip` 结尾的包；其中包含 `.app`、中文说明及资源许可。
4. 可对照同一 Artifact 中的 `SHA256SUMS.txt` 核对内层 ZIP。Artifact 默认保存 30 天；过期后可 Run workflow 重新构建。

工作流先在原生 ARM64 Mac 上构建，检查应用架构、离线资源、ad-hoc 签名与 ZIP，然后上传；之后单独测试屏蔽网络下的鼠标完整通关。若 GUI 测试失败，已经生成的 ZIP 仍可下载，运行会显示失败，不能把“文件存在”当作“启动测试通过”。`classroom-runtime-validation` Artifact 提供独立的自动测试记录。

运行编号、实际 Artifact ID / 链接、源提交与测试结果会自动写入仓库独立的 `classroom-build-status` 分支 `latest.json`。该分支只记录非秘密交付状态，不修改 `main` 游戏文件；用于云端 GitHub API 被拦截时，仍可通过 Git 读取实际构建结果。

文件名含 `UNVERIFIED-crossbuild` 的旧 ZIP 是 Linux 交叉构建备份；虽然已验证可以解压、含 arm64 `.app` 和完整离线资源，仍不代表真实 Mac 安装或摄像头已经通过。

构建使用 GitHub 当前官方 ARM64 runner 标签 `macos-15`。更新的运行会替代旧运行，状态分支不会被较旧运行的迟到结果覆盖。
