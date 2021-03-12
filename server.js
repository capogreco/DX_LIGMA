const midi = require (`midi`)
const input = new midi.Input ()
const count = input.getPortCount ()
console.log (`${ count } midi inputs`)

if (count) {
  const name = input.getPortName (0)
  console.log (`connecting to ${ name }`)
  input.openPort (0)
} else {
  console.log (`can't find any midi devices`)
}


input.on (`message`, (t, m) => {
  const c = m[0]
  const n = m[1]
  const v = m[2]
  // console.log (`note ${ n }, velocity ${ v }`)


  // console.log (m)

  switch (c) {
    case 144:
      if (v > 0) note_on (n, v)
      else note_off (n)
      break
    case 128:
      return note_off (n)
    case 176:
      return cc_handler (n, v)
  }
})

function cc_handler (k, a) {
  io.emit (`cc`, [ k - 70, a ])
}

const family  = []
const notes   = []

async function update_family () {
  const all_sock_set = await io.allSockets ()
  const all_sock_multi = [ ...all_sock_set.entries ()]
  family.length = 0
  all_sock_multi.forEach (e => family.push(e[0]))
}

async function note_on (n, v) {
  console.log (`note ${ n } velocity ${ v }`)

  notes.push (n)
  update_family ()
  allocate_notes ()
}

function note_off (n) {
  console.log (`note ${ n } off`)

  const i = notes.findIndex (e => e == n)
  notes.splice (i, 1)

  allocate_notes ()
}

function allocate_notes () {
  if (notes.length == 0) io.emit (`note_off`)
  else family.forEach ((id, i) => {
    const j = i % notes.length
    const k = notes.length - j - 1
    const n = notes[k]
    io.to (id).emit (`note_on`, n)
  })
}

const note_array = Array (128).fill (false)

// ignore sysex, timing, & active sensing
input.ignoreTypes (true, true, true)


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

const express = require (`express`)
const app     = express ()
const port    = 80
const server  = app.listen (port)
const io      = require (`socket.io`)(server)

app.use (express.static (`public`))

io.sockets.on (`connection`, socket => {
	console.log (`${ socket.id } has joined the family`)
  family.push (socket.id)
	socket.emit (`new_member`, `hello ${ socket.id }, welcome to science family`)
  socket.on ('message', msg => console.log (msg))
  socket.on ('ready', _ => console.log (`${ socket.id } is ready`))
})

const wifiName = require ('wifi-name')
const os = require ('os')
const interfaces = os.networkInterfaces ()
wifiName ().then (name => {
    console.log (`join wifi   -> ${ name }`)
	 Object.keys (interfaces).forEach (name => {
	 	interfaces[name].forEach (interface => {
	 		if (interface.family != `IPv4` || interface.internal) return
	 		console.log (`navigate to -> ${ interface.address }:${ port }`)
	 	})
	})
})
