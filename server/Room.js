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
    this.id = crypto.randomBytes(16).toString('hex')
    this.dictionary = dictionary
    this.members = []
    this.leaders = []
    this.map = []

    this.setKind(kind)
    this.restart()
    console.log('new room', this.id)
  }

  setKind(kind) {
    if (!this.dictionary[kind]) kind = Object.keys(this.dictionary)[0]
    this.kind = kind
  }

  restart() {
    console.log('restart!')
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

    this.members.forEach((socket) => this.sendMap(socket))
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
  }

  removeLeader(socket) {
    if (!socket.leader) return
    this.leaders = this.leaders.filter((e) => e !== socket)
    socket.leader = false
    socket.sendJSON({ leader: false })
  }

  addMember(socket) {
    console.log('addMember')
    if (this.members.indexOf(socket) < 0) {
      this.members.push(socket)
    }
    if (this.members.length === 1) {
      this.addLeader(socket)
    }
    this.sendMap(socket)
    socket.sendJSON({ leader: socket.leader })
  }

  removeMember(socket) {
    this.members = this.members.filter((e) => e !== socket)
  }

  clickTile(tileIndex) {
    const tile = this.map[tileIndex]
    if (!tile || tile.clicked) return
    tile.clicked = true
    this.broadcast({ map: { [tileIndex]: { clicked: true, color: tile.color } } })
  }

  broadcast(data) {
    this.members.forEach((socket) => socket.sendJSON(data))
  }

  onMessage(socket, msg) {
    console.log('onMessage', msg, 'leader?', socket.leader)
    switch (msg.type) {
      case 'setNick':
        this.setNick(socket, msg.nick)
        break
      default:
        if (!socket.leader) return
        switch (msg.type) {
          case 'addLeader':
            this.addLeader(this.findByNick(msg.nick))
            break
          case 'removeLeader':
            this.removeLeader(this.findByNick(msg.nick))
            break
          case 'restart':
            this.restart()
            break
          case 'click':
            this.clickTile(msg.tile)
        }
    }
  }

  onSocket(socket) {
    socket.on('message', (data) => {
      try {
        this.onMessage(socket, JSON.parse(data))
      } catch (err) {
        console.error(err, data)
      }
    })
    socket.on('close', (e) => this.removeMember(socket))
    socket.on('error', (e) => console.log('error', e))
    socket.on('open', (e) => console.log('open', e))
    socket.sendJSON = (data) => socket.send(JSON.stringify(data))
    this.addMember(socket)
  }
}
