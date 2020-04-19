export function shuffle(array) {
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
export const teamColors = ['red', 'blue']

export const colorCounts = {
  false: {
    blue: 8,
    red: 8,
    black: 1,
    grey: 7
  },
  true: {
    black_red: 1,
    grey_red: 5,
    blue_red: 3,
    blue_grey: 5,
    blue_black: 1,
    grey_black: 1,
    black_grey: 1,
    black_black: 1,
    grey_grey: 7
  }
}
