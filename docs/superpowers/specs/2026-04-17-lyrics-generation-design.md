# Lyrics Generation 功能设计文档

**日期**: 2026-04-17
**功能**: AI歌词生成助手
**优先级**: P1

---

## 1. 功能概述

### 1.1 核心价值
让用户只需提供歌词框架或主题，AI自动生成完整结构化歌词（含Verse、Chorus、Bridge等结构标签），然后一键进入音乐生成流程。

### 1.2 用户流程

```
用户点击 "AI写词" 按钮
    ↓
打开模态弹窗 LyricsAssistantModal
    ↓
Step 1: 输入框架 + 选择风格/情绪
    ↓
点击 "生成歌词" 按钮
    ↓
Step 2: 查看AI生成的歌词（可编辑/AI重写段落）
    ↓
点击 "确认使用" 按钮
    ↓
歌词自动填充到主生成表单
    ↓
点击 "生成音乐" 按钮
```

---

## 2. UI设计

### 2.1 模态弹窗布局

```
┌─────────────────────────────────────────────────────────────┐
│  AI歌词助手                                           [X]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 歌曲主题/标题                                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  风格标签: [Pop] [Hip-Hop] [Rock] ... (可多选)             │
│  情绪选择: [Happy] [Sad] [Romantic] ... (单选)             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 歌词框架（可选）                                      │   │
│  │                                                     │   │
│  │ [Verse]                                             │   │
│  │ 你好世界...                                          │   │
│  │                                                     │   │
│  │ [Chorus]                                            │   │
│  │ 啦啦啦啦...                                          │   │
│  │                                                     │   │
│  │ 💡 提示：使用 [Verse]、[Chorus] 等标签指定结构       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│              [🎵 AI生成歌词]                                │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  生成的歌词预览                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [Intro]                                             │   │
│  │ 城市霓虹闪烁...                                       │   │
│  │                                                     │   │
│  │ [Verse 1]                                           │   │
│  │ 清晨的阳光穿过窗帘...                                 │   │
│  │                                                     │   │
│  │ [Pre-Chorus]                                        │   │
│  │ 这一刻如此特别...                                     │   │
│  │                                                     │   │
│  │ [Chorus]                    [段落重写] [删除]         │   │
│  │ 你是我心中最美的光...                                 │   │
│  │                                                     │   │
│  │ ...                                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  编辑模式: ○自由编辑  ○AI辅助(选择段落重写)                  │
│                                                             │
│         [重新生成]                    [确认使用歌词 →]         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 组件结构

| 组件 | 职责 |
|------|------|
| `LyricsAssistantModal` | 模态弹窗容器，管理开启/关闭 |
| `LyricsFrameworkInput` | 歌词框架输入框，支持结构标签 |
| `LyricsStyleSelector` | 风格/情绪多选/单选器 |
| `LyricsPreview` | AI生成的歌词预览，带段落操作 |
| `LyricsEditor` | 编辑器模式切换（自由编辑/AI重写） |

### 2.3 状态管理

```typescript
interface LyricsDraft {
  title: string
  framework: string
  generatedLyrics: string | null
  style: string[]       // 多选
  mood: string          // 单选
  isModified: boolean   // 用户是否手动修改
  lastSavedAt: number   // localStorage时间戳
}

interface LyricsModalState {
  isOpen: boolean
  currentStep: 'input' | 'preview'
  draft: LyricsDraft
  isGenerating: boolean
  error: string | null
}
```

---

## 3. API对接

### 3.1 MiniMax Lyrics Generation API

**端点**: `POST /v1/lyrics_generation`

**生成歌词请求**:
```typescript
interface GenerateLyricsRequest {
  mode: 'write_full_song' | 'edit'
  prompt?: string        // 风格描述，如 "pop, happy, romantic"
  lyrics?: string        // 用户框架（edit模式）
  title?: string         // 歌曲标题
}
```

**响应**:
```typescript
interface GenerateLyricsResponse {
  song_title: string     // 生成的歌名
  style_tags: string     // 风格标签，逗号分隔
  lyrics: string         // 生成的歌词（含结构标签）
  base_resp: {
    status_code: number
    status_msg: string
  }
}
```

### 3.2 段落重写请求

当用户选择某个段落重写时，发送完整歌词 + 重写提示:
```typescript
// 内部使用同一个API，但带上用户选择的段落重写提示
POST /v1/lyrics_generation
{
  mode: 'edit',
  prompt: '保持原风格，重写[Verse 2]段落，让它更有冲击力',
  lyrics: '完整的当前歌词...'
}
```

---

## 4. 数据流

```
用户输入框架
    ↓
前端校验（标题必填，框架可选）
    ↓
调用 /api/lyrics/generate
    ↓
后端调用 MiniMax API
    ↓
返回生成的歌词
    ↓
存入 draft.generatedLyrics
    ↓
用户编辑/重写（可选）
    ↓
确认后 → 填充到主表单 lyrics 字段
    ↓
用户继续填写其他参数 → 生成音乐
```

---

## 5. 草稿保存机制

### 5.1 localStorage自动保存

```typescript
const STORAGE_KEY = 'taoybeats_lyrics_draft'

// 每30秒自动保存
useEffect(() => {
  const interval = setInterval(() => {
    if (draft.generatedLyrics) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...draft,
        lastSavedAt: Date.now()
      }))
    }
  }, 30000)

  return () => clearInterval(interval)
}, [draft])
```

### 5.2 恢复逻辑

```typescript
// 打开弹窗时检查
useEffect(() => {
  if (isOpen) {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      // 如果草稿在30分钟内，询问用户是否恢复
      if (Date.now() - parsed.lastSavedAt < 30 * 60 * 1000) {
        // 询问用户是否恢复
      }
    }
  }
}, [isOpen])
```

---

## 6. 错误处理

| 错误类型 | 处理方式 |
|----------|----------|
| API超时 | 提示"生成超时，请重试"，保留用户输入 |
| 敏感内容 (1026) | 提示"内容包含敏感词，请修改"，高亮违规部分 |
| 余额不足 (1008) | 提示"余额不足，请充值" |
| 限流 (1002) | 提示"请求过于频繁，请稍后再试" |
| 参数错误 (2013) | 提示具体错误信息 |

---

## 7. 实现文件清单

| 文件路径 | 职责 |
|----------|------|
| `src/app/api/lyrics/route.ts` | 歌词生成API路由 |
| `src/components/LyricsAssistantModal.tsx` | 模态弹窗组件 |
| `src/components/LyricsFrameworkInput.tsx` | 框架输入组件 |
| `src/components/LyricsPreview.tsx` | 歌词预览+编辑组件 |
| `src/hooks/useLyricsDraft.ts` | 草稿状态管理Hook |
| `src/lib/ai-providers.ts` | 扩展LyricsGeneration provider |

---

## 8. 依赖关系

- 依赖 `MiniMax Lyrics Generation API` 正常可用
- 依赖现有 `generate/page.tsx` 的表单结构
- 独立模块，不影响现有音乐生成流程

---

## 9. 优先级排序

| 阶段 | 内容 |
|------|------|
| Phase 1 | 基础生成 + 模态弹窗UI |
| Phase 2 | 段落编辑 + 重写功能 |
| Phase 3 | 草稿保存 + 恢复机制 |
| Phase 4 | 与Music Gen联动优化 |
