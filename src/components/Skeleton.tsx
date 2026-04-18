"use client"

// Skeleton loading component for content placeholders
interface SkeletonProps {
  className?: string
  variant?: "text" | "circular" | "rectangular"
  width?: string | number
  height?: string | number
  animation?: "pulse" | "wave" | "none"
}

export function Skeleton({
  className = "",
  variant = "rectangular",
  width,
  height,
  animation = "pulse",
}: SkeletonProps) {
  const baseClasses = "bg-surface-elevated"

  const animationClasses = {
    pulse: "animate-pulse",
    wave: "animate-shimmer",
    none: "",
  }

  const variantClasses = {
    text: "rounded h-4",
    circular: "rounded-full",
    rectangular: "rounded-lg",
  }

  const style: React.CSSProperties = {}
  if (width) style.width = typeof width === "number" ? `${width}px` : width
  if (height) style.height = typeof height === "number" ? `${height}px` : height

  return (
    <div
      className={`${baseClasses} ${animationClasses[animation]} ${variantClasses[variant]} ${className}`}
      style={style}
    />
  )
}

// Skeleton for song cards
export function SongCardSkeleton() {
  return (
    <div className="p-6 rounded-2xl bg-surface border border-border">
      <Skeleton height="128px" className="mb-4" />
      <Skeleton variant="text" className="w-3/4 mb-2" />
      <Skeleton variant="text" className="w-1/2 h-3 mb-3" />
      <div className="flex gap-2">
        <Skeleton width={50} height={24} className="rounded-full" />
        <Skeleton width={50} height={24} className="rounded-full" />
      </div>
    </div>
  )
}

// Skeleton for playlist cards
export function PlaylistCardSkeleton() {
  return (
    <div className="p-6 rounded-2xl bg-surface border border-border">
      <div className="flex items-start gap-4">
        <Skeleton width={64} height={64} className="rounded-xl" />
        <div className="flex-1">
          <Skeleton variant="text" className="w-1/2 mb-2" />
          <Skeleton variant="text" className="w-3/4 h-3 mb-2" />
          <Skeleton variant="text" className="w-1/4 h-3" />
        </div>
      </div>
    </div>
  )
}

// Skeleton grid for discover page
export function DiscoverGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <SongCardSkeleton key={i} />
      ))}
    </div>
  )
}

// Filter bar skeleton
export function FilterBarSkeleton() {
  return (
    <div className="flex flex-wrap gap-4 p-4 rounded-2xl bg-surface border border-border">
      <Skeleton width={200} height={40} className="rounded-lg" />
      <Skeleton width={120} height={40} className="rounded-lg" />
      <Skeleton width={120} height={40} className="rounded-lg" />
      <Skeleton width={120} height={40} className="rounded-lg" />
      <Skeleton width={100} height={40} className="rounded-lg ml-auto" />
    </div>
  )
}
