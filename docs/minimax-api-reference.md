# MiniMax API Reference

> 重要：所有 API 调用必须查阅此文档确认功能是否真正支持。

## 音乐生成

- **音乐生成**: https://platform.minimaxi.com/docs/api-reference/music-generation

## 歌词生成

- **歌词生成**: https://platform.minimaxi.com/docs/api-reference/lyrics-generation

## 语音 T2A (Text-to-Speech)

- **T2A HTTP**: https://platform.minimaxi.com/docs/api-reference/speech-t2a-http
- **T2A WebSocket**: https://platform.minimaxi.com/docs/api-reference/speech-t2a-websocket
- **T2A Async Create**: https://platform.minimaxi.com/docs/api-reference/speech-t2a-async-create
- **T2A Async Query**: https://platform.minimaxi.com/docs/api-reference/speech-t2a-async-query

## 声音克隆

- **上传音频**: https://platform.minimaxi.com/docs/api-reference/voice-cloning-uploadclone
- **上传提示词**: https://platform.minimaxi.com/docs/api-reference/voice-cloning-uploadprompt
- **克隆声音**: https://platform.minimaxi.com/docs/api-reference/voice-cloning-clone

## 声音设计

- **设计声音**: https://platform.minimaxi.com/docs/api-reference/voice-design-design

## 声音管理

- **获取声音**: https://platform.minimaxi.com/docs/api-reference/voice-management-get
- **删除声音**: https://platform.minimaxi.com/docs/api-reference/voice-management-delete

---

## 待查阅确认的功能

### 音乐生成相关
- [x] AI 水印 - ✅ 已实现 (aigc_watermark参数)
- [x] 参考音频 - ✅ 已实现 (music-cover模式下audio_base64参数)
- [ ] 混音 (remix) - ❌ 不支持，需第三方服务
- [ ] 延长版/续写 (extend) - ❌ 不支持
- [ ] 分离声部 (stems/vocals separation) - ❌ 不支持，需使用Demucs/LALAL.AI

### 歌词相关
- [x] 智能歌词生成 - ✅ 已实现 (lyrics_optimizer参数)
- [ ] 外部AI歌词 - ❌ 不支持

### 音色模板
- [ ] 内置音色模板 - ❌ 不支持

### UI中显示但API不支持的功能（即将推出）
- [ ] 音色相似度 (timbre_similarity) - MiniMax API不支持
- [ ] 混音模式 (mix_mode) - MiniMax API不支持
- [ ] 混音人声音量 (mix_mode_vocal_volume) - MiniMax API不支持
- [ ] 参考歌词 (reference_lyrics) - MiniMax API不支持
