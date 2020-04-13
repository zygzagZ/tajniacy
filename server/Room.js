import shuffle from './shuffle.js'
const crypto = require('crypto')

const counts = {
  blue: 8,
  red: 8,
  black: 1,
  grey: 7
}

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

    console.log(this.id, 'created')
    this.setDictionary(dict)
    this.restart()
  }

  setDictionary(dict) {
    if (!this.dictionaries[dict]) dict = Object.keys(this.dictionaries)[0]
    this.leaders.forEach((l) => l.sendJSON({ dictionary: dict }))
    this.dictionary = this.dictionaries[dict]
  }

  restart() {
    console.log(this.id, 'restart')
    const words = shuffle([...this.dictionary]).slice(0, 25)
    this.firstColor = shuffle(['red', 'blue'])[0]

    const colors = [this.firstColor]
    for (var color in counts) {
      colors.push(...new Array(counts[color]).fill(color))
    }

    shuffle(colors)

    this.map = words.map((w, i) => ({
      word: w,
      color: colors[i],
      clicked: false
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

  sendMap(socket) {
    const view = {
      map: this.map.map((e) => ({
        clicked: e.clicked,
        word: e.word,
        color: (e.clicked || socket.leader) ? e.color : null
      }))
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
        console.log('Player', auth.nick, 'authorized but old is still connected!')
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
      socket.color = shuffle(['red', 'blue'])[0]
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
      hints: this.hints
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

  clickTile(tileIndex) {
    const tile = this.map[tileIndex]
    if (!tile || tile.clicked) return
    tile.clicked = true
    this.broadcast({ map: { [tileIndex]: { clicked: true, color: tile.color } } })
  }

  setNick(socket, nick, broadcast = true) {
    socket.nick = nick
    if (broadcast) this.broadcastMembers()
  }

  switchColor(socket, color) {
    socket.color = socket.color === 'red' ? 'blue' : 'red'
    this.broadcastMembers()
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
      this.restart()
    } else if (msg.type === 'click' && typeof msg.tile === 'number') {
      this.clickTile(msg.tile)
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
