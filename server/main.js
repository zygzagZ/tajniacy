#!/usr/bin/env nodejs
const dir = path.join(__dirname, '/musicPage/')
const express = require('express')
const fs = require('fs')
const crypto = require('crypto')

var app = express()

require('express-ws')(app)
const expressStatic = express.static(dir)
app.use((req, res, next) => {
  if (req.originalUrl.substr(0, 2) === '/?') {
    return next()
  }
  return expressStatic(req, res, next)
})
app.ws('/ws', wsHandler)

app.listen(3000)
