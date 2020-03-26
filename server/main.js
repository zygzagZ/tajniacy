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
app.use(expressStatic)

app.get('/dictionary.json', (res, req) => {
  req.send(dictionaryNames)
})

app.ws('/:id', (ws, req) => {
  const id = req.params.id
  let room = rooms[id]
  if (!room) {
    room = new Room(dictionary, dictionaryNames[0])
    rooms[room.id] = room
  }
  room.addMember(ws)
})

app.listen(3000)
