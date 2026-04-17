import test from "node:test"
import assert from "node:assert/strict"

import {
  createUserEditFormState,
  createUserUpdatePayload,
} from "./user-edit-modal-state.ts"

test("createUserEditFormState seeds controlled modal fields from the selected user", () => {
  assert.deepEqual(
    createUserEditFormState({
      role: "ADMIN",
      tier: "PRO",
      isActive: false,
    }),
    {
      role: "ADMIN",
      tier: "PRO",
      isActive: false,
    },
  )
})

test("createUserUpdatePayload preserves the admin API payload shape", () => {
  assert.deepEqual(
    createUserUpdatePayload("user-123", {
      role: "PRO",
      tier: "FREE",
      isActive: true,
    }),
    {
      userId: "user-123",
      role: "PRO",
      tier: "FREE",
      isActive: true,
    },
  )
})
