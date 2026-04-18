# A计划 - TaoyBeats 功能优化与 UI 改进

> 创建日期：2026-04-18
> 状态：**执行中**

## 背景

用户报告了一系列问题需要修复和优化，包括 i18n 翻译缺失、UI 交互改进、功能权限调整等。本计划旨在一次性解决所有问题，并在完成后进入自我迭代永动模式，持续优化产品。

---

## 一、i18n 翻译补全

### 问题
generate/page.tsx 和 dashboard/page.tsx 中存在大量硬编码英文，未使用 `t()` 翻译函数。

### 解决方案
1. **Generate 页面**需翻译的硬编码文本：
   - "Quick Generate" → `t('quickGenerate')`
   - "Save Current" → `t('saveCurrent')`
   - "Preset name:" → `t('presetName')`
   - "Beat Maker Mode" → `t('beatMakerMode')`
   - "Duration" → `t('duration')`
   - "Generate instrumentals without vocals" → 需新增翻译 key

2. **Dashboard 页面**需翻译的硬编码文本：
   - "Playlists" → `t('playlists')`
   - "New Playlist" → `t('createPlaylist')`
   - "No playlists yet" → `t('noPlaylists')`
   - "Add to Playlist" → 需新增翻译 key
   - "Create Playlist" → `t('createPlaylist')`
   - "Name" / "Description (optional)" → 需确认翻译

### 优先级：高

---

## 二、Settings 页面权限控制

### 问题
普通用户可以看到 API 配置 UI，这是服务器端配置，不应暴露给普通用户。

### 解决方案
- API 配置 section 仅对 `role === 'ADMIN'` 的用户显示
- 普通用户看到的是个人资料设置、通知设置、安全设置等

### 优先级：高

---

## 三、Style/Mood/Instruments 选择器交互升级

### 解决方案
采用响应式设计，为桌面端和移动端配置最适合的方案：

| 端 | 选择器类型 | 交互方式 |
|-----|----------|---------|
| 桌面端 (≥768px) | 侧边抽屉 (Side Drawer) | 从右侧滑入，网格布局，支持搜索过滤 |
| 移动端 (<768px) | 底部抽屉 (Bottom Sheet) | 从底部滑上，原生手势支持，滑动手势关闭 |

### 详细规格

**侧边抽屉/底部抽屉功能：**
- 标题显示当前选择数量（如 "已选 3 个风格"）
- 搜索框支持关键词过滤
- 分组展示（如 Instruments 按：弦乐、键盘、打击乐、电子乐、其他 分组）
- 多选模式（Style、Instruments）/ 单选模式（Mood）
- 确认按钮固定在底部
- 点击遮罩层或滑动关闭

### 优先级：高

---

## 四、AI 歌词助手权限与引导

### 问题
未登录用户无法使用 AI 歌词功能，但界面没有任何引导。

### 解决方案

**未登录用户看到的交互：**
1. AI 歌词按钮正常显示，点击后弹出登录引导 Modal
2. Modal 内容：
   - 标题："新用户专属：免费生成 X 次"
   - 描述："登录后即可获得免费 AI 歌词生成次数"
   - 按钮："登录 / 注册"
3. 已登录用户：正常调用 `/api/lyrics` 生成歌词

**技术实现：**
- 前端检测用户登录状态（通过 session cookie）
- 未登录时点击触发引导 Modal，而非直接调用 API

### 优先级：高

---

## 五、头像上传功能

### 解决方案

**存储方案：**
- 使用 Supabase Storage 存储头像图片
- 存储路径：`avatars/{userId}/{timestamp}.{ext}`

**上传方式：**
- 拖拽上传
- 点击选择文件
- 移动端：摄像头拍照

**图片处理：**
- 上传后进行客户端裁剪（react-image-crop 或类似库）
- 支持 1:1 正方形裁剪
- 裁剪后压缩并上传
- 最大文件大小：2MB
- 支持格式：JPEG, PNG, WebP

**预设头像：**
- 提供 12 个预设头像供选择
- 预设头像存储在 `/public/avatars/defaults/` 目录

### 优先级：中

---

## 六、云端同步预设功能

### 解决方案

**预设数据模型：**
```typescript
interface Preset {
  id: string
  userId: string
  name: string
  genre: string[]
  mood: string
  instruments: string[]
  isInstrumental: boolean
  duration: number
  shareToken?: string // 用于生成分享链接
  createdAt: string
  updatedAt: string
}
```

**同步策略：**
- 启动时合并同步：比较服务器和本地预设，保留各自独有的
- 冲突处理：保留两者（不覆盖），让用户手动管理

**数量限制：**
- 每个用户最多 10 个预设
- 超出时提示用户删除旧预设

**分享功能：**
- 每个预设可生成分享链接
- 分享链接格式：`{origin}/preset/{shareToken}`
- 其他用户可通过分享链接一键导入预设（需登录）

### 优先级：中

---

## 七、UI 视觉优化

### 策略
采用渐进式优化策略：
1. 保持现有深色主题 + 紫色强调色的整体风格
2. 参考竞品（Suno、Udio、Soundraw）优化：
   - 配色细节（对比度、渐变优化）
   - 间距和留白
   - 圆角和阴影层次
   - 动效和过渡动画
3. 如发现竞品有明显优势的特色功能，可考虑全面重构

### 竞品参考优先级
1. **Suno** - 极简现代风格，信息层次清晰
2. **Udio** - 色彩丰富，卡片布局
3. **Soundraw** - 专业感强，模块化设计

### 优先级：低（渐进优化）

---

## 八、技术债务与待确认

- [ ] 检查是否有未使用的 import
- [ ] 检查 TypeScript 类型安全性
- [ ] 验证所有 API 路由的错误处理
- [ ] 检查响应式布局在各种屏幕尺寸下的表现

---

## 执行顺序

1. **Phase 1 (高优先级)**
   - [ ] i18n 翻译补全
   - [ ] Settings 页面权限控制
   - [ ] AI 歌词助手登录引导

2. **Phase 2 (高优先级)**
   - [ ] 抽屉/底部选择器组件开发
   - [ ] 集成到 generate 页面

3. **Phase 3 (中优先级)**
   - [ ] 头像上传功能（Supabase Storage 集成）
   - [ ] 预设系统后端 API
   - [ ] 预设云端同步

4. **Phase 4 (低优先级)**
   - [ ] UI 视觉渐进优化
   - [ ] 竞品研究

---

## 备注

本计划由用户和 AI 共同讨论制定。用户选择了一次性解决所有问题的方案，并要求在完成后进入自我迭代永动模式。
