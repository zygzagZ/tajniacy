const allWords = []
const extraWords = []

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

function startNewGame() {
  if (!allWords.length) {
    alert('Lista słów nie została załadowana...')
    return
  }
  const words = shuffle([...allWords]).slice(0, 25)
  const first = shuffle(['red', 'blue'])[0]
  const colors = [first]
  for (var color in counts) {
    colors.push(...new Array(counts[color]).fill(color))
  }

  shuffle(colors)

  setState({
    map: words.map((w, i) => ({
      word: w,
      color: colors[i],
      clicked: false
    }))
  })
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
    startNewGame()
  })

  $('.toggle-visibility').click(function () {
    $('.playground').toggleClass('leader')
  })

  $('#link').on('click', function () {
    this.setSelectionRange(0, this.value.length)
  })

  loadState()
})

Promise.all([
  documentReady(),
  fetch('words.min.json')
    .then((r) => r.json())
    .then((j) => {
      allWords.push(...j.words)
      extraWords.push(...j.extra)
    })
]).then(() => {
  if (!state.map) {
    startNewGame()
  }
})
