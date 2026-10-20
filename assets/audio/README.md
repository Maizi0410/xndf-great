# 探索背景音乐母版

`bgm_exploration.wav` 为用户上传 `music_001.WAV` 的原始字节副本，48 kHz / PCM 16-bit / Stereo / 120.78 秒。未编辑、未归一化、未改变内容。此目录不在 Vite public 或 Electron 的打包 files 中。

网页和桌面只播放 `public/audio/bgm_exploration.mp3`，256 kbps CBR MP3（约 3.87 MB），同源本地加载，无 CDN。由 FFmpeg/libmp3lame 编码：

```sh
ffmpeg -i assets/audio/bgm_exploration.wav -map_metadata -1 -codec:a libmp3lame -b:a 256k -ar 48000 public/audio/bgm_exploration.mp3
```

原始与压缩文件 SHA-256 见 `public/audio/bgm_exploration.json`。运行时只在解码缓冲末尾做 0.75 秒余弦交叉淡化，混入开头并循环至 0.75 秒；第一次保留原始开头。仅一个循环 source，不增加另一首音乐、不按关卡或镜头重启。母版和磁盘 MP3 不做循环裁剪。

来源为本项目用户提供；不据此声明第三方音乐的授权或公共领域身份。
