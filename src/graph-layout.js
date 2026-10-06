'use strict'

// Deterministic multistart layout: source counts control centrality, while
// optimization balances label clearance, node spacing and edge crossings.
module.exports = function untangleNetworkPositions(nodes, links, width, height, radiusFor) {
  height = Math.max(640, height)
  const result = new Map()
  result.height = height
  if (!nodes.length) return result
  const ranked = nodes.slice().sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0) || String(a.id).localeCompare(String(b.id)))
  const n = ranked.length, index = new Map(ranked.map((node, i) => [node.id, i]))
  const seen = new Set()
  const edges = links.flatMap(link => {
    const a = index.get(link.source), b = index.get(link.target)
    if (a == null || b == null || a === b) return []
    const key = [a, b].sort((x, y) => x - y).join(':')
    if (seen.has(key)) return []
    seen.add(key)
    return [{ a, b, weight: Number(link.weight) || 1 }]
  })
  const edgePairs = []
  for (let i = 0; i < edges.length; i += 1) for (let j = i + 1; j < edges.length; j += 1) {
    const e = edges[i], f = edges[j]
    if (e.a !== f.a && e.a !== f.b && e.b !== f.a && e.b !== f.b) edgePairs.push([e.a, e.b, f.a, f.b])
  }
  const cx = width / 2, cy = height / 2 - 12
  const rx = width / 2 - 80, ry = height / 2 - 72
  const radii = ranked.map(node => Math.max(13, radiusFor(node)))
  const targets = ranked.map((_, i) => i === 0 ? 0 : .32 + .66 * Math.sqrt((i - 1) / Math.max(1, n - 2)))
  const orient = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  const score = points => {
    let cost = 0
    for (let i = 0; i < n; i += 1) {
      const a = points[i]
      const radial = Math.hypot((a.x - cx) / rx, (a.y - cy) / ry)
      cost += 100 * (radial - targets[i]) ** 2
      for (let j = i + 1; j < n; j += 1) {
        const b = points[j], dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y)
        const d = Math.hypot(dx, dy)
        // Central nodes receive extra breathing room. Boxes include labels.
        const clearance = radii[i] + radii[j] + (i < 3 ? 60 : 40)
        cost += 16 * (100 / Math.max(1, d)) ** 2
        cost += 1500 * Math.max(0, 1 - d / clearance) ** 2
        const boxHeight = Math.max(radii[i], radii[j]) * 2 + 38
        if (dx < 112 && dy < boxHeight) cost += 3000 * Math.min(1 - dx / 112, 1 - dy / boxHeight) ** 2
      }
    }
    for (const e of edges) {
      const a = points[e.a], b = points[e.b], dx = b.x - a.x, dy = b.y - a.y
      const length2 = dx * dx + dy * dy
      cost += .2 * Math.sqrt(length2) / 100
      for (let i = 0; i < n; i += 1) {
        if (i === e.a || i === e.b) continue
        const p = points[i], t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (length2 || 1)
        if (t <= 0 || t >= 1) continue
        const d = Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy)
        cost += 60 * Math.max(0, 1 - d / (radii[i] + 8)) ** 2
      }
    }
    for (const [a, b, c, d] of edgePairs) {
      if (orient(points[a], points[b], points[c]) * orient(points[a], points[b], points[d]) < 0 &&
          orient(points[c], points[d], points[a]) * orient(points[c], points[d], points[b]) < 0) cost += 35
    }
    return cost
  }
  let seed = 72391
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
  let bestCost = Infinity, best
  // Dense networks have inherently unavoidable crossings; cap the work budget.
  const steps = edges.length > 100 ? 1000 : 2200
  for (let trial = 0; trial < 3; trial += 1) {
    const points = ranked.map((_, i) => {
      const angle = i * 2.399963229728653 + trial * .7
      return { x: cx + rx * targets[i] * Math.cos(angle), y: cy + ry * targets[i] * Math.sin(angle) }
    })
    let current = score(points)
    if (current < bestCost) { bestCost = current; best = points.map(p => ({ ...p })) }
    for (let step = 0; step < steps && n > 1; step += 1) {
      const i = 1 + Math.floor(random() * (n - 1)), old = points[i]
      const progress = step / steps, angle = Math.atan2((old.y - cy) / ry, (old.x - cx) / rx)
      const nextAngle = angle + (random() - .5) * (1.4 * (1 - progress) + .12)
      const radial = Math.max(.15, Math.min(1, targets[i] + (random() - .5) * .26))
      points[i] = { x: cx + rx * radial * Math.cos(nextAngle), y: cy + ry * radial * Math.sin(nextAngle) }
      let swappedIndex = null, swappedOld = null
      if (n > 2 && random() < .2) {
        const j = 1 + Math.floor(random() * (n - 1))
        if (j !== i) {
          swappedIndex = j; swappedOld = points[j]
          const otherAngle = Math.atan2((swappedOld.y - cy) / ry, (swappedOld.x - cx) / rx)
          const otherRadial = Math.hypot((swappedOld.x - cx) / rx, (swappedOld.y - cy) / ry)
          const oldRadial = Math.hypot((old.x - cx) / rx, (old.y - cy) / ry)
          points[i] = { x: cx + rx * oldRadial * Math.cos(otherAngle), y: cy + ry * oldRadial * Math.sin(otherAngle) }
          points[j] = { x: cx + rx * otherRadial * Math.cos(angle), y: cy + ry * otherRadial * Math.sin(angle) }
        }
      }
      const candidate = score(points), temperature = 9 * (1 - progress) ** 2 + .02
      if (candidate < current || random() < Math.exp((current - candidate) / temperature)) current = candidate
      else { points[i] = old; if (swappedIndex != null) points[swappedIndex] = swappedOld }
      if (current < bestCost) { bestCost = current; best = points.map(p => ({ ...p })) }
    }
  }
  // Final separation handles the last few pixels of label/circle collisions.
  for (let pass = 0; pass < 100; pass += 1) {
    let changed = false
    for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) {
      const a = best[i], b = best[j], dx = b.x - a.x, dy = b.y - a.y
      const hx = 114 - Math.abs(dx), hy = Math.max(radii[i], radii[j]) * 2 + 40 - Math.abs(dy)
      if (hx <= 0 || hy <= 0) continue
      const axis = hx < hy ? 'x' : 'y', delta = (axis === 'x' ? hx : hy) + .5
      const sign = (axis === 'x' ? dx : dy) >= 0 ? 1 : -1
      b[axis] += sign * delta * (i === 0 ? 1 : .5)
      if (i !== 0) a[axis] -= sign * delta * .5
      changed = true
    }
    for (let i = 1; i < n; i += 1) {
      best[i].x = Math.max(65, Math.min(width - 65, best[i].x))
      best[i].y = Math.max(45, Math.min(height - 65, best[i].y))
    }
    if (!changed) break
  }
  ranked.forEach((node, i) => result.set(node.id, best[i]))
  return result
}
