import { SVG } from '/svg.js'

export class Voice {
  constructor (audio_context) {
    const msg   = document.createElement (`div`)
    const radix = document.getElementById (`radix`)

    this.context = audio_context

    const sr = audio_context.sampleRate
    const buffer = audio_context.createBuffer (1, 2, sr)
    const channel = buffer.getChannelData (0)
    channel[0] = 1
    channel[1] = 1
    console.log (channel)

    this.unit = audio_context.createBufferSource ()
    this.unit.buffer = buffer
    this.unit.loop   = true

    this.frequency = audio_context.createGain ()
    this.unit.connect (this.frequency)
    this.unit.start ()

    this.osc = audio_context.createOscillator ()
    this.osc.type = `sawtooth`
    this.osc.frequency.value = 0
    this.frequency.connect (this.osc.frequency)
    this.osc.start ()

    this.lfo = audio_context.createOscillator ()
    this.lfo.type = `sine`
    this.lfo.frequency.value = 3

    this.lfo_wid = audio_context.createGain ()
    this.lfo_wid.gain.value = 0

    this.filter = audio_context.createBiquadFilter ()
    this.filter.type    = `lowpass`
    this.filter.Q.value = 7
    this.filter_mult = audio_context.createGain ()
    this.filter_mult.gain.value = 1
    this.frequency.connect (this.filter_mult)
      .connect (this.filter.frequency)

    this.lfo.connect (this.lfo_wid)
      .connect (this.filter.frequency)
    this.lfo.start ()

    this.amp = audio_context.createGain ()
    this.amp.gain.value = 0

    this.analyser = audio_context.createAnalyser ()

    this.osc.connect (this.filter)
      .connect (this.amp)
      .connect (this.analyser)
      .connect (audio_context.destination)

    this.detune_osc = audio_context.createOscillator ()
    this.detune_osc.frequency.value = 0.1
    this.detune_wid = audio_context.createGain ()
    this.detune_osc.connect (this.detune_wid)
     .connect (this.osc.frequency)
    this.detune_osc.start ()

    this.attack    = 0.02
    this.decay     = 0.2
    this.sustain   = 0.8
    this.release   = 0.4

    this.glide     = 0.1
    this.amplitude = 0.8
    this.active    = false
    this.timeout   = false

    this.width  = window.innerWidth
    console.log (this.width)
    this.height = window.innerHeight
    this.frame_period = 64

    this.x_mid = this.width / 2
    this.y_mid = this.height / 2

    this.env_array = Array (this.width).fill ().map ((_, i) => {
      let v = i / this.width
      v *= 2
      v = Math.min (v, 2 - v)
      v = v ** 0.5
      return v
    })

    this.point_array = Array (this.width).fill ().map ((_, i) => {
      return [ i, this.y_mid ]
    })

    this.draw = SVG ().addTo (radix).size (this.width, this.height)
    this.line = this.draw.polyline (this.point_array)
    this.line.stroke({ color: '#fff', width: 4, linecap: 'round' }).fill ('none')

    this.animating = false
    this.timeout   = false
  }

  frame () {
    if (this.animating) {
      this.update_points ()
      setTimeout(this.frame.bind (this), this.frame_period)
    }
  }

  update_points () {
    const fft_size = this.analyser.fftSize
    let wave_data

    if (this.analyser.getFloatTimeDomainData) {
      wave_data = new Float32Array (fft_size)
      this.analyser.getFloatTimeDomainData (wave_data)
    } else {
      const byte_data = new Uint8Array (fft_size)
      this.analyser.getByteTimeDomainData (byte_data)

      wave_data = Float32Array.from (byte_data).map (e => {
        return ((e / fft_size) - 0.0625) * 16
      })
    }



    const step = fft_size / this.point_array.length
    let point_string = ''
    this.point_array.forEach ((e, i) => {
      const n = Math.floor (i * step)
      const val = wave_data[n]
      const y_env = val * this.env_array[i]
      const y_val = y_env * this.y_mid + this.y_mid
      this.point_array[i] = [ i, y_val ]
      point_string += ` ${ i },${ y_val }`
    })
    // this.line.animate (this.frame_period / 2).plot (this.point_array)
    this.line.animate (this.frame_period).plot (point_string)
    // this.line.plot (point_string)
  }

  give_note (n) {
    if (this.active) this.change_note (n)
    else this.play_note (n)
  }

  play_note (n) {
    const now = this.context.currentTime
    const g = this.amp.gain.value
    this.amp.gain.cancelScheduledValues (now)

    const freq = midi_to_cps (n)
    this.frequency.gain.setValueAtTime (freq, now)
    this.amp.gain.setValueAtTime (g, now)

    const a_time = now + this.attack
    this.amp.gain.linearRampToValueAtTime (this.amplitude, a_time)

    const s = this.amplitude * this.sustain
    const d_time = a_time + this.decay
    this.amp.gain.linearRampToValueAtTime (s, d_time)

    this.active = n

    if (this.animating == false) {
      this.animating = true
      this.frame ()
    }

    console.log (`play note! animating: ${ this.animating }`)
    // console.log (`play note! ${ this.amp.gain.value }`)
  }

  change_note (n) {
    const now = this.context.currentTime

    const start_freq = this.frequency.gain.value
    this.frequency.gain.cancelScheduledValues (now)
    this.frequency.gain.setValueAtTime (start_freq, now)

    const end_freq = midi_to_cps (n)
    const g_time = now + this.glide
    this.frequency.gain.exponentialRampToValueAtTime (end_freq, g_time)

    this.active = n
  }

  stop_note (n) {
    const now = this.context.currentTime
    const t = now + this.release

    // this.frequency.offset.cancelScheduledValues (now)
    this.amp.gain.cancelScheduledValues (now)
    this.amp.gain.setValueAtTime (this.amp.gain.value, now)
    this.amp.gain.linearRampToValueAtTime (0, t)

    this.active = false
  }

  cc (m) {
    const now = this.context.currentTime
    const t = now + this.glide

    const k = m[0]
    const a = m[1] / 127

    switch (k) {
      case 0: // detune width
        {
          const current = this.detune_wid.gain.value
          const c = a ** 4
          const new_value = this.frequency.gain.value * c
          this.detune_wid.gain.cancelScheduledValues (now)
          this.detune_wid.gain.setValueAtTime (current, now)
          this.detune_wid.gain.linearRampToValueAtTime (new_value, t)
          break
        }
      case 1: // detune frequency
        {
          const current = this.detune_osc.frequency.value
          const new_value = (400 ** a) / 20
          this.detune_osc.frequency.cancelScheduledValues (now)
          this.detune_osc.frequency.setValueAtTime (current, now)
          this.detune_osc.frequency.linearRampToValueAtTime (new_value, t)
          break
        }
      case 3: // glide
        {
         const c = a ** 4
         this.glide = 8 * c
         break
        }
      case 4: // filter frequency
        {
          const current = this.filter_mult.gain.value
          const new_value = 128 ** a
          this.filter_mult.gain.cancelScheduledValues (now)
          this.filter_mult.gain.setValueAtTime (current, now)
          this.filter_mult.gain.exponentialRampToValueAtTime (new_value / 2, t)
          break
        }
      case 5: // filter resonance
        {
          const current = this.filter.Q.value
          const r = 24 * a
          this.filter.Q.cancelScheduledValues (now)
          this.filter.Q.setValueAtTime (current, now)
          this.filter.Q.linearRampToValueAtTime (r, t)
          break
        }
      case 6: // lfo width
        {
          const current = this.lfo_wid.gain.value
          const c = a ** 2
          const new_value = this.filter.frequency.value * c
          this.lfo_wid.gain.cancelScheduledValues (now)
          this.lfo_wid.gain.setValueAtTime (current, now)
          this.lfo_wid.gain.linearRampToValueAtTime (new_value, t)
          break
        }
      case 7: // lfo speed
        {
          const current = this.lfo.frequency.value
          const new_value = (400 ** a) / 20
          this.lfo.frequency.cancelScheduledValues (now)
          this.lfo.frequency.setValueAtTime (current, now)
          this.lfo.frequency.linearRampToValueAtTime (new_value, t)
          break
        }
    }
  }

}

function midi_to_cps (n) {
  return 440 * (2 ** ((n - 69) / 12))
}
