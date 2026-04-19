export interface UserEditFormState {
  role: string
  tier: string
  isActive: boolean
  addCredits: number
}

type UserEditFormSeed = Omit<UserEditFormState, "addCredits"> & {
  addCredits?: number
}

export function createUserEditFormState(user: UserEditFormSeed): UserEditFormState {
  return {
    role: user.role,
    tier: user.tier,
    isActive: user.isActive,
    addCredits: user.addCredits ?? 0,
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
