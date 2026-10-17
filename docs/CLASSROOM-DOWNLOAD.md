# 从 GitHub 下载课堂 Mac ZIP

本地备份 ZIP 仍保存在云端，但课堂交付优先使用 GitHub Actions 的 Artifact，不依赖聊天附件预览。

1. 登录 GitHub，打开 [Build classroom Mac ZIP](https://github.com/guoanze550-commits/xndf-great/actions/workflows/build-classroom-mac.yml)，选择对应提交的运行。
2. 找到运行页下方 **Artifacts → The-Permitted-World-Classroom-Mac-Apple-Silicon-arm64**，点击下载。
3. 解开 GitHub 的外层 ZIP，再解开里面以 `classroom-macOS-Apple-Silicon-arm64.zip` 结尾的包；其中包含 `.app`、中文说明及资源许可。
4. 可对照同一 Artifact 中的 `SHA256SUMS.txt` 核对内层 ZIP。Artifact 默认保存 30 天；过期后可 Run workflow 重新构建。

工作流先在原生 ARM64 Mac 上构建，检查应用架构、离线资源、ad-hoc 签名与 ZIP，然后上传；之后单独测试屏蔽网络下的鼠标完整通关。若 GUI 测试失败，已经生成的 ZIP 仍可下载，运行会显示失败，不能把“文件存在”当作“启动测试通过”。`classroom-runtime-validation` Artifact 提供独立的自动测试记录。

运行编号、实际 Artifact ID / 链接、源提交与测试结果会自动写入仓库独立的 `classroom-build-status` 分支 `latest.json`。该分支只记录非秘密交付状态，不修改 `main` 游戏文件；用于云端 GitHub API 被拦截时，仍可通过 Git 读取实际构建结果。

文件名含 `UNVERIFIED-crossbuild` 的旧 ZIP 是 Linux 交叉构建备份；虽然已验证可以解压、含 arm64 `.app` 和完整离线资源，仍不代表真实 Mac 安装或摄像头已经通过。

构建使用 GitHub 当前官方 ARM64 runner 标签 `macos-15`。更新的运行会替代旧运行，状态分支不会被较旧运行的迟到结果覆盖。
