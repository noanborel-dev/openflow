import { describe, it, expect } from 'vitest'
import { SerialQueue } from './serial-queue'

const tick = () => new Promise<void>((r) => setTimeout(r, 5))

describe('SerialQueue', () => {
  it('runs at most one task at a time (no overlap)', async () => {
    const q = new SerialQueue()
    let active = 0
    let maxActive = 0
    const task = async () => {
      active++
      maxActive = Math.max(maxActive, active)
      await tick()
      active--
    }
    await Promise.all([q.run(task), q.run(task), q.run(task)])
    expect(maxActive).toBe(1)
  })

  it('runs tasks in FIFO submission order', async () => {
    const q = new SerialQueue()
    const order: number[] = []
    const make = (n: number) => async () => {
      await tick()
      order.push(n)
    }
    await Promise.all([q.run(make(1)), q.run(make(2)), q.run(make(3))])
    expect(order).toEqual([1, 2, 3])
  })

  it('propagates a task return value to its own caller', async () => {
    const q = new SerialQueue()
    await expect(q.run(async () => 42)).resolves.toBe(42)
  })

  it('does not let a rejecting task block later tasks', async () => {
    const q = new SerialQueue()
    const boom = q.run(async () => {
      throw new Error('boom')
    })
    const after = q.run(async () => 'ok')
    await expect(boom).rejects.toThrow('boom')
    await expect(after).resolves.toBe('ok')
  })

  it('interleaves start/end strictly (task N finishes before N+1 starts)', async () => {
    const q = new SerialQueue()
    const log: string[] = []
    const make = (n: number) => async () => {
      log.push(`start${n}`)
      await Promise.resolve()
      log.push(`end${n}`)
    }
    await Promise.all([q.run(make(1)), q.run(make(2))])
    expect(log).toEqual(['start1', 'end1', 'start2', 'end2'])
  })
})
