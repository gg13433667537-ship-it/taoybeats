interface AdminListUser {
  id: string
  email: string
  name: string | null
  role: string
  isActive: boolean
  tier: string
  dailyUsage: number
  monthlyUsage: number
  createdAt: Date
}

interface EnsureCurrentAdminVisibleParams {
  users: AdminListUser[]
  currentUser: AdminListUser | null
  page: number
  limit: number
  search: string
}

function matchesSearch(user: AdminListUser, search: string): boolean {
  const normalizedSearch = search.trim().toLowerCase()
  if (!normalizedSearch) return true

  return (
    user.email.toLowerCase().includes(normalizedSearch) ||
    (user.name?.toLowerCase().includes(normalizedSearch) ?? false)
  )
}

export function ensureCurrentAdminVisible({
  users,
  currentUser,
  page,
  limit,
  search,
}: EnsureCurrentAdminVisibleParams): AdminListUser[] {
  if (page !== 1 || !currentUser || !matchesSearch(currentUser, search)) {
    return users
  }

  if (users.some((listedUser) => listedUser.id === currentUser.id)) {
    return users
  }

  return [currentUser, ...users].slice(0, limit)
}

