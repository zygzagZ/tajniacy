import shuffle from './shuffle.js'
const crypto = require('crypto')

const counts = {
  blue: 8,
  red: 8,
  black: 1,
  grey: 7
}

export default class Room {
  // members = []
  // leaders = []
  // map = []
  // id = null
  // kind = null
  // dictionary

  constructor(dictionary, kind) {
    this.id = crypto.randomBytes(12).toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_') // url safe
    this.dictionary = dictionary
    this.members = []
    this.leaders = []
    this.map = []

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
        leader: !!e.leader
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

  addLeader(socket) {
    if (socket.leader) return
    socket.leader = true
    this.leaders.push(socket)
    socket.sendJSON({ leader: true })
    this.sendMap(socket)
    this.broadcastMembers()
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

  addMember(socket, nick) {
    console.log(this.id, 'addMember', socket.nick)
    socket.member = true

    if (!this.findMember(socket)) {
      this.members.push(socket)
      this.setNick(socket, nick)
    }

    if (this.members.length === 1) {
      this.addLeader(socket)
    }

    this.broadcastMembers()
    this.sendMap(socket)
    socket.sendJSON({ leader: socket.leader })
  }

  findMember(q) {
    return this.members.filter((e) => e === q || e.nick === q)[0]
  }

  removeMember(socket) {
    this.members = this.members.filter((e) => e !== socket)
    this.broadcastMembers()
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

  setNick(socket, nick) {
    socket.nick = nick
    this.broadcastMembers()
  }

  onMessage(socket, msg) {
    console.log(this.id, 'onMessage', msg, 'leader?', socket.leader, socket.nick)
    switch (msg.type) {
      case 'ping':
        socket.sendJSON({ pong: 1 })
        break
      case 'setNick': {
        let nick = msg.nick && typeof msg.nick === 'string' && msg.nick.match(/^[A-Ża-ż0-9 _!]+$/)
        nick = nick && nick[0].trim()
        if (!nick) {
          socket.sendJSON({ error: 'Niepoprawny nick!' })
          return
        }

        if (!socket.member) this.addMember(socket, nick)
        else this.setNick(socket, nick)
        break
      }
      default:
        if (!socket.leader) return
        switch (msg.type) {
          case 'addLeader': {
            const member = this.findMember(msg.nick)
            if (member) this.addLeader(member)
            break
          }
          case 'removeLeader': {
            const member = this.findMember(msg.nick)
            if (member) this.removeLeader(member)
            break
          }
          case 'restart':
            this.restart()
            break
          case 'click':
            this.clickTile(msg.tile)
        }
    }
  }

  onSocket(socket) {
    socket.sendJSON = (data) => socket.send(JSON.stringify(data))
    socket.on('message', (json) => {
      try {
        const data = JSON.parse(json)
        if (data.type === 'setNick' || socket.member) {
          this.onMessage(socket, data)
        }
      } catch (err) {
        console.error(err, json)
      }
    })
    socket.on('close', (e) => this.removeMember(socket))
    socket.on('error', (e) => console.log('error', e))
  }
}
