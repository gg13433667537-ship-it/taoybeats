export interface UserEditFormState {
  role: string
  tier: string
  isActive: boolean
}

export function createUserEditFormState(user: UserEditFormState): UserEditFormState {
  return {
    role: user.role,
    tier: user.tier,
    isActive: user.isActive,
  }
}

export function createUserUpdatePayload(
  userId: string,
  updates: Partial<UserEditFormState>,
) {
  return {
    userId,
    ...updates,
  }
}
