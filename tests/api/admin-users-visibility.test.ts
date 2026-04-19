import { describe, expect, it } from "vitest"

import { ensureCurrentAdminVisible } from "@/app/api/admin/users/visibility"

function createUser(id: string, email: string, name: string | null, createdAt: string) {
  return {
    id,
    email,
    name,
    role: "USER",
    isActive: true,
    tier: "FREE",
    dailyUsage: 0,
    monthlyUsage: 0,
    createdAt: new Date(createdAt),
  }
}

describe("ensureCurrentAdminVisible", () => {
  it("prepends the logged-in admin onto the first page when pagination would hide them", () => {
    const currentAdmin = {
      ...createUser("admin-1", "admin@example.com", "Admin", "2026-01-01T00:00:00.000Z"),
      role: "ADMIN",
    }
    const pageUsers = [
      createUser("user-1", "user1@example.com", "User 1", "2026-04-10T00:00:00.000Z"),
      createUser("user-2", "user2@example.com", "User 2", "2026-04-09T00:00:00.000Z"),
    ]

    expect(
      ensureCurrentAdminVisible({
        users: pageUsers,
        currentUser: currentAdmin,
        page: 1,
        limit: 2,
        search: "",
      }).map((user) => user.id),
    ).toEqual(["admin-1", "user-1"])
  })

  it("keeps the page unchanged when searching for something that does not match the current admin", () => {
    const currentAdmin = {
      ...createUser("admin-1", "admin@example.com", "Admin", "2026-01-01T00:00:00.000Z"),
      role: "ADMIN",
    }
    const pageUsers = [
      createUser("user-1", "user1@example.com", "User 1", "2026-04-10T00:00:00.000Z"),
    ]

    expect(
      ensureCurrentAdminVisible({
        users: pageUsers,
        currentUser: currentAdmin,
        page: 1,
        limit: 20,
        search: "user1",
      }).map((user) => user.id),
    ).toEqual(["user-1"])
  })
})
