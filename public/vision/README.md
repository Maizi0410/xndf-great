# 本地手势资源

`hand_landmarker.task` 为本仓库随应用再分发的本地任务包，SHA-256 与原始模型来源见 `manifest.json`。

原始模型来自 Google 官方 `@mediapipe/hands@0.4.1675469240`，Apache-2.0。保留原始网络与权重，仅按原图像预处理图的 `[0,1]` 浮点范围添加新版 MediaPipe Tasks 必需的 NormalizationOptions（mean=0, std=255）。再以标准 ZIP task 格式组合两个 TFLite 文件。修改声明及许可证见 `third-party/`。

普通构建只验证已提交任务包，并从锁定的 `@mediapipe/tasks-vision` 复制 WASM；不下载任何模型、不调用 Python。`scripts/build-hand-model.py` 是维护者重新生成任务包的可选工具，需要独立 Python 3.11 环境中的 tflite-support==0.4.4、flatbuffers==25.2.10、numpy==2.2.6。原始包完整性由 package-lock.json 的 npm SRI 校验，脚本另行校验原始模型 SHA-256。

归一化依据：
- https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/modules/palm_detection/palm_detection_cpu.pbtxt
- https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/modules/hand_landmark/hand_landmark_cpu.pbtxt

WASM 目录为构建产物，执行 `npm run assets` 生成；会整体打入生产目录和应用 ASAR。运行时不使用 CDN。真实手部识别精度仍须以实际摄像头验收。
