# Voice Clone（音色克隆）功能设计文档

**日期**: 2026-04-17
**功能**: Voice Clone（音色克隆）
**优先级**: P1

---

## 1. 功能概述

### 1.1 核心价值
让用户克隆自己的声音，然后用这个声音演唱AI生成的歌曲。这是项目的**核心差异化功能**。

### 1.2 用户流程

```
点击"克隆我的声音"
    ↓
选择录音 或 上传音频（二选一）
    ↓
AI克隆声音
    ↓
自动保存到"我的音色"列表
    ↓
生成音乐时选择这个音色
```

---

## 2. UI设计

### 2.1 音色选择器（内嵌生成页）

```
音乐生成页面
┌─────────────────────────────────────────────┐
│  人声音色选择                                │
│  ┌────────┐ ┌────────┐ ┌────────┐        │
│  │系统默认│ │我的音色▼│ │+克隆新音色│        │
│  └────────┘ └────────┘ └────────┘        │
│                                             │
│  ▼ 展开"我的音色"                           │
│  ┌─────────────────────────────────────┐  │
│  │ 🔊 我的声音 #1        [使用] [删除]  │  │
│  │ 🔊 我的声音 #2        [使用] [删除]  │  │
│  │ + 克隆新音色                        │  │
│  └─────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 2.2 克隆弹窗

```
┌─────────────────────────────────────────────┐
│  克隆我的声音                           [X]  │
├─────────────────────────────────────────────┤
│                                             │
│  [上传音频]  [录音]                         │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  上传音频方式:                               │
│  ┌─────────────────────────────────────┐  │
│  │                                     │  │
│  │      📁 点击或拖拽上传音频            │  │
│  │                                     │  │
│  │      支持 mp3, wav, m4a            │  │
│  │      时长：3-8秒                   │  │
│  │      大小：≤20MB                   │  │
│  │                                     │  │
│  └─────────────────────────────────────┘  │
│                                             │
│  💡 提示：请用普通话清晰朗读3-8秒，         │
│     确保环境安静以获得最佳效果               │
│                                             │
│         [取消]     [开始克隆]               │
└─────────────────────────────────────────────┘
```

### 2.3 录音弹窗

```
┌─────────────────────────────────────────────┐
│  录制声音                               [X]  │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐  │
│  │                                     │  │
│  │           🎤                        │  │
│  │                                     │  │
│  │        点击开始录音                  │  │
│  │                                     │  │
│  └─────────────────────────────────────┘  │
│                                             │
│  录音时长: 0:00 / 8秒                      │
│                                             │
│  💡 请用普通话清晰朗读几句话                │
│                                             │
│         [取消]     [开始录音]               │
└─────────────────────────────────────────────┘
```

### 2.4 组件结构

| 组件 | 职责 |
|------|------|
| `VoiceSelector` | 音色选择器（下拉/展开） |
| `CloneVoiceModal` | 克隆弹窗容器 |
| `AudioUploader` | 音频上传组件 |
| `AudioRecorder` | 录音组件 |
| `VoiceList` | 我的音色列表 |

---

## 3. API对接

### 3.1 上传音频获取 file_id

**端点**: `POST /v1/files/upload`

```typescript
interface UploadResponse {
  file: {
    file_id: string
    bytes: number
    created_at: string
    filename: string
    purpose: 'prompt_audio'
  }
  base_resp: {
    status_code: number
    status_msg: string
  }
}
```

### 3.2 克隆声音

**端点**: `POST /v1/voice_clone`

**请求**:
```typescript
interface CloneRequest {
  file_id: string      // 必填，上传音频的file_id
  voice_id: string     // 必填，自定义音色ID（8-256字符）
  clone_prompt?: string  // 可选，提升相似度
  text?: string         // 可选，复刻试听文本
  model?: string        // 可选，试听模型
  language_boost?: string // 可选，增强语言
  need_noise_reduction?: boolean // 可选，降噪
  need_volume_normalization?: boolean // 可选，音量归一化
}
```

**响应**:
```typescript
interface CloneResponse {
  voice_id: string
  demo_audio?: string   // 试听音频
  base_resp: {
    status_code: number
    status_msg: string
  }
}
```

### 3.3 查询音色列表

**端点**: `GET /v1/voice?voice_type=voice_cloning`

**响应**:
```typescript
interface VoiceListResponse {
  voice_cloning: Array<{
    voice_id: string
    description: string
    created_time: string
  }>
  base_resp: {
    status_code: number
    status_msg: string
  }
}
```

### 3.4 删除音色

**端点**: `POST /v1/delete_voice`

**请求**:
```typescript
interface DeleteRequest {
  voice_type: 'voice_cloning' | 'voice_generation'
  voice_id: string
}
```

---

## 4. 状态管理

```typescript
interface VoiceState {
  voices: Voice[]
  selectedVoiceId: string | null
  isCloneModalOpen: boolean
  isRecording: boolean
  recordingTime: number
  uploadProgress: number
  isCloning: boolean
  error: string | null
}

interface Voice {
  voice_id: string
  description?: string
  created_time?: string
  type: 'system' | 'cloning' | 'generation'
  isExpiringSoon?: boolean  // 7天内过期提醒
}
```

---

## 5. 有效期管理

### 5.1 自动续期

```typescript
// 每次使用音色时自动续期
// MiniMax API: 克隆音色7天不用会过期
// 解决方案: 用户使用音色生成音乐后，自动触发一次无声查询来续期
```

### 5.2 过期提醒

```typescript
// 7天有效期快到期时提醒用户
// - 到期前3天：在音色卡片显示"即将过期"标签
// - 到期当天：提示"音色已过期，请重新克隆"
```

---

## 6. 错误处理

| 错误类型 | 处理方式 |
|----------|----------|
| 音频时长不足 | 提示"音频需要3-8秒，请重新录制/上传" |
| 音频格式错误 | 提示"仅支持 mp3, wav, m4a 格式" |
| 克隆失败 (2038) | 提示"无克隆权限，请检查账号认证" |
| 余额不足 (1008) | 提示"余额不足，请充值后使用" |
| 限流 (1002) | 提示"请求过于频繁，请稍后再试" |

---

## 7. 实现文件清单

| 文件路径 | 职责 |
|----------|------|
| `src/app/api/voice/clone/route.ts` | 克隆音色API路由 |
| `src/app/api/voice/list/route.ts` | 音色列表API路由 |
| `src/app/api/voice/delete/route.ts` | 删除音色API路由 |
| `src/app/api/voice/upload/route.ts` | 上传音频API路由 |
| `src/components/VoiceSelector.tsx` | 音色选择器组件 |
| `src/components/CloneVoiceModal.tsx` | 克隆弹窗组件 |
| `src/components/AudioUploader.tsx` | 音频上传组件 |
| `src/components/AudioRecorder.tsx` | 录音组件 |
| `src/hooks/useVoiceClone.ts` | 音色克隆状态Hook |

---

## 8. 依赖关系

- 依赖 `MiniMax Voice Clone API` 正常可用
- 依赖现有 `generate/page.tsx` 的表单结构
- 音色选择器内嵌在生成页面中

---

## 9. 优先级排序

| 阶段 | 内容 |
|------|------|
| Phase 1 | 上传音频 + 克隆基础流程 |
| Phase 2 | 录音功能 |
| Phase 3 | 音色列表管理 |
| Phase 4 | 有效期管理 + 续期 |
