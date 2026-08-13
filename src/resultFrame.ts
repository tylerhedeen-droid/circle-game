import type { Point, ScoreResult } from './scoring'

export type FrameTransform = { scale: number; offsetX: number; offsetY: number }

/** Fits the complete user stroke and fitted-circle circumference into a preview.
 * Padding includes both line widths plus 9% of the larger content dimension. */
export function resultFrameTransform(
  points: Point[], fit: Pick<ScoreResult, 'center' | 'radius'>,
  width: number, height: number, strokeWidth = 7, fitLineWidth = 2, paddingRatio = .09,
): FrameTransform {
  const halfLine = Math.max(strokeWidth, fitLineWidth) / 2
  const xs = points.map(p => p.x), ys = points.map(p => p.y)
  const minX = Math.min(...xs, fit.center.x - fit.radius) - halfLine
  const maxX = Math.max(...xs, fit.center.x + fit.radius) + halfLine
  const minY = Math.min(...ys, fit.center.y - fit.radius) - halfLine
  const maxY = Math.max(...ys, fit.center.y + fit.radius) + halfLine
  const contentW = Math.max(1, maxX - minX), contentH = Math.max(1, maxY - minY)
  const padding = Math.max(contentW, contentH) * paddingRatio
  const paddedW = contentW + padding * 2, paddedH = contentH + padding * 2
  const scale = Math.min(width / paddedW, height / paddedH)
  return {
    scale,
    offsetX: (width - contentW * scale) / 2 - minX * scale,
    offsetY: (height - contentH * scale) / 2 - minY * scale,
  }
}
