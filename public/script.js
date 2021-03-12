document.body.style.margin   = 0
document.body.style.overflow = `hidden`

const radix = document.getElementById (`radix`)
radix.style.height = `${ window.innerHeight }px`
radix.style.cursor = `pointer`

// ~~~

const socket = io.connect (`:80`)
socket.on (`new_member`, msg => console.log (msg))
socket.on (`note_on`, n => {
  if (voice) voice.give_note (n)
  else waiting ()
})

socket.on (`note_off`, n => {
  if (voice) voice.stop_note (n)
  else waiting ()
})

socket.on (`cc`, m => {
  if (voice) voice.cc (m)
  else waiting ()
})

function waiting () {
  console.log (`waiting for voice`)
}

// ~~~


import { Voice } from '/Voice.js'
let voice = false

const AudioContext = window.AudioContext || window.webkitAudioContext
const audio_context = new AudioContext ()
audio_context.suspend ()

document.body.style.backgroundColor = `tomato`

document.addEventListener (`click`, touch_handler)

async function touch_handler (e) {

  if (audio_context.state != `running`) {
    console.log (`initialising audio context`)

    await audio_context.resume ()
    console.log (`audio context is ${ audio_context.state }`)

    voice = await new Voice (audio_context)
    console.log (`voice initialised`)

    socket.emit (`ready`)

    document.body.style.backgroundColor = `limegreen`
  }
}

// ~~~
