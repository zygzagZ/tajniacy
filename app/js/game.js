const counts = {
  blue: 8,
  red: 8,
  black: 1,
  grey: 7
}

function extend(source, target) {
  for (var i in target) {
    if (!Object.prototype.hasOwnProperty.call(target, i)) continue
    if (typeof target[i] === 'object' && typeof source[i] === 'object') { // array or object
      extend(source[i], target[i])
      if (target[i] instanceof Array && source[i] instanceof Array) {
        target[i].length = source[i].length
      }
    } else {
      source[i] = target[i]
    }
  }
  return source
}

function updateState(changes) {
  extend(state, changes)

  if (state.error) {
    alert(state.error)
    delete state.error
  }

  if (!state.map) return

  if (changes.map) {
    $('.card').each((i, e) => {
      const el = $(e)
      const tile = state.map[i]

      for (var color in counts) {
        if (color !== tile.color) { el.removeClass(color) }
      }

      el.find('.card-word').text(tile.word)
      if (tile.color) el.addClass(tile.color)

      if (tile.clicked) { el.addClass('clicked') } else { el.removeClass('clicked') }
    })
  }

  if (changes.members) {
    const ut = $('.users-table').show()
    $('tbody', ut).html(state.members.map((e) => `<tr>
      <td> ${e.leader ? '<img class="image-crown" src="static/images/crown.jpg">' : ''} </td> 
      <td> ${e.nick} <div class="user-color"></div></td>
      <td class="leader-only">
        <button class="btn btn-${e.leader ? 'danger' : 'success'} toggle-leader" data-leader="${!!e.leader}">${e.leader ? '-' : '+'}</button>
      </td>
    </tr>`).join(''))

    $('.toggle-leader').click(function (el) {
      ws.sendJSON({
        type: $(this).data('leader') ? 'removeLeader' : 'addLeader',
        nick: $(this).parent().prev().text().trim()
      })
    })
  }

  if (state.leader) {
    $('.leader-only').show()
  } else {
    $('.leader-only').hide()
  }
}

let ws = null

const state = {}

function setNick(nick) {
  ws.sendJSON({ type: 'setNick', nick: nick })
}

let lastJoin = 0
function joinRoom(nick) {
  if (Date.now() - lastJoin < 10000) {
    return setTimeout(joinRoom, lastJoin + 10000 - Date.now(), nick)
  }
  lastJoin = Date.now()

  const playground = $('.playground').html('')
  for (let i = 0; i < 5; i++) playground.append('<div class="row">')
  for (let i = 0; i < 5; i++) $('.row', playground).append('<div class="card col">')

  $('.card')
    .append('<div class="card-color"></div><div class="card-bottom"><div class="card-word"></div></div>')
    .each((i, e) => {
      $(e).data('i', i)
    })
    .click(function () {
      const i = $(this).data('i')
      ws.sendJSON({ type: 'click', tile: i })
    })

  $('.reset-game').click(function () {
    ws.sendJSON({ type: 'restart' })
  })

  ws = new WebSocket(document.location.href.replace(/^http/, 'ws'))

  let pingInterval = null
  let lastPing = Date.now()

  ws.onerror = (e) => {
    console.error(e)
    clearInterval(pingInterval)
    if (state.map) {
      state.map.forEach((e) => {
        e.word = ''
      })
    }
  }

  ws.onmessage = (e) => {
    const data = JSON.parse(e.data)
    if (data.pong) $('.ping').text(`Ping: ${Date.now() - lastPing} ms`)
    if (data.redirect) document.location = data.redirect
    console.log('<<<', data)
    updateState(data)
  }

  ws.onopen = (e) => {
    if (state.token) ws.sendJSON({ type: 'authorize', token: state.token })
    else setNick(nick)
    pingInterval = setInterval(() => {
      lastPing = Date.now()
      ws.sendJSON({ type: 'ping' })
    }, 10000)
  }

  ws.onclose = (e) => {
    clearInterval(pingInterval)
    joinRoom()
  }

  ws.sendJSON = (data) => {
    console.log('>>>', data)
    ws.send(JSON.stringify(data))
  }
}

$(function () {
  $('.user-form').on('submit', function (ev) {
    ev.preventDefault()
    const nick = $('#user_nick').val().trim()
    if (!ws) {
      joinRoom(nick)
    } else {
      setNick(nick)
    }
    return false
  })
})
