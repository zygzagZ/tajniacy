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

function getRoom(id) {
  let room = rooms[id]
  if (!room) {
    room = new Room(dictionary, dictionaryNames[0])
    rooms[room.id] = room
  }
  return room
}

app.get('/:id?', (req, res) => {
  const id = req.params.id
  const room = getRoom(req.params.id)
  if (room.id !== id) return res.redirect(301, `/${room.id}`)
  res.sendFile('index.html', { root: dir })
})

app.ws('/:id', (ws, req) => {
  const room = getRoom(req.params.id)

  room.onSocket(ws)
  ws.on('close', (e) => {
    if (room.members.length !== 0) return
    console.log('deleting room', room.id)
    delete rooms[room.id]
  })
})

app.use(expressStatic)

app.listen(3000, () => console.log('listening', 3000))
