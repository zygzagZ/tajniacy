import Room from './Room'

const path = require('path')
const dir = path.join(__dirname, '../app/')
const express = require('express')
const fs = require('fs')

const dictionary = JSON.parse(fs.readFileSync(path.join(__dirname, './words.json')))
const app = express()
const rooms = {}

const dictionaryNames = Object.keys(dictionary)

require('express-ws')(app)
const expressStatic = express.static(dir)

app.get('/dictionary.json', (res, req) => {
  req.send(dictionaryNames)
})

function deleteRoom(id) {
  console.log('Usuwanie pokoju', id)
  delete rooms[id]
}

app.get('/', (req, res) => {
  const room = new Room(dictionary, dictionaryNames[0])
  if (rooms[room.id]) return res.send(500, 'Failed to create room')

  rooms[room.id] = room

  room.closeTimeout = setTimeout(deleteRoom, 5 * 60 * 1000, room.id)

  res.redirect(302, `/${room.id}`)
})

app.use(expressStatic)

app.get('/:id', (req, res) => {
  if (!rooms[req.params.id]) {
    console.log('404 nie ma pokoju', req.params.id)
    return res.redirect(302, '/404.html')
  }
  res.sendFile('index.html', { root: dir })
})

app.ws('/:id', (ws, req) => {
  const room = rooms[req.params.id]

  ws.sendJSON = (data) => {
    if (ws.readyState === ws.OPEN) { // socket is open
      ws.send(JSON.stringify(data))
    }
  }
  if (!room) {
    ws.sendJSON({ redirect: '/404.html' })
    console.log('[WS] 404 nie ma pokoju', req.params.id)
    return ws.close()
  }

  console.log('ws connected', room.id)

  if (room.closeTimeout) {
    console.log('Pokoj jednak uzywany!', room.id)
    clearTimeout(room.closeTimeout)
    room.closeTimeout = null
  }

  room.onSocket(ws)
  ws.on('close', (e) => {
    if (room.members.length !== 0) return
    console.log('Pokój przygotowany do usunięcia za 5 minut', room.id)
    room.closeTimeout = setTimeout(deleteRoom, 5 * 60 * 1000, room.id)
  })
})

const port = process.env.PORT || 3000

app.listen(port, () => console.log('Listening on port', port))
