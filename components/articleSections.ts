/* The write-up for each canvas. Title, source and fidelity come from the simulation itself, so the article can't claim more than the canvas does.
   In the LaTeX, «key|part» marks a part of the formula that shows the tip stored under `key` when hovered. */
export interface Tip {
  name: string;
  text: string;
}

export interface CanvasNote {
  title: string;
  /** What you are looking at, in plain words. */
  plain: string;
  /** The relation the canvas computes, as LaTeX with «key|part» marks. */
  latex: string;
  tips: Record<string, Tip>;
  /** How your sound moves it. */
  reacts: string;
}

export const CANVAS_NOTES: CanvasNote[] = [
  {
    title: 'Ridge',
    plain: 'A landscape of recent sound. Every line is a snapshot of how strong each band of frequencies was at one moment, and the newest sits at the front while older ones drift back. Peaks are the frequencies that are ringing.',
    latex: String.raw`«L|L»(«t|t»,\,«f|f»)=«dB|\mathrm{dB}»\,\bigl|«STFT|\mathrm{STFT}»\{«x|x»\}(«t|t»,«f|f»)\bigr|`,
    tips: {
      L: { name: 'Height of the line', text: 'How tall the ridge stands at that time and frequency: the level, from the analyser\'s spectrum, which blends each snapshot a little with the ones before.' },
      t: { name: 'Time', text: 'When the snapshot was taken. The front row is now; the rows behind it are the recent past.' },
      f: { name: 'Frequency', text: 'Low on the left and high on the right, in bands about 180 hertz wide, so neighbouring low notes share a band. 440 hertz is the A above middle C.' },
      dB: { name: 'Decibels', text: 'A log scale for loudness, close to how ears hear it. Every 6 dB roughly doubles the size of the signal.' },
      STFT: { name: 'Short-time Fourier transform', text: 'Cut the sound into short slices, and for each slice ask how much of every pitch it contains. It is how a moving sound becomes a picture of frequency over time. The sound spectrogram dates from 1946 (Koenig, Dunn and Lacy); Allen and Rabiner (1977) set out the analysis behind it.' },
      x: { name: 'The sound', text: 'The audio as a long list of numbers, one for every tick of the sampling clock.' },
    },
    reacts: 'Sudden onsets lift every ridge a little, an added kick that is not in the formula.',
  },
  {
    title: 'Holo',
    plain: 'A ball bulged and dented in the shape of a spherical harmonic, one of the natural ways a round body can vibrate. It shows the shape of the vibration, not its motion: bass sets how far it bulges, rather than the ball swinging in and out.',
    latex: String.raw`«r|r»=«R|R»+«A|A»\,«Y|Y_{l}^{m}»(«ang|\theta,\varphi»)+«w|w(\varphi)»`,
    tips: {
      r: { name: 'Radius', text: 'How far the surface is from the centre at that spot on the ball.' },
      R: { name: 'Resting radius', text: 'The size of the ball when nothing is playing.' },
      A: { name: 'Amplitude', text: 'How far the bulges reach. Bass sets it.' },
      Y: { name: 'Spherical harmonic', text: 'One of the natural shapes of a vibrating ball. l, the degree, is the total number of still lines on the surface: m of them run through the poles like lines of longitude, and the other l − m circle it like lines of latitude. Brighter sound raises l from 2 to 5 (6 only above 8 kHz). Lamb worked out the vibrations of an elastic sphere in 1882.' },
      ang: { name: 'Latitude and longitude', text: 'Where you are on the ball: θ is the angle from the pole, φ the angle round it.' },
      w: { name: 'The waveform', text: 'The sound\'s real wave shape, scaled by the mid band and wrapped round the ball as you go round it. This is raw signal rather than a vibration mode.' },
    },
    reacts: 'Bass sets how far it bulges, and onsets swell the whole ball, an added term not in the formula. Brighter sound raises l, so the pattern gets busier. The waveform adds a wiggle.',
  },
  {
    title: 'Warp',
    plain: 'A grid pushed up and down by a vibrating plate. Where the two cosine waves cancel, the grid stays still; those still lines are close to the ones sand finds on a Chladni plate. The formula is the classic textbook approximation for a square plate with free edges; Ritz computed the exact modes in 1909.',
    latex: String.raw`«z|z»=\cos(«n|n»\pi «x|x»)\cos(«m|m»\pi «y|y»)-\cos(«m|m»\pi «x|x»)\cos(«n|n»\pi «y|y»)`,
    tips: {
      z: { name: 'Displacement', text: 'How far that point of the plate is pushed up or down. Where it is zero, the plate is still: the nodal lines.' },
      n: { name: 'Mode number', text: 'How many times the pattern folds along the plate. Larger means finer. A plate\'s resonant pitch rises roughly with n² + m². Here brightness picks the mode; on a real plate the pitch that drives it would.' },
      m: { name: 'Mode number', text: 'The same idea in the other direction. Swapping n and m and subtracting makes the pattern antisymmetric across the diagonal, so the diagonal is always a still line.' },
      x: { name: 'Across', text: 'Position along the plate, from 0 at one edge to 1 at the other.' },
      y: { name: 'Down', text: 'Position from the top of the plate to the bottom, 0 to 1.' },
    },
    reacts: 'Brighter sound picks larger n and m. Louder sound pushes harder.',
  },
  {
    title: 'Strata',
    plain: 'Layers of the raw waveform stacked like terrain. This is the one canvas that is honestly decoration: the waveform is real, but the layering and the ripple texture are invented because they look cool.',
    latex: String.raw`«y|y»=«yi|y_i»+80\,«V|V»\,«d|d_i»\,«xn|x[n]»+«ripple|20\,T\sin(\kappa x+5t)\cos(0.05x)»`,
    tips: {
      y: { name: 'Screen height', text: 'Where the line sits vertically at that column of the screen.' },
      yi: { name: 'Layer baseline', text: 'Where layer i rests when there is no sound. Each layer is a little further back.' },
      V: { name: 'Level', text: 'The signal\'s RMS level in decibels, from 0 (−60 dBFS, near silence) to 1 (full scale). The 80 is just how many pixels a full-volume wave swings the line.' },
      d: { name: 'Depth fade', text: 'Layers further back swing less, which is what makes the stack look like terrain.' },
      xn: { name: 'A waveform sample', text: 'One number from the live waveform, between −1 and 1. This is the real signal.' },
      ripple: { name: 'The invented part', text: 'Nothing in physics says a waveform has this ripple. It is texture added because it looks like terrain, driven by treble T. That is why Strata is labelled Artistic.' },
    },
    reacts: 'Loudness raises the terrain. Treble roughens it.',
  },
  {
    title: 'Array',
    plain: 'Chladni\'s sand. Grains slide downhill on the plate\'s vibration until they reach the lines that don\'t move, and there they stay.',
    latex: String.raw`«F|\mathbf{F}»=-«grad|\nabla»\,\bigl|«z|z(x,y)»\bigr|`,
    tips: {
      F: { name: 'Force on a grain', text: 'The push on each grain of sand, along the slope.' },
      grad: { name: 'Gradient', text: 'It points uphill, so its negative points downhill. Grains are pushed away from wherever the plate shakes hardest.' },
      z: { name: 'Shaking', text: 'How hard the plate moves at each point, the same pattern as Warp. The bars take the absolute value, because up and down both count as moving. Sand ends up where it is zero.' },
    },
    reacts: 'Brightness chooses the plate\'s mode. Sudden hits scatter the sand, and it settles again.',
  },
  {
    title: 'Twist',
    plain: 'A string pinned at both ends and shaken, the way Melde did it in 1860. It can only vibrate in whole numbers of loops, so it jumps from one clean shape to the next.',
    latex: String.raw`«y|y»=«A|A»\sin\!\left(\frac{«n|n»\pi «x|x»}{«L|L»}\right)\cos(«n|n»«w1|\omega_1» «t|t»+«phi|\varphi_i»)+«ripple|w(x)»`,
    tips: {
      y: { name: 'Sideways displacement', text: 'How far the string is pulled off its resting line at that point.' },
      A: { name: 'Amplitude', text: 'How far it swings. Louder sound swings wider.' },
      n: { name: 'Number of loops', text: 'A pinned string can only hold whole numbers of loops: 1, 2, 3 and on. Brighter sound adds loops, up to eight. Loop n also vibrates n times faster.' },
      x: { name: 'Position', text: 'Distance along the string.' },
      L: { name: 'Length', text: 'The length of the string, pinned at both ends. The sine is zero at both ends, which is what pinning means.' },
      w1: { name: 'Fundamental', text: 'The speed of the slowest, one-loop vibration. Every higher mode is a whole-number multiple of it.' },
      t: { name: 'Time', text: 'The cosine makes the loops swing back and forth as time passes.' },
      phi: { name: 'Head start', text: 'A different offset for each strand, so they don\'t move in lockstep.' },
      ripple: { name: 'Waveform ripple', text: 'The real waveform, scaled by treble, adds a fine tremble on top of the ideal shape, even at the pinned ends.' },
    },
    reacts: 'Brighter sound adds loops (up to eight). Louder sound swings wider.',
  },
  {
    title: 'Swarm',
    plain: 'Particles that each trace a Lissajous curve: one motion left to right, another up and down, at different speeds. Their speed ratio is a musical interval, so a simple ratio makes a tidy knot and a complicated one makes a tangle.',
    latex: String.raw`«x|x»=«A|A»\sin\bigl(«a|a»(«t|t»+«phi|\varphi»)+«delta|\delta»\bigr),\qquad «y|y»=A\sin\bigl(«b|b»(t+\varphi)\bigr)`,
    tips: {
      x: { name: 'Left to right', text: 'The particle\'s horizontal position.' },
      y: { name: 'Up and down', text: 'The particle\'s vertical position.' },
      A: { name: 'Size', text: 'How big the figure is.' },
      a: { name: 'Horizontal speed', text: 'How fast the left-right swing goes. The ratio a : b is a musical interval: 1:1 unison, 3:2 fifth, 2:1 octave, 3:1 twelfth, 4:1 double octave. Simple ratios close into tidy figures.' },
      b: { name: 'Vertical speed', text: 'How fast the up-down swing goes. Lissajous drew these curves from two tuning forks in 1857.' },
      t: { name: 'Time', text: 'The particles run along the figure. The figure itself stays still, because the ratio is exact; a slightly off ratio would make it turn.' },
      phi: { name: 'Head start', text: 'Each particle starts at a different point on the same curve, so together they draw all of it.' },
      delta: { name: 'Phase offset', text: 'A quarter turn, fixed. With it, 1:1 draws a circle instead of a diagonal line.' },
    },
    reacts: 'Brightness picks the ratio: unison, fifth, octave, twelfth or double octave. Onsets shake the swarm outward, an added kick not in the formula.',
  },
  {
    title: 'Hive',
    plain: 'Ripples spreading across a honeycomb of cells. Each cell rises and falls a moment after the one nearer the centre. It borrows the picture of a wave moving through a crystal, with the travelling part only.',
    latex: String.raw`«s|s»=«s0|s_0»+«A|A»\cos(«k|k»«r|r»-«w|\omega» «t|t»)`,
    tips: {
      s: { name: 'Cell size', text: 'How big a cell is drawn right now.' },
      s0: { name: 'Resting size', text: 'The size of a cell when nothing is playing.' },
      A: { name: 'Amplitude', text: 'How much the cell swells. Louder sound swells it more, and the swell fades in a straight line toward the edges. That fade is chosen to look right; a real ripple on a surface fades as one over the square root of distance.' },
      k: { name: 'Wavenumber', text: 'How tightly packed the ripples are: how many fit in a given distance.' },
      r: { name: 'Distance', text: 'How far the cell is from the centre.' },
      w: { name: 'Angular frequency', text: 'How fast each cell bobs. Brighter sound raises it.' },
      t: { name: 'Time', text: 'The minus sign between kr and ωt is what makes the ripples travel outward rather than just pulse in place. Reflections at the edge are not modelled.' },
    },
    reacts: 'Brighter sound makes it bob faster. Louder sound swells the cells.',
  },
  {
    title: 'Phase',
    plain: 'Plot the sound against a copy of itself a moment later. A pure tone draws a circle. Add overtones and the circle grows loops and folds, so the shape is a fingerprint of the timbre.',
    latex: String.raw`\bigl(«xn|x[n]»,\ «xt|x[n+\tau]»\bigr),\qquad «tau|\tau»=\frac{«fs|f_s»}{4«f0|f_{\mathrm{pk}}»}`,
    tips: {
      xn: { name: 'The sound now', text: 'One sample of the live sound. It sets the horizontal position of a point.' },
      xt: { name: 'The sound a moment later', text: 'The sample τ steps further on. It sets the vertical position. A sine and its own quarter-cycle delay trace a circle.' },
      tau: { name: 'The delay', text: 'A quarter of one cycle of the strongest partial. For a sine, that is where the signal stops resembling itself (its autocorrelation first reaches zero), a common rule of thumb; Fraser and Swinney (1986) give the general rule. Takens (1981) proved that plotting a signal against its own delays can recover the shape of the system that made it.' },
      fs: { name: 'Sample rate', text: 'How many samples of sound there are per second, typically 44,100 or 48,000.' },
      f0: { name: 'Strongest partial', text: 'The tallest peak in the spectrum, in hertz. Often the note\'s fundamental, but not always: a bright sound can have a louder overtone.' },
    },
    reacts: 'Nothing is invented. The curve is the sound\'s own samples, scaled to fit.',
  },
  {
    title: 'Fluid',
    plain: 'A field of little arrows describing a flow, with particles carried along it. The flow smooths itself out and slows down, and sudden sounds stir it. It uses one idea from real fluid simulation, the spreading-out step, and none of the rest.',
    latex: String.raw`«dudt|\frac{\partial\mathbf{u}}{\partial t}»=«nu|\nu»«lap|\nabla^{2}\mathbf{u}»-«gamma|\gamma\mathbf{u}»+«F|\mathbf{F}»`,
    tips: {
      dudt: { name: 'How the flow changes', text: 'The left side is the change in the flow from one moment to the next. The right side lists what changes it.' },
      nu: { name: 'Viscosity', text: 'How readily motion spreads into neighbouring cells.' },
      lap: { name: 'Laplacian of the flow', text: 'The difference between a point and the average of its neighbours. Adding it smooths the flow out: diffusion. Stam\'s Stable Fluids (1999) solves this step implicitly so it can never blow up; here it is a simple explicit blend. The rest of his method, carrying the flow along itself and keeping it incompressible, is not used.' },
      gamma: { name: 'Drag', text: 'Friction. It slows the flow down in proportion to its speed, so it eventually calms.' },
      F: { name: 'The push from the sound', text: 'Sudden onsets burst outward from the centre. Treble drives a swirling pattern that is invented, not simulated.' },
    },
    reacts: 'Onsets push the fluid outward. Treble stirs an invented swirl.',
  },
  {
    title: 'Vector',
    plain: 'The spectrum bent into a ring. It runs from low to high over one half and back down the other, so the shape is mirrored, and the ring turns slowly. Each spoke is a band of frequencies about 180 hertz wide, and its length is how strong that band is.',
    latex: String.raw`«r|r»=«R|R»+«g|g»\,«X|\mathrm{dB}\bigl|X(f)\bigr|»`,
    tips: {
      r: { name: 'Reach', text: 'How far that spoke extends from the centre.' },
      R: { name: 'Resting radius', text: 'The size of the ring when it is silent. Bass pulses the core inside it.' },
      g: { name: 'Gain', text: 'A scale factor that turns spectrum strength into pixels. Louder sound makes it bigger.' },
      X: { name: 'The spectrum', text: 'How strong band f is, from the Fourier transform, on the analyser\'s decibel scale. The bars take its size and ignore its phase.' },
    },
    reacts: 'Stronger bands reach further, and onsets swell the whole ring, an added term not in the formula. Bass pulses the core.',
  },
  {
    title: 'Lattice',
    plain: 'A map of musical harmony. Euler drew the first one in 1739, in pure fifths and thirds; this is the equal-tempered version from modern music theory, which wraps every twelve semitones. Move right and you rise a perfect fifth; move diagonally and you rise a third. Notes that sit close together blend well, so major and minor chords show up as small triangles.',
    latex: String.raw`«pc|\mathrm{pc}»(«i|i»,«j|j»)=(«seven|7»«i|i»+«four|4»«j|j»)«mod|\bmod 12»`,
    tips: {
      pc: { name: 'Pitch class', text: 'Which of the twelve notes sits at that spot, counted in semitones from C: 0 is C, 1 is C sharp, up to 11 is B.' },
      i: { name: 'Steps right', text: 'How many steps you have moved across the grid.' },
      j: { name: 'Steps along the diagonal', text: 'How many steps you have moved diagonally.' },
      seven: { name: 'A perfect fifth', text: 'Seven semitones, within a hair of the pure 3:2 Euler used: the interval at the heart of most harmony, and one step right on the grid.' },
      four: { name: 'A major third', text: 'Four semitones, a little wider than the pure 5:4. The minor third, three semitones, completes the triangles that are major and minor chords.' },
      mod: { name: 'Wrapping at twelve', text: 'After twelve equal-tempered semitones you are back at the same note, an octave up, so the map repeats. Euler\'s own map, in pure intervals, never quite closes.' },
    },
    reacts: 'Each note lights up by how much energy falls on it, overtones included, so one bright note also lights its fifth and major third. The strongest is named.',
  },
  {
    title: 'Chaos',
    plain: 'Lorenz\'s 1963 model of a layer of air heated from below. Three numbers chase each other and never repeat, though nothing in it is random. Start two points almost together and they end up far apart: the sensitivity later nicknamed the butterfly effect.',
    latex: String.raw`«dx|\dot x»=«sigma|\sigma»(«y|y»-«x|x»),\quad «dy|\dot y»=x(«rho|\rho»-«z|z»)-y,\quad «dz|\dot z»=xy-«beta|\beta» z`,
    tips: {
      dx: { name: 'Rate of change', text: 'The dot means how fast the quantity is changing right now. The three equations give the speed of x, y and z, which moves the point through space.' },
      dy: { name: 'Rate of change of y', text: 'Each quantity is pushed by the others, which is what ties the three together.' },
      dz: { name: 'How it is followed', text: 'Each step is worked out with a fourth-order Runge–Kutta method, a standard accurate way to follow such equations.' },
      x: { name: 'x', text: 'In Lorenz\'s model of a layer of heated air, the speed of the overturning flow.' },
      y: { name: 'y', text: 'The temperature difference between the rising and the falling air.' },
      z: { name: 'z', text: 'How far the temperature profile departs from a straight line from bottom to top.' },
      sigma: { name: 'σ, fixed at 10', text: 'The Prandtl number: how sticky the air is compared with how fast heat spreads through it. Lorenz\'s own value.' },
      rho: { name: 'ρ, 28 plus bass', text: 'How hard the system is driven. Below about 24.7 the air can settle into steady rolls; above it no steady state is stable, and at 28 the motion is chaotic. 28 is Lorenz\'s value, and bass pushes it up to 48.' },
      beta: { name: 'β, fixed at 8/3', text: 'A shape factor of the air layer. Lorenz\'s own value.' },
    },
    reacts: 'Bass raises ρ above 28. Treble makes time run faster.',
  },
];
