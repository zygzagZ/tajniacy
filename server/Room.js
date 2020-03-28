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
  // kind = null
  // dictionary

  constructor(dictionary, kind) {
    this.id = randomBase64(12)
    this.dictionary = dictionary
    this.members = []
    this.leaders = []
    this.map = []
    this.auth = {}

    console.log(this.id, 'created')
    this.setKind(kind)
    this.restart()
  }

  setKind(kind) {
    if (!this.dictionary[kind]) kind = Object.keys(this.dictionary)[0]
    this.kind = kind
  }

  restart() {
    console.log(this.id, 'restart')
    const words = shuffle([...this.dictionary[this.kind]]).slice(0, 25)
    const first = shuffle(['red', 'blue'])[0]

    const colors = [first]
    for (var color in counts) {
      colors.push(...new Array(counts[color]).fill(color))
    }

    shuffle(colors)

    this.map = words.map((w, i) => ({
      word: w,
      color: colors[i],
      clicked: false
    }))

    this.getMemberSockets().forEach((socket) => this.sendMap(socket))
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

  addLeader(socket, broadcast = true) {
    if (socket.leader) return
    socket.leader = true
    this.leaders.push(socket)
    socket.sendJSON({ leader: true })
    this.sendMap(socket)
    if (broadcast) this.broadcastMembers()
  }

  removeLeader(socket) {
    if (!socket.leader) return
    this.leaders = this.leaders.filter((e) => e !== socket)
    if (!this.leaders.length && this.members.length) this.addLeader(this.members[0])
    socket.leader = false
    socket.sendJSON({ leader: false })
    this.broadcastMembers()
    this.sendMap(socket)
  }

  getMemberSockets() {
    return this.members
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

    if (this.members.length === 1) {
      this.addLeader(socket, false)
    } else {
      // addLeader calls them by itself
      this.sendMap(socket)
    }
    if (!socket.leader) socket.sendJSON({ leader: false })
    this.sendToken(socket)
    this.broadcastMembers()
  }

  findMember(q) {
    return this.members.filter((e) => e === q || e.nick === q)[0]
  }

  removeMember(socket) {
    this.auth[socket.token] = { leader: socket.leader, color: socket.color, nick: socket.nick }
    this.members = this.members.filter((e) => e !== socket)
    if (socket.leader) this.removeLeader(socket)
    else this.broadcastMembers()
  }

  clickTile(tileIndex) {
    const tile = this.map[tileIndex]
    if (!tile || tile.clicked) return
    tile.clicked = true
    this.broadcast({ map: { [tileIndex]: { clicked: true, color: tile.color } } })
  }

  broadcast(data) {
    this.members.forEach((e) => e.sendJSON(data))
  }

  setNick(socket, nick, broadcast = true) {
    socket.nick = nick
    if (broadcast) this.broadcastMembers()
  }

  switchColor(socket, color) {
    socket.color = socket.color === 'red' ? 'blue' : 'red'
    this.broadcastMembers()
  }

  authorize(socket, token) {
    const auth = this.auth[token]
    if (!auth) return
    socket.color = auth.color
    socket.nick = auth.nick
    socket.authorized = true
    if (auth.leader) this.addLeader(socket, false)
    delete this.auth[token]
    return true
  }

  sendToken(socket) {
    if (!socket.token) socket.token = randomBase64(24)
    socket.sendJSON({ token: socket.token })
  }

  onMessage(socket, msg) {
    if (msg.type === 'setNick') {
      let nick = msg.nick && typeof msg.nick === 'string' && msg.nick.match(/^[A-Ża-ż0-9 _!]+$/)
      nick = nick && nick[0].trim()
      if (!nick) return socket.sendJSON({ error: 'Niepoprawny nick!' })

      if (!socket.member) this.addMember(socket, nick)
      else this.setNick(socket, nick)
    } else if (msg.type === 'authorize') {
      if (!this.authorize(socket, msg.token)) {
        socket.sendJSON({ error: 'Autoryzacja nieudana!' })
        socket.close()
        return
      }
      this.addMember(socket, socket.nick)
    } else if (!socket.member) {
      // remaining opcodes only for room members
    } else if (msg.type === 'getToken') {
      this.sendToken(socket)
    } else if (!socket.leader) {
      // remaining opcodes only for room leaders
    } else if (msg.type === 'addLeader') {
      const member = this.findMember(msg.nick)
      if (member) this.addLeader(member)
    } else if (msg.type === 'removeLeader') {
      const member = this.findMember(msg.nick)
      if (member) this.removeLeader(member)
    } else if (msg.type === 'switchColor') {
      const member = this.findMember(msg.nick)
      if (member) this.switchColor(member)
    } else if (msg.type === 'restart') {
      this.restart()
    } else if (msg.type === 'click') {
      this.clickTile(msg.tile)
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
