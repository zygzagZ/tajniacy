const counts = {
  blue: 8,
  red: 8,
  black: 1,
  grey: 7
}
function shuffle(array) {
  let counter = array.length

  // While there are elements in the array
  while (counter > 0) {
    // Pick a random index
    const index = Math.floor(Math.random() * counter)

    // Decrease counter by 1
    counter--

    // And swap the last element with it
    const temp = array[counter]
    array[counter] = array[index]
    array[index] = temp
  }

  return array
}

const dictionaries = []
fetch('dictionaries.json').then((r) => r.json()).then((d) => {
  dictionaries.push(...d)
  $('#dictionary').html(dictionaries.map((name) => `<option>${name}</option>`).join())
})

function extend(source, target) {
  for (var i in target) {
    if (!Object.prototype.hasOwnProperty.call(target, i)) continue
    if (typeof target[i] === 'object' && typeof source[i] === 'object') { // array or object
      extend(source[i], target[i])
      if (target[i] instanceof Array && source[i] instanceof Array) {
        source[i].length = target[i].length
      }
    } else {
      source[i] = target[i]
    }
  }
  return source
}

function updateState(changes) {
  if (changes.error) alert(changes.error)
  if (changes.clearHint) $('.hint-form input[name=hint]').val('')
  if (changes.firstColor) {
    $('.firstColor')
      .text(`Zaczyna zespół ${changes.firstColor === 'red' ? 'czerwony' : 'niebieski'}.`)
      .css('color', changes.firstColor === 'red' ? 'lightcoral' : 'lightblue')
  }
  if (changes.dictionary) $('#dictionary').val(changes.dictionary)

  extend(state, changes)

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
      <td> ${e.leader ? '<img alt="Leader" class="image-crown" src="static/images/crown.jpg">' : ''} </td> 
      <td>
        <div class="user-color ${e.color}"></div>
      </td>
      <td class="nick"> ${e.nick} </td>
      <td class="leader-only">
        <button class="btn btn-${e.leader ? 'danger' : 'success'} toggle-leader" data-leader="${!!e.leader}">${e.leader ? '-' : '+'}</button>
      </td>

    </tr>`).join(''))

    $('.toggle-leader', ut).click(function (el) {
      ws.sendJSON({
        type: $(this).data('leader') ? 'removeLeader' : 'addLeader',
        nick: $(this).closest('tr').find('.nick').text().trim()
      })
    })

    $('.user-color', ut).click(function (el) {
      ws.sendJSON({
        type: 'switchColor',
        nick: $(this).closest('tr').find('.nick').text().trim()
      })
    })
  }

  if (changes.hints) {
    const wt = $('.hints-table').show()
    $('tbody', wt).html(state.hints.map((e) => `<tr>
          <td class="${e.color}"> ${e.hint} </td>
        </tr>`).join(''))
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

function addHint(hint) {
  ws.sendJSON({ type: 'addHint', hint })
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

    const ping = () => {
      lastPing = Date.now()
      ws.sendJSON({ type: 'ping' })
    }
    pingInterval = setInterval(ping, 10000)
    ping()
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
    const nick = $('input[name=nick]', this).val().trim()
    if (!ws) {
      joinRoom(nick)
      $('.member-only').show()
      $('.pre-login').hide()
    } else {
      setNick(nick)
    }
  })

  $('.hint-form').on('submit', function (ev) {
    ev.preventDefault()
    const hint = $('input[name=hint]', this)
    if (!ws) return
    addHint(hint.val().trim())
  })

  $('#dictionary').on('change', function (ev) {
    ws.sendJSON({ type: 'setDictionary', dictionary: $(this).val() })
  })

  $('.shuffle-colors-btn').on('click', function (ev) {
    ev.preventDefault()
    const colors = []
    const leaders = state.members.filter((m) => m.leader).length === 2 ? 2 : 0

    for (var i = 0; i < state.members.length - leaders; i++) {
      colors.push(i < (state.members.length - leaders) / 2 ? 'blue' : 'red')
    }

    shuffle(colors)
    state.members.forEach((member) => {
      if (member.leader && leaders) return
      if (member.color !== colors[0]) {
        ws.sendJSON({
          type: 'switchColor',
          nick: member.nick
        })
      }
      colors.shift()
    })
  })
})
