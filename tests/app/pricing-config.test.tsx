import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const pushMock = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

describe("Pricing page stripe config", () => {
  beforeEach(() => {
    pushMock.mockReset()
    vi.resetModules()
  })

  it("disables pro checkout when public stripe price ids are not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID", "")
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID", "")

    const { default: PricingPage } = await import("@/app/pricing/page")
    render(<PricingPage />)

    const upgradeButtons = screen.getAllByRole("button", { name: /upgradeToPro/i })
    const upgradeButton = upgradeButtons[0]

    expect(upgradeButton).toBeDisabled()
    fireEvent.click(upgradeButton)
    expect(pushMock).not.toHaveBeenCalled()
  })
})
