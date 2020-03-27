const counts = {
  blue: 8,
  red: 8,
  black: 1,
  grey: 7
}

function setState(newState) {
  console.log('setState', JSON.stringify(newState))
  state = newState

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

  if (state.leader) $('.reset-game').show()
  else $('.reset-game').hide()
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

let state = {}

$(function () {
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

  $('.toggle-visibility').click(function () {
    $('.playground').toggleClass('leader')
  })

  $('#link').on('click', function () {
    this.setSelectionRange(0, this.value.length)
  })

  const ws = new WebSocket(document.location.href.replace(/^http/, 'ws'))

  ws.onerror = (e) => {
    console.error(e)
    // alert(e)
  }

  ws.onmessage = (e) => {
    const data = JSON.parse(e.data)
    updateState(data)
  }

  ws.onopen = (e) => console.log('open', e)

  ws.onclose = (e) => console.log('close', e)

  ws.sendJSON = (data) => {
    console.log('>>>', data)
    ws.send(JSON.stringify(data))
  }
})
