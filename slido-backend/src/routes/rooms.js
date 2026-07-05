const express = require('express')
const { z } = require('zod')
const roomService = require('../services/roomService')
const { roomsLimiter } = require('../middleware/rateLimiter')

const createRoomSchema = z.object({ name: z.string().trim().max(60).optional() })
const CODE_PATTERN = /^[A-Z2-9]{6}$/

const router = express.Router()
router.use(roomsLimiter)

router.post('/rooms', async (req, res, next) => {
  try {
    const parsed = createRoomSchema.safeParse(req.body || {})
    if (!parsed.success) return res.status(400).json({ error: 'invalid_body' })

    const { roomId, code, presenterToken } = await roomService.createRoom(parsed.data.name)
    res.status(201).json({ roomId, code, presenterToken })
  } catch (err) {
    next(err)
  }
})

router.get('/rooms/:code', async (req, res, next) => {
  try {
    const code = String(req.params.code || '').toUpperCase()
    if (!CODE_PATTERN.test(code)) return res.json({ exists: false, active: false })

    const room = await roomService.findActiveByCode(code)
    res.json({ exists: Boolean(room), active: Boolean(room) })
  } catch (err) {
    next(err)
  }
})

module.exports = router
