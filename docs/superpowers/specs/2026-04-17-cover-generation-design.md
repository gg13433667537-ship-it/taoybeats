# Cover Generation（翻唱/参考音频）功能设计文档

**日期**: 2026-04-17
**功能**: Cover Generation（翻唱/参考音频）
**优先级**: P2

---

## 1. 功能概述

### 1.1 核心价值
用户上传参考音频，AI学习其风格，生成相似风格的新音乐。

### 1.2 用户流程

```
在生成页面 → 展开"高级选项"
    ↓
上传参考音频 或 选择平台曲库
    ↓
AI学习风格 → 生成新音乐
```

---

## 2. UI设计

### 2.1 高级选项面板

```
音乐生成页面 - 高级选项
┌─────────────────────────────────────────────┐
│  高级选项                                  │
├─────────────────────────────────────────────┤
│                                             │
│  参考音频（可选）:                           │
│  ┌─────────────────────────────────────┐  │
│  │                                     │  │
│  │      📁 点击上传音频                  │  │
│  │      或选择平台曲库                   │  │
│  │                                     │  │
│  │      支持 mp3, wav, m4a             │  │
│  │      时长：6秒-6分钟                 │  │
│  │      大小：≤50MB                    │  │
│  │                                     │  │
│  └─────────────────────────────────────┘  │
│                                             │
│  已选择: music_reference.mp3  [移除]        │
│                                             │
│  💡 上传后AI会学习这个音频的风格，         │
│     生成风格相似的新音乐                     │
│                                             │
└─────────────────────────────────────────────┘
```

### 2.2 组件结构

| 组件 | 职责 |
|------|------|
| `AdvancedOptions` | 高级选项折叠面板 |
| `ReferenceAudioUploader` | 参考音频上传组件 |
| `ReferenceAudioSelector` | 平台曲库选择器 |

---

## 3. API对接

### 3.1 使用参考音频生成

**端点**: `POST /v1/music_generation`

**请求**:
```typescript
interface CoverGenerationRequest {
  model: 'music-cover'     // 使用cover模型
  prompt: string           // 风格描述
  reference_audio?: string // 参考音频URL或Base64
  reference_audio_id?: string // 参考音频file_id
  lyrics?: string          // 歌词
  is_instrumental?: boolean
  stream?: boolean
  output_format?: 'url' | 'hex'
  audio_setting?: {
    sample_rate: 44100
    bitrate: 256000
    format: 'mp3'
  }
  aigc_watermark?: boolean
}
```

### 3.2 上传参考音频

**端点**: `POST /v1/files/upload`

```typescript
// 参考音频需要先上传获取file_id
interface UploadReferenceRequest {
  file: File              // 音频文件
  purpose: 'reference_audio'
}
```

---

## 4. 限制说明

| 限制项 | 说明 |
|--------|------|
| 时长 | 6秒 - 6分钟 |
| 文件大小 | ≤50MB |
| 格式 | mp3, wav, m4a |
| 版权 | 用户需确认拥有参考音频的版权 |

---

## 5. 实现文件清单

| 文件路径 | 职责 |
|----------|------|
| `src/app/api/music/cover/route.ts` | 翻唱生成API路由 |
| `src/components/AdvancedOptions.tsx` | 高级选项组件 |
| `src/components/ReferenceAudioUploader.tsx` | 参考音频上传组件 |

---

## 6. 依赖关系

- 依赖现有音乐生成页面
- 作为可选参数，不影响默认歌词模式
