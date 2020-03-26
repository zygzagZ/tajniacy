const counts = {
  blue: 8,
  red: 8,
  black: 1,
  grey: 7
}

function updateLink() {
  const link = document.location.href.split('?')[0] + '?' + encodeURIComponent(btoa(encodeURIComponent(JSON.stringify(state))))

  $('#link').attr('value', link)
}

function setState(newState) {
  console.log('setState', newState)
  state = newState

  $('.card').each((i, e) => {
    const el = $(e)
    const tile = state.map[i]

    for (var color in counts) {
      if (color !== tile.color) { el.removeClass(color) }
    }

    el.find('.card-word').text(tile.word)
    el.addClass(tile.color)

    if (tile.clicked) { el.addClass('clicked') } else { el.removeClass('clicked') }
  })

  updateLink()
}

function loadState() {
  if (document.location.search) {
    try {
      setState(JSON.parse(decodeURIComponent(atob(decodeURIComponent(document.location.search.substr(1))))))
    } catch (e) {
      console.error('Error at loadState:', e)
      alert(`Błąd ładowania stanu: ${e.message}`)
    }
  }
}

function documentReady() {
  return new Promise((resolve, reject) => $(resolve))
}

let state = {}

function connect() {
  let ws = new WebSocket(document.location.origin)
}

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
      state.map[i].clicked = true

      $(this).addClass('clicked')

      updateLink()
    })

  $('.new-game').click(function () {
    // startNewGame()
  })

  $('.toggle-visibility').click(function () {
    $('.playground').toggleClass('leader')
  })

  $('#link').on('click', function () {
    this.setSelectionRange(0, this.value.length)
  })

  loadState()
})
