const counts = {
  blue: 8,
  red: 8,
  black: 1,
  grey: 7
}

function setState(newState) {
  console.log('setState', JSON.stringify(newState))
  state = newState

  if (state.error) {
    alert(state.error)
    delete state.error
  }

  if (!state.map) return

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

  const ut = $('.users-table').show()
  $('tbody', ut).html(state.members.map((e) => `<tr>
      <td> ${e.leader ? '<img class="image-crown" src="static/images/crown.jpg">' : ''} </td> 
      <td> ${e.nick} </td>
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

  if (state.leader) {
    $('.leader-only').show()
  } else {
    $('.leader-only').hide()
  }
}

function extend(source, target) {
  for (var i in target) {
    if (!Object.prototype.hasOwnProperty.call(target, i)) continue
    if (typeof target[i] === 'object' && typeof source[i] === 'object') {
      extend(source[i], target[i])
    } else {
      source[i] = target[i]
    }
  }
  return source
}

function updateState(changes) {
  setState(extend(state, changes))
}

let ws = null

let state = {}

function setNick(nick) {
  ws.sendJSON({ type: 'setNick', nick: nick })
}

function joinRoom(nick) {
  for (let i = 0; i < 5; i++) $('.playground').append('<div class="row">')
  for (let i = 0; i < 5; i++) $('.playground .row').append('<div class="card col">')

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

  ws.onerror = (e) => {
    console.error(e)
    // alert(e)
  }

  ws.onmessage = (e) => {
    const data = JSON.parse(e.data)
    updateState(data)
  }

  ws.onopen = (e) => {
    setNick(nick)
    setInterval(() => ws.sendJSON({ type: 'ping' }), 10000)
  }

  ws.onclose = (e) => console.log('close', e)

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
