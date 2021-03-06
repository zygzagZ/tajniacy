import { shuffle, colorCounts, teamColors } from './const.js'
const crypto = require('crypto')

function randomBase64(len) {
  return crypto.randomBytes(12).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_') // url safe
}

export default class Room {
  // members = []
  // leaders = []
  // auth = {}
  // map = []
  // id = null
  // dictionary = null
  // dictionaries
  // firstColor

  constructor(dictionaries, dict) {
    this.id = randomBase64(12)
    this.dictionaries = dictionaries
    this.members = []
    this.leaders = []
    this.map = []
    this.auth = {}
    this.duet = false

    this.setDictionary(dict)
    this.restart()
  }

  setDictionary(dict) {
    if (!this.dictionaries[dict]) dict = Object.keys(this.dictionaries)[0]
    this.leaders.forEach((l) => l.sendJSON({ dictionary: dict }))
    this.dictionary = this.dictionaries[dict]
  }

  restart() {
    const words = shuffle([...this.dictionary]).slice(0, 25)
    this.firstColor = shuffle([...teamColors])[0]

    const c = colorCounts[this.duet]

    const colors = []
    if (!this.duet) colors.push([this.firstColor])

    for (var color in c) {
      colors.push(...new Array(c[color]).fill(color.split('_')))
    }

    shuffle(colors)

    this.map = words.map((w, i) => ({
      word: w,
      color: colors[i],
      clicked: [false, false]
    }))

    this.hints = []

    this.getMemberSockets().forEach((socket) => this.sendMap(socket))
    this.broadcast({ firstColor: this.firstColor, hints: [] })
  }

  broadcast(data) {
    this.members.forEach((e) => e.sendJSON(data))
  }

  broadcastMembers() {
    return this.broadcast({
      members: this.members.map((e) => ({
        nick: e.nick,
        leader: !!e.leader,
        color: e.color
      }))
    })
  }

  getTileDescription(socket, tile) {
    const tileColor = []
    const team = teamColors.indexOf(socket.color)
    if (this.duet) {
      tileColor.push(tile.clicked[1 - team] || socket.leader ? tile.color[1 - team] : '')
      if (tile.clicked[0] !== tile.clicked[1]) {
        const neutralTeam = tile.color.reduce((a, c, i) => c === 'grey' && tile.clicked[i] ? i : a, null)
        if (neutralTeam !== null) tileColor.push(teamColors[neutralTeam])
      }
    } else if (tile.clicked[team] || socket.leader) tileColor.push(tile.color[0])

    return {
      clicked: tile.clicked[0] && tile.clicked[1], // the other team clicked info
      word: tile.word,
      color: tileColor
    }
  }

  sendMap(socket) {
    const view = {
      map: this.map.map((e) => this.getTileDescription(socket, e))
    }
    socket.sendJSON(view)
  }

  authorize(socket, token) {
    let auth = this.auth[token]
    if (!auth) {
      this.members.forEach((m, i) => {
        if (m.token !== token) return
        auth = m
        this.members[i] = socket
      })
      if (auth) {
        this.removeMember(auth)
        auth.close()
      }
    }
    if (!auth) return
    socket.color = auth.color
    socket.nick = auth.nick
    socket.authorized = true
    if (auth.leader) this.addLeader(socket, false)
    delete this.auth[token]
    this.addMember(socket, socket.nick)
    return true
  }

  addLeader(socket, broadcast = true) {
    if (socket.leader) return
    socket.leader = true
    this.leaders.push(socket)
    socket.sendJSON({ leader: true, dictionary: this.dictionary.name })
    this.sendMap(socket)
    if (broadcast) this.broadcastMembers()
  }

  removeLeader(socket) {
    if (!socket.leader) return
    this.leaders = this.leaders.filter((e) => e !== socket)
    socket.leader = false
    socket.sendJSON({ leader: false })
    this.broadcastMembers()
    this.sendMap(socket)
  }

  getMemberSockets() {
    return this.members
  }

  findMember(q) {
    return this.members.filter((e) => e === q || e.nick === q)[0]
  }

  addMember(socket, nick) {
    socket.member = true
    if (!socket.authorized) {
      socket.leader = false
      socket.color = shuffle([...teamColors])[0]
    }

    if (!this.findMember(socket)) {
      this.members.push(socket)
      // do not broadcast setNick, we will send them later
      this.setNick(socket, nick, false)
    }

    // if player's reconnecting he shouldn't become a leader
    // but if it's new player and there are no leaders in the room - he should so as not to lock the room
    if (!socket.authorized && this.leaders.length === 0) {
      this.addLeader(socket, false)
    } else {
      this.sendMap(socket)
      // addLeader calls them by itself
    }

    socket.token = randomBase64(24)
    socket.sendJSON({
      leader: socket.leader,
      token: socket.token,
      firstColor: this.firstColor,
      hints: this.hints,
      remaining: this.getRemainingTiles()
    })
    this.broadcastMembers()
  }

  removeMember(socket) {
    if (!socket.member) return
    this.auth[socket.token] = { leader: socket.leader, color: socket.color, nick: socket.nick }
    this.members = this.members.filter((e) => e !== socket)
    socket.member = false
    if (socket.leader) this.removeLeader(socket)
    else this.broadcastMembers()
  }

  getRemainingTiles() {
    if (this.duet) return null
    const remaining = { red: 0, blue: 0 }
    this.map.forEach((e) => {
      if (!e.clicked[0]) remaining[e.color]++
    })
    return remaining
  }

  clickTile(socket, tileIndex) {
    const tile = this.map[tileIndex]
    const team = teamColors.indexOf(socket.color)
    if (!tile || tile.clicked[team]) return

    tile.clicked[team] = true

    const singleColor = !this.duet ? tile.color[0]
      : tile.color.filter((c, i) => c !== 'grey' && tile.clicked[i])[0]

    if (singleColor) {
      tile.color = [singleColor, singleColor]
      tile.clicked = [true, true]
    }

    console.log(`${socket.nick} clicked tile ${tileIndex} "${tile.word}"`)

    const remaining = this.getRemainingTiles()
    this.members.forEach((socket) => socket.sendJSON(
      {
        map: { [tileIndex]: this.getTileDescription(socket, tile) },
        remaining
      }))
  }

  setNick(socket, nick, broadcast = true) {
    socket.nick = nick
    if (broadcast) this.broadcastMembers()
  }

  switchColor(socket, color) {
    socket.color = socket.color === 'red' ? 'blue' : 'red'
    this.broadcastMembers()
    if (this.duet) this.sendMap(socket)
  }

  addHint(socket, hint) {
    if (this.hints.length
      ? this.hints[0].color === socket.color
      : this.firstColor !== socket.color) {
      return
    }
    this.hints.unshift({ color: socket.color, hint })
    this.broadcast({ hints: this.hints })
    socket.sendJSON({ clearHint: true })
  }

  onMessage(socket, msg) {
    if (msg.type === 'setNick') {
      let nick = msg.nick && typeof msg.nick === 'string' && msg.nick.match(/^[A-Ża-ż0-9 _!]+$/)
      nick = nick && nick[0].trim()
      if (!nick || this.members.filter((m) => m.nick === nick).length) {
        return socket.sendJSON({ error: 'Niepoprawny nick!' })
      }

      if (!socket.member) this.addMember(socket, nick)
      else this.setNick(socket, nick)
    } else if (msg.type === 'authorize') {
      if (typeof msg.token !== 'string' || !this.authorize(socket, msg.token)) {
        socket.sendJSON({ error: 'Autoryzacja nieudana!' })
        socket.close()
      }
    } else if (!socket.member) {
      // remaining opcodes only for room members

    } else if (msg.type === 'ping') {
      socket.sendJSON({ pong: 1 })
    } else if (!socket.leader) {
      // remaining opcodes only for room leaders

    } else if (msg.type === 'addLeader' && typeof msg.nick === 'string') {
      const member = this.findMember(msg.nick)
      if (member) this.addLeader(member)
    } else if (msg.type === 'removeLeader' && typeof msg.nick === 'string') {
      const member = this.findMember(msg.nick)
      if (member) this.removeLeader(member)
    } else if (msg.type === 'switchColor' && typeof msg.nick === 'string') {
      const member = this.findMember(msg.nick)
      if (member) this.switchColor(member)
    } else if (msg.type === 'restart') {
      if (typeof msg.duet === 'boolean') {
        this.duet = msg.duet
      }
      this.restart()
    } else if (msg.type === 'click' && typeof msg.tile === 'number') {
      this.clickTile(socket, msg.tile)
    } else if (msg.type === 'addHint' && typeof msg.hint === 'string') {
      this.addHint(socket, msg.hint.trim())
    } else if (msg.type === 'setDictionary' && typeof msg.dictionary === 'string') {
      this.setDictionary(msg.dictionary)
    }
  }

  onSocket(socket) {
    socket.on('message', (json) => {
      try {
        const data = JSON.parse(json)
        this.onMessage(socket, data)
      } catch (err) {
        console.error(err, json)
      }
    })
    socket.on('close', (e) => this.removeMember(socket))
    socket.on('error', (e) => console.log('error', e))
  }
}
