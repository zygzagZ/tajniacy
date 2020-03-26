const crypto = require('crypto')
const shuffle = require('shuffle')

const counts = {
    blue: 8,
    red: 8,
    black: 1,
    grey: 7
}

export default class Room {
    members = []
    leaders = []
    map = []
    id = null
    kind = null
    dictionary

    constructor(dictionary, kind) {
        this.id = crypto.randomBytes(16).toString('hex')
        this.dictionary = dictionary
        this.setKind(kind)
        this.restart()
    }

    setKind(kind) {
        if (!this.dictionary[kind]) kind = Object.keys(this.dictionary)[0]
        this.kind = kind
    }

    restart() {
        const words = shuffle([...this.dictionary[this.kind]]).slice(0, 25)
        const first = shuffle(['red', 'blue'])[0]

        let colors = [first]
        for (var color in counts) {
            colors.push(...new Array(counts[color]).fill(color))
        }

        shuffle(colors)

        this.map = words.map((w, i) => ({
            word: w,
            color: colors[i],
            clicked: false
        }))

        this.broadcast({map: this.map})
    }

    addLeader(socket) {
        if (this.leaders.indexOf(socket) >= 0) return
        this.leader = socket
        socket.leader = true
    }

    removeLeader(socket) {
        this.leaders = leaders.filter((e) => e !== socket)
        socket.leader = false
    }

    addMember(socket) {
        if (this.members.indexOf(socket) < 0) {
            this.members.push(socket)
        }
        if (this.members.length === 1) {
            this.addLeader(socket)
            socket.send({id: this.id})
        }
    }

    removeMember(socket) {
        this.members = members.filter((e) => e !== socket)
    }

    clickTile(tileIndex) {
        const tile = this.map[tileIndex]
        if (!tile || tile.clicked) return
        tile.clicked = true
        this.broadcast({map: {[tileIndex]: {clicked: true, color: tile.color}}})
    }

    broadcast(data) {
        this.members.forEach((socket) => socket.send(data))
    }

    onMessage(socket, msg) {
        switch (msg.type) {
            case "getMap":
                socket.send({map: this.map, id: this.id})
                break
            case "setNick":
                this.setNick(socket, msg.nick)
                break
            default:
                if (!socket.leader) return
                switch (msg.type) {
                    case "addLeader":
                        this.addLeader(this.findByNick(msg.nick))
                        break
                    case "removeLeader":
                        this.removeLeader(this.findByNick(msg.nick))
                        break
                    case "restart":
                        this.restart()
                        break
                    case "click":
                        this.clickTile(msg.tile)
                }
        }
    }

    onSocket(socket) {
        socket.onmessage = (msg) => this.onMessage(socket, msg)
        addMember(socket)
    }
}
