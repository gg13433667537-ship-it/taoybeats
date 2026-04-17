// Simple i18n for TaoyBeats
'use client'

import { createContext, useContext, useState, useEffect } from 'react'

type Language = 'en' | 'zh'

const translations = {
  en: {
    // Header
    generate: 'Generate',
    pricing: 'Pricing',
    signIn: 'Sign In',
    getStarted: 'Get Started',
    dashboard: 'Dashboard',
    settings: 'Settings',
    signOut: 'Sign Out',

    // Hero
    heroTitle1: 'Create Music with AI,',
    heroTitle2: 'Share Your Sound',
    heroDesc: 'Configure your own AI music backend, write lyrics, choose styles and moods. Generate unique songs in minutes.',
    startCreatingFree: 'Start Creating Free',
    tryDemo: 'Try Demo',

    // Features
    featuresTitle: 'Everything You Need to Create',
    customizableTitle: 'Customizable Generation',
    customizableDesc: 'Configure your AI backend, choose genres, moods, and instruments.',
    sharingTitle: 'Easy Sharing',
    sharingDesc: 'Generate shareable links for your songs.',
    downloadTitle: 'Download Anywhere',
    downloadDesc: 'Export your generated music as MP3 files.',

    // How it works
    howItWorks: 'How It Works',
    step1Title: 'Sign Up',
    step1Desc: 'Create your free account in seconds',
    step2Title: 'Configure',
    step2Desc: 'Set up your AI music API',
    step3Title: 'Generate',
    step3Desc: 'Write lyrics and create music',
    step4Title: 'Share',
    step4Desc: 'Download and share your creation',

    // CTA
    readyToCreate: 'Ready to Create?',
    ctaDesc: 'Join thousands of music creators using TaoyBeats.',
    getStartedFree: 'Get Started for Free',

    // Footer
    privacy: 'Privacy',
    terms: 'Terms',
    copyright: '© 2026 TaoyBeats. All rights reserved.',

    // Auth
    welcomeBack: 'Welcome back',
    signInContinue: 'Sign in to continue creating',
    email: 'Email',
    password: 'Password',
    signInButton: 'Sign In',
    noAccount: "Don't have an account?",
    signUp: 'Sign up',
    createAccount: 'Create your account',
    startCreatingToday: 'Start creating AI music today',
    name: 'Name',
    createAccountButton: 'Create Account',
    alreadyHaveAccount: 'Already have an account?',
    signInLink: 'Sign in',
    orContinueWithEmail: 'or continue with email',
    verificationCode: 'Verification Code',
    verifySignIn: 'Verify & Sign In',
    didntReceive: "Didn't receive the code?",
    tryAgain: 'Try again',
    back: 'Back',
    enterVerificationCode: 'Enter verification code',
    setYourPassword: 'Set your password',
    enterYourEmailToSignIn: 'Enter your email to sign in',
    weSentCodeTo: 'We sent a code to',
    createPasswordForFutureLogins: 'Create a password for future logins',
    demoModeYourCode: 'Demo Mode - Your verification code:',
    sending: 'Sending...',
    continueWithEmail: 'Continue with Email',
    verifying: 'Verifying...',
    verifyEmail: 'Verify Email',
    almostThere: 'Almost there!',
    tellUsAboutYourself: 'Tell us a bit about yourself',
    whatShouldWeCallYou: 'What should we call you?',
    yourNamePlaceholder: 'Your name',
    completeSignUp: 'Complete Sign Up',
    saving: 'Saving...',

    // Dashboard
    yourMusic: 'Your Music',
    manageShare: 'Create, manage, and share your AI-generated songs',
    daily: 'Daily',
    monthlyUsage: 'Monthly',
    totalSongs: 'Total Songs',
    tier: 'Tier',
    recentSongs: 'Recent Songs',
    createNewSong: 'Create new song →',
    noSongsYet: 'No songs yet',
    createFirstSong: 'Create your first AI-generated song',
    createSong: 'Create Song',
    ready: 'Ready',
    generating: 'Generating',

    // Generate
    createNewSongPage: 'Create New Song',
    fillDetails: 'Fill in the details below to generate your AI music',
    apiConfig: 'API Configuration',
    provider: 'Provider',
    apiUrl: 'API URL',
    apiKey: 'API Key',
    songDetails: 'Song Details',
    songTitle: 'Song Title',
    lyrics: 'Lyrics',
    genre: 'Genre',
    mood: 'Mood',
    instruments: 'Instruments',
    referenceSinger: 'Reference Singer',
    referenceSong: 'Reference Song',
    yourNotesPrivate: 'Your Notes (private)',
    notesPlaceholder: 'What is this song about? Any specific feelings or ideas?',
    generateSong: 'Generate Song',
    generatingEllipsis: 'Generating...',
    generationProgress: 'Generation Progress',
    complete: 'Complete!',
    failed: 'Failed',
    initializing: 'Initializing...',
    creatingMusic: 'Creating Music...',
    almostDone: 'Almost done...',
    yourSongReady: 'Your song is ready!',
    pleaseTryAgain: 'Please try again',
    tipsBetterResults: 'Tips for Better Results',
    tip1: 'Use specific and descriptive lyrics for better AI understanding',
    tip2: 'Matching mood and genre creates more coherent songs',
    tip3: 'Adding reference artists helps shape the style',
    tip4: 'Generation usually takes 2-5 minutes depending on complexity',

    // Pricing
    simplePricing: 'Simple, transparent pricing',
    startFreeUpgrade: 'Start for free. Upgrade when you need more.',
    monthly: 'Monthly',
    annual: 'Annual',
    save20: 'Save 20%',
    free: 'Free',
    forever: 'forever',
    perfectTrying: 'Perfect for trying out TaoyBeats',
    pro: 'Pro',
    perMonth: '/month',
    seriousCreators: 'For serious music creators',
    mostPopular: 'Most Popular',
    pricingGetStarted: 'Get Started',
    upgradeToPro: 'Upgrade to Pro',
    faqTitle: 'Frequently Asked Questions',
    faq1Q: 'What counts as a song?',
    faq1A: 'Each generation request counts as one song.',
    faq2Q: 'Unused songs roll over?',
    faq2A: 'Daily and monthly limits reset at the start of each day/month.',
    faq3Q: 'Can I cancel anytime?',
    faq3A: 'Yes, you can cancel your subscription at any time.',
    faq4Q: 'Payment methods?',
    faq4A: 'We accept all major credit cards through Stripe.',

    // Settings
    settingsTitle: 'Settings',
    profile: 'Profile',
    apiConfiguration: 'API Configuration',
    notifications: 'Notifications',
    security: 'Security',
    profileSettings: 'Profile Settings',
    changeAvatar: 'Change Avatar',
    saveChanges: 'Save Changes',
    saved: 'Saved!',
    apiConfigDesc: 'Configure your AI music generation API. Supports Suno, MiniMax, Udio, or any compatible API.',
    notificationsDesc: 'Get notified when your song is ready or if generation fails.',
    generationComplete: 'Generation complete',
    generationFailed: 'Generation failed',
    weeklySummary: 'Weekly summary',
    securitySettings: 'Security Settings',
    changePassword: 'Change Password',
    currentPassword: 'Current password',
    newPassword: 'New password',
    confirmPassword: 'Confirm new password',
    updatePassword: 'Update Password',
    sessions: 'Sessions',
    manageSessions: 'Manage your active sessions across devices.',
    signOutAllDevices: 'Sign Out All Devices',

    // Share page
    songNotFound: 'Song Not Found',
    songRemovedOrInvalid: 'This song may have been removed or the link is invalid.',
    goToTaoyBeats: 'Go to TaoyBeats',
    createdWith: 'Created with',
    createYourOwn: 'Create Your Own',

    // Limits
    dailyLimitReached: 'Daily limit reached',
    monthlyLimitReached: 'Monthly limit reached',
    upgradeToProMore: 'Upgrade to Pro for more generations.',
    tierFree: 'Free',
    dailyRemaining: 'remaining',
    monthlyRemaining: 'remaining',
    unlimited: 'unlimited',
  },
  zh: {
    // Header
    generate: '生成',
    pricing: '定价',
    signIn: '登录',
    getStarted: '立即开始',
    dashboard: '仪表盘',
    settings: '设置',
    signOut: '退出',

    // Hero
    heroTitle1: '用 AI 创作音乐，',
    heroTitle2: '分享你的声音',
    heroDesc: '配置你自己的 AI 音乐后端，填写歌词，选择风格和情绪。几分钟内生成独特的歌曲。',
    startCreatingFree: '免费开始创作',
    tryDemo: '试试演示',

    // Features
    featuresTitle: '创作所需的一切',
    customizableTitle: '可定制生成',
    customizableDesc: '配置你的 AI 后端，选择流派、情绪和乐器。',
    sharingTitle: '轻松分享',
    sharingDesc: '为你的歌曲生成分享链接。',
    downloadTitle: '随时下载',
    downloadDesc: '将生成的音乐导出为 MP3 文件。',

    // How it works
    howItWorks: '如何使用',
    step1Title: '注册',
    step1Desc: '几秒钟创建免费账号',
    step2Title: '配置',
    step2Desc: '设置你的 AI 音乐 API',
    step3Title: '生成',
    step3Desc: '填写歌词并创作音乐',
    step4Title: '分享',
    step4Desc: '下载并分享你的作品',

    // CTA
    readyToCreate: '准备创作了吗？',
    ctaDesc: '加入成千上万的音乐创作者，使用 TaoyBeats 实现你的想法。',
    getStartedFree: '免费开始',

    // Footer
    privacy: '隐私政策',
    terms: '服务条款',
    copyright: '© 2026 TaoyBeats. 保留所有权利。',

    // Auth
    welcomeBack: '欢迎回来',
    signInContinue: '登录以继续创作',
    email: '邮箱',
    password: '密码',
    signInButton: '登录',
    noAccount: '还没有账号？',
    signUp: '注册',
    createAccount: '创建账号',
    startCreatingToday: '立即开始 AI 音乐创作',
    name: '昵称',
    createAccountButton: '创建账号',
    alreadyHaveAccount: '已有账号？',
    signInLink: '登录',
    orContinueWithEmail: '或使用邮箱继续',
    verificationCode: '验证码',
    verifySignIn: '验证并登录',
    didntReceive: '没有收到验证码？',
    tryAgain: '重试',
    back: '返回',
    enterVerificationCode: '输入验证码',
    setYourPassword: '设置密码',
    enterYourEmailToSignIn: '输入邮箱以登录',
    weSentCodeTo: '验证码已发送至',
    createPasswordForFutureLogins: '创建密码以便下次登录',
    demoModeYourCode: '演示模式 - 您的验证码：',
    sending: '发送中...',
    continueWithEmail: '使用邮箱继续',
    verifying: '验证中...',
    verifyEmail: '验证邮箱',
    almostThere: '即将完成！',
    tellUsAboutYourself: '告诉我们一些关于你的信息',
    whatShouldWeCallYou: '我们该怎么称呼你？',
    yourNamePlaceholder: '你的名字',
    completeSignUp: '完成注册',
    saving: '保存中...',

    // Dashboard
    yourMusic: '我的音乐',
    manageShare: '创建、管理和分享你的 AI 音乐作品',
    daily: '今日',
    monthlyUsage: '本月',
    totalSongs: '歌曲总数',
    tier: '等级',
    recentSongs: '最近歌曲',
    createNewSong: '创建新歌曲 →',
    noSongsYet: '还没有歌曲',
    createFirstSong: '创建你的第一首 AI 音乐',
    createSong: '创建歌曲',
    ready: '就绪',
    generating: '生成中',

    // Generate
    createNewSongPage: '创建新歌曲',
    fillDetails: '填写以下信息来生成你的 AI 音乐',
    apiConfig: 'API 配置',
    provider: '提供商',
    apiUrl: 'API 地址',
    apiKey: 'API 密钥',
    songDetails: '歌曲详情',
    songTitle: '歌曲名称',
    lyrics: '歌词',
    genre: '风格',
    mood: '情绪',
    instruments: '乐器',
    referenceSinger: '参考歌手',
    referenceSong: '参考歌曲',
    yourNotesPrivate: '备注（仅自己可见）',
    notesPlaceholder: '这首歌想表达什么？有什么特别的感受或想法？',
    generateSong: '生成歌曲',
    generatingEllipsis: '生成中...',
    generationProgress: '生成进度',
    complete: '完成！',
    failed: '失败',
    initializing: '初始化中...',
    creatingMusic: '创作音乐中...',
    almostDone: '即将完成...',
    yourSongReady: '你的歌曲已就绪！',
    pleaseTryAgain: '请重试',
    tipsBetterResults: '获得更好效果的技巧',
    tip1: '使用具体描述性的歌词有助于 AI 更好地理解',
    tip2: '匹配的情绪和风格能创作出更连贯的歌曲',
    tip3: '添加参考歌手有助于塑造风格',
    tip4: '生成通常需要 2-5 分钟，取决于复杂度',

    // Pricing
    simplePricing: '简单透明的定价',
    startFreeUpgrade: '免费开始。需要时升级。',
    monthly: '月付',
    annual: '年付',
    save20: '省 20%',
    free: '免费版',
    forever: '永久免费',
    perfectTrying: '非常适合试用 TaoyBeats',
    pro: '专业版',
    perMonth: '/月',
    seriousCreators: '适合认真的音乐创作者',
    mostPopular: '最受欢迎',
    pricingGetStarted: '立即开始',
    upgradeToPro: '升级到专业版',
    faqTitle: '常见问题',
    faq1Q: '什么算一首歌？',
    faq1A: '每次生成请求算一首歌，无论长度或复杂度。',
    faq2Q: '没用完的额度会累积吗？',
    faq2A: '不会，每日和每月的额度在开始时重置。',
    faq3Q: '可以随时取消吗？',
    faq3A: '可以，你可以随时取消订阅。',
    faq4Q: '支持哪些支付方式？',
    faq4A: '我们通过 Stripe 接受所有主要信用卡。',

    // Settings
    settingsTitle: '设置',
    profile: '个人资料',
    apiConfiguration: 'API 配置',
    notifications: '通知',
    security: '安全',
    profileSettings: '个人资料设置',
    changeAvatar: '更换头像',
    saveChanges: '保存更改',
    saved: '已保存！',
    apiConfigDesc: '配置你的 AI 音乐生成 API。支持 Suno、MiniMax、Udio 或任何兼容 API。',
    notificationsDesc: '当歌曲生成完成或失败时收到通知。',
    generationComplete: '生成完成',
    generationFailed: '生成失败',
    weeklySummary: '每周总结',
    securitySettings: '安全设置',
    changePassword: '修改密码',
    currentPassword: '当前密码',
    newPassword: '新密码',
    confirmPassword: '确认新密码',
    updatePassword: '更新密码',
    sessions: '会话',
    manageSessions: '管理你在各设备上的活动会话。',
    signOutAllDevices: '退出所有设备',

    // Share page
    songNotFound: '歌曲未找到',
    songRemovedOrInvalid: '这首歌可能被删除或链接无效。',
    goToTaoyBeats: '前往 TaoyBeats',
    createdWith: '创作于',
    createYourOwn: '创建你自己的',

    // Limits
    dailyLimitReached: '今日额度已用完',
    monthlyLimitReached: '本月额度已用完',
    upgradeToProMore: '升级到专业版以获取更多额度。',
    tierFree: '免费版',
    dailyRemaining: '剩余',
    monthlyRemaining: '剩余',
    unlimited: '无限',
  },
}

type TranslationKey = keyof typeof translations.en

interface I18nContextType {
  lang: Language
  setLang: (lang: Language) => void
  t: (key: TranslationKey) => string
}

const I18nContext = createContext<I18nContextType>({
  lang: 'en',
  setLang: () => {},
  t: () => '',
})

export function I18nProvider({ children, lang = 'en' }: { children: React.ReactNode; lang?: Language }) {
  const [currentLang, setCurrentLang] = useState<Language>(lang)

  useEffect(() => {
    // Read from cookie on mount
    const cookies = document.cookie.split(';')
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=')
      if (name === 'taoybeats-lang') {
        setCurrentLang(value as Language)
        return
      }
    }
    // Fallback to localStorage
    const saved = localStorage.getItem('taoybeats-lang') as Language
    if (saved) setCurrentLang(saved)
  }, [])

  const handleSetLang = (newLang: Language) => {
    setCurrentLang(newLang)
    localStorage.setItem('taoybeats-lang', newLang)
    // Also set cookie for server-side reading
    document.cookie = `taoybeats-lang=${newLang}; path=/; max-age=${60 * 60 * 24 * 365}`
  }

  const t = (key: TranslationKey): string => {
    return translations[currentLang][key] || translations.en[key] || key
  }

  return (
    <I18nContext.Provider value={{ lang: currentLang, setLang: handleSetLang, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}

export const languages: { code: Language; name: string }[] = [
  { code: 'zh', name: '中文' },
  { code: 'en', name: 'English' },
]
