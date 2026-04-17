# Voice Design（声音设计）功能设计文档

**日期**: 2026-04-17
**功能**: Voice Design（声音设计）
**优先级**: P2

---

## 1. 功能概述

### 1.1 核心价值
用文字描述生成自定义音色，不需要上传音频。是Voice Clone的补充方案。

### 1.2 用户流程

```
点击"+克隆新音色" → 选择"AI生成音色"Tab
    ↓
选择预设音色 或 自由输入描述
    ↓
AI生成音色 + 试听
    ↓
保存到"我的音色"列表
```

---

## 2. UI设计

### 2.1 音色来源选择

```
┌─────────────────────────────────────────────┐
│  选择音色来源                                  │
├─────────────────────────────────────────────┤
│                                             │
│  [上传音频克隆]  [AI生成音色]                │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  预设音色（选择即可）:                        │
│  ┌────────┐ ┌────────┐ ┌────────┐        │
│  │温暖男声│ │活泼女声│ │磁性低沉│        │
│  └────────┘ └────────┘ └────────┘        │
│  ┌────────┐ ┌────────┐                    │
│  │甜美女声│ │硬朗大叔│                    │
│  └────────┘ └────────┘                    │
│                                             │
│  或自由描述:                                 │
│  ┌─────────────────────────────────────┐  │
│  │ 一个25岁的男孩，声音温柔，有点沙哑      │  │
│  └─────────────────────────────────────┘  │
│                                             │
│  💡 描述越详细，生成效果越好                 │
│                                             │
│         [取消]     [生成音色]               │
└─────────────────────────────────────────────┘
```

### 2.2 组件结构

| 组件 | 职责 |
|------|------|
| `VoiceSourceSelector` | 选择音色来源（克隆/AI生成） |
| `PresetVoiceSelector` | 预设音色选择器 |
| `CustomVoiceInput` | 自定义描述输入框 |

---

## 3. API对接

### 3.1 生成音色

**端点**: `POST /v1/voice_design`

**请求**:
```typescript
interface VoiceDesignRequest {
  prompt: string           // 必填，音色描述
  preview_text: string     // 必填，试听文本（≤500字符）
  voice_id?: string        // 可选，自定义音色ID
  aigc_watermark?: boolean // 可选，是否添加水印
}
```

**响应**:
```typescript
interface VoiceDesignResponse {
  voice_id: string         // 生成的音色ID
  trial_audio: string      // hex编码的试听音频
  base_resp: {
    status_code: number
    status_msg: string
  }
}
```

---

## 4. 实现文件清单

| 文件路径 | 职责 |
|----------|------|
| `src/app/api/voice/design/route.ts` | AI生成音色API路由 |
| `src/components/VoiceSourceSelector.tsx` | 音色来源选择组件 |
| `src/components/PresetVoiceSelector.tsx` | 预设音色选择组件 |
| `src/components/CustomVoiceInput.tsx` | 自定义描述输入组件 |

---

## 5. 依赖关系

- 依赖 Voice Clone 基础UI（在同一弹窗的不同Tab）
- 生成的音色与克隆音色统一管理

---

## 6. 费用说明

- Voice Design API 收费：**2元/万字符**
- 预览文本消耗会计入用户账户
