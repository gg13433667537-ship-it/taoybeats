"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useI18n } from "@/lib/i18n"
import {
  createUserEditFormState,
} from "./user-edit-modal-state"
import {
  Music,
  Users,
  BarChart3,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  Shield,
  Trash2,
  Edit,
  Eye,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Clock,
  UserX,
} from "lucide-react"

interface User {
  id: string
  email: string
  name: string
  role: string
  isActive: boolean
  tier: string
  dailyUsage: number
  monthlyUsage: number
  createdAt: string
}

interface Song {
  id: string
  title: string
  status: string
  userId: string
  userEmail?: string
  createdAt: string
}

interface Stats {
  users: {
    total: number
    active: number
    admins: number
    pro: number
  }
  songs: {
    total: number
    byStatus: Record<string, number>
  }
  usage: {
    daily: number
    monthly: number
  }
  logs: AdminLog[]
}

interface AdminLog {
  id: string
  adminId: string
  adminEmail: string
  action: string
  targetId?: string
  targetType?: string
  details?: unknown
  createdAt: string
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function AdminPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<"users" | "songs" | "stats">("users")
  const [users, setUsers] = useState<User[]>([])
  const [songs, setSongs] = useState<Song[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [userPagination, setUserPagination] = useState<PaginationInfo>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [songPagination, setSongPagination] = useState<PaginationInfo>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showUserModal, setShowUserModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ show: boolean; userId?: string; songId?: string; type?: "user" | "song" }>({ show: false })
  const [actionLoading, setActionLoading] = useState(false)
  const [adminError, setAdminError] = useState<string | null>(null)
  // Edit form state
  const [editFormState, setEditFormState] = useState({
    role: "USER",
    tier: "FREE",
    isActive: true,
    addCredits: 0,
  })

  // Fetch users
  const fetchUsers = useCallback(async (page = 1, search = "") => {
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: "20" })
      if (search) params.set("search", search)

      const res = await fetch(`/api/admin/users?${params}`)
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users)
        setUserPagination(data.pagination)
      } else if (res.status === 403) {
        router.push("/dashboard")
      }
    } catch (error) {
      console.error("Error fetching users:", error)
    }
  }, [router])

  // Fetch songs
  const fetchSongs = useCallback(async (page = 1) => {
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: "20" })
      const res = await fetch(`/api/admin/songs?${params}`)
      if (res.ok) {
        const data = await res.json()
        setSongs(data.songs)
        setSongPagination(data.pagination)
      }
    } catch (error) {
      console.error("Error fetching songs:", error)
    }
  }, [])

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/stats")
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (error) {
      console.error("Error fetching stats:", error)
    }
  }, [])

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([fetchUsers(), fetchSongs(), fetchStats()])
      setLoading(false)
    }
    loadData()
  }, [fetchUsers, fetchSongs, fetchStats])

  // Handle user search
  const handleUserSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchUsers(1, searchQuery)
  }

  // Update user role/status/credits
  const handleUpdateUser = async (userId: string, updates: { role?: string; isActive?: boolean; tier?: string; addCredits?: number }) => {
    setActionLoading(true)
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...updates }),
      })
      const data = await res.json()
      if (res.ok) {
        await Promise.all([fetchUsers(userPagination.page, searchQuery), fetchStats()])
        setShowUserModal(false)
        setSelectedUser(null)
      } else {
        setAdminError(data.error || t('updateFailed'))
      }
    } catch (error) {
      console.error("Error updating user:", error)
      setAdminError(t('updateFailedRetry'))
    }
    setActionLoading(false)
  }

  // Delete user
  const handleDeleteUser = async (userId: string) => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" })
      const data = await res.json()
      if (res.ok) {
        await Promise.all([fetchUsers(userPagination.page, searchQuery), fetchStats()])
        setShowDeleteConfirm({ show: false })
      } else {
        setAdminError(data.error || t('deleteFailed'))
      }
    } catch (error) {
      console.error("Error deleting user:", error)
      setAdminError(t('deleteFailedRetry'))
    }
    setActionLoading(false)
  }

  // Delete song
  const handleDeleteSong = async (songId: string) => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/songs/${songId}`, { method: "DELETE" })
      if (res.ok) {
        await Promise.all([fetchSongs(songPagination.page), fetchStats()])
        setShowDeleteConfirm({ show: false })
      }
    } catch (error) {
      console.error("Error deleting song:", error)
    }
    setActionLoading(false)
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "bg-purple-500/10 text-purple-400 border-purple-500/30"
      case "PRO":
        return "bg-accent/10 text-accent border-accent/30"
      default:
        return "bg-text-muted/10 text-text-muted border-text-muted/30"
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-success/10 text-success"
      case "GENERATING":
        return "bg-accent/10 text-accent"
      case "FAILED":
        return "bg-error/10 text-error"
      default:
        return "bg-text-muted/10 text-text-muted"
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  const formatAction = (action: string) => {
    switch (action) {
      case "UPDATE_USER":
        return t('adminUpdatedUser')
      case "DELETE_USER":
        return t('adminDeletedUser')
      case "DELETE_SONG":
        return t('adminDeletedSong')
      default:
        return action
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-surface/50 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => router.push("/dashboard")} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent-glow flex items-center justify-center">
              <Music className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-foreground">TaoyBeats</span>
            <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 text-xs font-medium border border-purple-500/30">
              {t('admin')}
            </span>
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 rounded-lg bg-surface hover:bg-surface-elevated text-text-secondary hover:text-foreground text-sm transition-colors"
          >
            {t('backToDashboard')}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {adminError && (
          <div className="mb-6 p-4 rounded-xl bg-error/10 border border-error/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-error" />
              <span className="text-error text-sm">{adminError}</span>
            </div>
            <button
              onClick={() => setAdminError(null)}
              aria-label="Dismiss error"
              className="p-1 rounded hover:bg-error/10 text-error/60 hover:text-error transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {/* Tabs */}
        <div role="tablist" className="flex items-center gap-2 mb-8 border-b border-border">
          <button
            role="tab"
            aria-selected={activeTab === "users"}
            onClick={() => setActiveTab("users")}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === "users"
                ? "border-accent text-foreground"
                : "border-transparent text-text-secondary hover:text-foreground"
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" aria-hidden="true" />
            {t('users')}
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "songs"}
            onClick={() => setActiveTab("songs")}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === "songs"
                ? "border-accent text-foreground"
                : "border-transparent text-text-secondary hover:text-foreground"
            }`}
          >
            <Music className="w-4 h-4 inline mr-2" aria-hidden="true" />
            {t('songs')}
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "stats"}
            onClick={() => setActiveTab("stats")}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === "stats"
                ? "border-accent text-foreground"
                : "border-transparent text-text-secondary hover:text-foreground"
            }`}
          >
            <BarChart3 className="w-4 h-4 inline mr-2" aria-hidden="true" />
            {t('stats')}
          </button>
        </div>

        {/* Users Tab */}
        {activeTab === "users" && (
          <div>
            {/* Search */}
            <form onSubmit={handleUserSearch} className="mb-6 flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  className="w-full pl-10 pr-4 py-2 rounded-lg bg-surface border border-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors"
              >
                {t('search')}
              </button>
            </form>

            {/* Users Table */}
            <div className="rounded-xl bg-surface border border-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">{t('user')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">{t('role')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">{t('status')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">{t('tier')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">{t('usage')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">{t('created')}</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-surface-elevated/50 transition-colors">
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-medium text-foreground">{user.name || "—"}</p>
                          <p className="text-sm text-text-secondary">{user.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getRoleBadgeColor(user.role)}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {user.isActive ? (
                          <span className="flex items-center gap-1 text-success text-sm">
                            <CheckCircle className="w-4 h-4" /> {t('active')}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-error text-sm">
                            <UserX className="w-4 h-4" /> {t('inactive')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-foreground">{user.tier}</span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm">
                          <span className="text-text-secondary">{t('daily')}: </span>
                          <span className="text-foreground">{user.dailyUsage}</span>
                          <span className="text-text-secondary mx-1">|</span>
                          <span className="text-text-secondary">{t('monthlyUsage')}: </span>
                          <span className="text-foreground">{user.monthlyUsage}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm text-text-secondary">{formatDate(user.createdAt)}</span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedUser(user)
                              setEditFormState(createUserEditFormState({
                                role: user.role,
                                tier: user.tier,
                                isActive: user.isActive,
                                addCredits: 0,
                              }))
                              setShowUserModal(true)
                            }}
                            aria-label="Edit user"
                            className="p-2 rounded-lg hover:bg-surface-elevated text-text-secondary hover:text-foreground transition-colors"
                          >
                            <Edit className="w-4 h-4" aria-hidden="true" />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm({ show: true, userId: user.id, type: "user" })}
                            aria-label="Delete user"
                            className="p-2 rounded-lg hover:bg-error/10 text-text-secondary hover:text-error transition-colors"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-text-secondary">
                {t('showing')} {(userPagination.page - 1) * userPagination.limit + 1} {t('to')}{" "}
                {Math.min(userPagination.page * userPagination.limit, userPagination.total)} {t('of')} {userPagination.total} {t('users')}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchUsers(userPagination.page - 1, searchQuery)}
                  disabled={userPagination.page <= 1}
                  aria-label="Previous page"
                  className="p-2 rounded-lg bg-surface border border-border hover:bg-surface-elevated disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </button>
                <span className="text-sm text-text-secondary">
                  {t('page')} {userPagination.page} {t('of')} {userPagination.totalPages}
                </span>
                <button
                  onClick={() => fetchUsers(userPagination.page + 1, searchQuery)}
                  disabled={userPagination.page >= userPagination.totalPages}
                  aria-label="Next page"
                  className="p-2 rounded-lg bg-surface border border-border hover:bg-surface-elevated disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Songs Tab */}
        {activeTab === "songs" && (
          <div>
            {/* Songs Table */}
            <div className="rounded-xl bg-surface border border-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">{t('songs')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">{t('user')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">{t('status')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">{t('created')}</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {songs.map((song) => (
                    <tr key={song.id} className="hover:bg-surface-elevated/50 transition-colors">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                            <Music className="w-5 h-5 text-accent" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{song.title}</p>
                            <p className="text-sm text-text-muted">{song.id.slice(0, 8)}...</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm text-foreground">{song.userEmail || song.userId}</p>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(song.status)}`}>
                          {song.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm text-text-secondary">{formatDate(song.createdAt)}</span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => router.push(`/song/${song.id}`)}
                            aria-label="View song"
                            className="p-2 rounded-lg hover:bg-surface-elevated text-text-secondary hover:text-foreground transition-colors"
                          >
                            <Eye className="w-4 h-4" aria-hidden="true" />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm({ show: true, songId: song.id, type: "song" })}
                            aria-label="Delete song"
                            className="p-2 rounded-lg hover:bg-error/10 text-text-secondary hover:text-error transition-colors"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-text-secondary">
                {t('showing')} {(songPagination.page - 1) * songPagination.limit + 1} {t('to')}{" "}
                {Math.min(songPagination.page * songPagination.limit, songPagination.total)} {t('of')} {songPagination.total} {t('songs')}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchSongs(songPagination.page - 1)}
                  disabled={songPagination.page <= 1}
                  aria-label="Previous page"
                  className="p-2 rounded-lg bg-surface border border-border hover:bg-surface-elevated disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </button>
                <span className="text-sm text-text-secondary">
                  {t('page')} {songPagination.page} {t('of')} {songPagination.totalPages}
                </span>
                <button
                  onClick={() => fetchSongs(songPagination.page + 1)}
                  disabled={songPagination.page >= songPagination.totalPages}
                  aria-label="Next page"
                  className="p-2 rounded-lg bg-surface border border-border hover:bg-surface-elevated disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats Tab */}
        {activeTab === "stats" && stats && (
          <div className="space-y-6">
            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-6 rounded-xl bg-surface border border-border">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary">{t('totalUsers')}</p>
                    <p className="text-2xl font-bold text-foreground">{stats.users.total}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-success">{stats.users.active} {t('active')}</span>
                  <span className="text-purple-400">{stats.users.admins} {t('admin')}</span>
                  <span className="text-accent">{stats.users.pro} PRO</span>
                </div>
              </div>

              <div className="p-6 rounded-xl bg-surface border border-border">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                    <Music className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary">{t('totalSongs')}</p>
                    <p className="text-2xl font-bold text-foreground">{stats.songs.total}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-success">{stats.songs.byStatus.COMPLETED} {t('completed')}</span>
                  <span className="text-accent">{stats.songs.byStatus.GENERATING} {t('generatingLabel')}</span>
                </div>
              </div>

              <div className="p-6 rounded-xl bg-surface border border-border">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-info" />
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary">{t('dailyUsage')}</p>
                    <p className="text-2xl font-bold text-foreground">{stats.usage.daily}</p>
                  </div>
                </div>
                <p className="text-sm text-text-secondary">{t('generationsToday')}</p>
              </div>

              <div className="p-6 rounded-xl bg-surface border border-border">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary">{t('monthlyUsage')}</p>
                    <p className="text-2xl font-bold text-foreground">{stats.usage.monthly}</p>
                  </div>
                </div>
                <p className="text-sm text-text-secondary">{t('generationsThisMonth')}</p>
              </div>
            </div>

            {/* Songs by Status */}
            <div className="p-6 rounded-xl bg-surface border border-border">
              <h3 className="text-lg font-semibold text-foreground mb-4">{t('songsByStatus')}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(stats.songs.byStatus).map(([status, count]) => (
                  <div key={status} className="p-4 rounded-lg bg-background border border-border">
                    <p className="text-sm text-text-secondary mb-1">{status}</p>
                    <p className="text-2xl font-bold text-foreground">{count}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Admin Logs */}
            <div className="p-6 rounded-xl bg-surface border border-border">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-400" />
                {t('recentAdminActions')}
              </h3>
              {stats.logs.length === 0 ? (
                <p className="text-text-secondary text-sm">{t('noAdminActions')}</p>
              ) : (
                <div className="space-y-3">
                  {stats.logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-4 p-3 rounded-lg bg-background border border-border">
                      <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                        <Shield className="w-4 h-4 text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">
                          <span className="font-medium">{log.adminEmail}</span>
                          <span className="text-text-secondary"> {formatAction(log.action)}</span>
                          {log.targetType && (
                            <span className="text-text-muted"> ({log.targetType})</span>
                          )}
                        </p>
                        <p className="text-xs text-text-muted">{formatDate(log.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* User Edit Modal */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl bg-surface border border-border p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-foreground">{t('editUser')}</h3>
              <button
                onClick={() => {
                  setShowUserModal(false)
                  setSelectedUser(null)
                }}
                aria-label="Close modal"
                className="p-2 rounded-lg hover:bg-surface-elevated text-text-secondary hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-secondary mb-2">{t('email')}</label>
                <p className="text-foreground">{selectedUser.email}</p>
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-2">{t('role')}</label>
                <select
                  value={editFormState.role}
                  onChange={(e) => setEditFormState({ ...editFormState, role: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:border-accent"
                >
                  <option value="USER">USER</option>
                  <option value="PRO">PRO</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-2">{t('tier')}</label>
                <select
                  value={editFormState.tier}
                  onChange={(e) => setEditFormState({ ...editFormState, tier: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:border-accent"
                >
                  <option value="FREE">FREE</option>
                  <option value="PRO">PRO</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-2">{t('status')}</label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editFormState.isActive}
                    onChange={(e) => setEditFormState({ ...editFormState, isActive: e.target.checked })}
                    className="w-4 h-4 rounded border-border bg-background text-accent focus:ring-accent"
                  />
                  <span className="text-sm text-foreground">{t('active')}</span>
                </label>
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-2">{t('addCredits')}</label>
                <input
                  type="number"
                  min="0"
                  value={editFormState.addCredits}
                  onChange={(e) => setEditFormState({ ...editFormState, addCredits: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:border-accent"
                />
                <p className="text-xs text-text-muted mt-1">{t('addCreditsHelp')}</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowUserModal(false)
                    setSelectedUser(null)
                  }}
                  className="flex-1 px-4 py-2 rounded-lg bg-surface-elevated hover:bg-border text-foreground text-sm font-medium transition-colors"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={() => {
                    handleUpdateUser(selectedUser.id, editFormState)
                  }}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t('save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm.show && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl bg-surface border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-error" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">{t('confirmDelete')}</h3>
            </div>
            <p className="text-text-secondary text-sm mb-6">
              {showDeleteConfirm.type === "user"
                ? t('confirmDeleteUser')
                : t('confirmDeleteSong')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm({ show: false })}
                className="flex-1 px-4 py-2 rounded-lg bg-surface-elevated hover:bg-border text-foreground text-sm font-medium transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={() => {
                  if (showDeleteConfirm.type === "user" && showDeleteConfirm.userId) {
                    handleDeleteUser(showDeleteConfirm.userId)
                  } else if (showDeleteConfirm.type === "song" && showDeleteConfirm.songId) {
                    handleDeleteSong(showDeleteConfirm.songId)
                  }
                }}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 rounded-lg bg-error hover:bg-error/90 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
