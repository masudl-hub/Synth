/* The write-up for each canvas. Title, source and fidelity come from the simulation itself, so the article can't claim more than the canvas does. */
export interface CanvasNote {
  title: string;
  /** What you are looking at, in plain words. */
  plain: string;
  /** The relation the canvas computes, as LaTeX. */
  latex: string;
  /** Each symbol, and what it means here. */
  symbols: [tex: string, meaning: string][];
  /** How your sound moves it. */
  reacts: string;
}

export const CANVAS_NOTES: CanvasNote[] = [
  {
    title: 'Ridge',
    plain: 'A landscape of recent sound. Every line is a snapshot of how loud each pitch was at one moment, and the newest sits at the front while older ones drift back. Peaks are the pitches that are ringing.',
    latex: 'L(t,f)=\\mathrm{dB}\\,\\bigl|\\mathrm{STFT}\\{x\\}(t,f)\\bigr|',
    symbols: [
      ['x', 'the sound itself, as a long list of numbers'],
      ['\\mathrm{STFT}', 'chop the sound into short slices and ask how much of each pitch is in each slice'],
      ['t,\\ f', 'when it happened, and which pitch'],
      ['L', 'how high the line stands: loudness, on a decibel scale'],
    ],
    reacts: 'Sudden onsets kick the ridges upward.',
  },
  {
    title: 'Holo',
    plain: 'A ball that wobbles the way a struck bell or a drumhead wraps around a sphere. The pattern of bulges and dents is a spherical harmonic, one of the natural ways a round thing can vibrate.',
    latex: 'r=R+A\\,Y_{l}^{m}(\\theta,\\varphi)+w(\\varphi)',
    symbols: [
      ['R', 'the resting radius of the ball'],
      ['Y_l^m', 'the bulge pattern; l counts the bands of bulges, m how they wrap around'],
      ['\\theta,\\ \\varphi', 'latitude and longitude on the ball'],
      ['A', 'how far the bulges reach'],
      ['w', 'the shape of the sound wave, wrapped around the equator'],
    ],
    reacts: 'Bass sets how far it bulges. Brighter sound raises l, so the pattern gets busier. The waveform adds a wiggle.',
  },
  {
    title: 'Warp',
    plain: 'A grid pushed up and down by a vibrating plate. Where the two cosine waves cancel, the grid stays still; those still lines are the same ones sand finds on a Chladni plate.',
    latex: 'z=\\cos(n\\pi x)\\cos(m\\pi y)-\\cos(m\\pi x)\\cos(n\\pi y)',
    symbols: [
      ['x,\\ y', 'position across the plate, from 0 to 1'],
      ['n,\\ m', 'how many times the pattern folds in each direction; bigger means finer'],
      ['z', 'how far that point is pushed up or down'],
    ],
    reacts: 'Brighter sound picks larger n and m. Louder sound pushes harder.',
  },
  {
    title: 'Strata',
    plain: 'Layers of the raw waveform stacked like terrain. This is the one canvas that is honestly decoration: the waveform is real, but the layering and the ripple texture are invented because they look good.',
    latex: 'y=y_i+80\\,V\\,d_i\\,x[n]+20\\,T\\sin(\\kappa x+5t)\\cos(0.05x)',
    symbols: [
      ['y_i', 'where layer i rests on the screen'],
      ['x[n]', 'the n-th sample of the sound'],
      ['V', 'loudness'],
      ['d_i', 'how much the layer fades with distance'],
      ['T', 'treble; it drives the ripple'],
    ],
    reacts: 'Loudness raises the terrain. Treble roughens it.',
  },
  {
    title: 'Array',
    plain: 'Chladni\'s sand. Grains slide downhill on the plate\'s vibration until they reach the lines that don\'t move, and there they stay.',
    latex: '\\mathbf{F}=-\\nabla\\,\\bigl|z(x,y)\\bigr|',
    symbols: [
      ['z(x,y)', 'how hard the plate shakes at each point'],
      ['\\nabla', 'the slope: which way is downhill'],
      ['\\mathbf{F}', 'the push on a grain, along that slope'],
    ],
    reacts: 'Brightness chooses the plate\'s mode. Sudden hits scatter the sand, and it settles again.',
  },
  {
    title: 'Twist',
    plain: 'A string pinned at both ends and shaken, the way Melde did it in 1859. It can only vibrate in whole numbers of loops, so it jumps from one clean shape to the next.',
    latex: 'y=A\\sin\\!\\left(\\frac{n\\pi x}{L}\\right)\\cos(n\\omega_1 t+\\varphi_i)+w(x)',
    symbols: [
      ['L', 'the length of the string'],
      ['n', 'the number of loops: 1, 2, 3 and so on'],
      ['\\omega_1', 'the slowest speed the string can wobble at'],
      ['A', 'how far it swings'],
      ['\\varphi_i', 'a small head start, different for each strand'],
    ],
    reacts: 'Brighter sound adds loops (up to eight). Louder sound swings wider.',
  },
  {
    title: 'Swarm',
    plain: 'Particles that each trace a Lissajous curve: one motion left to right, another up and down, at different speeds. Their speed ratio is a musical interval, so a simple ratio makes a tidy knot and a complicated one makes a tangle.',
    latex: 'x=A\\sin\\bigl(a(t+\\varphi)+\\varphi\\bigr),\\qquad y=A\\sin\\bigl(b(t+\\varphi)\\bigr)',
    symbols: [
      ['a,\\ b', 'how fast each direction swings; their ratio is the interval'],
      ['t', 'time'],
      ['\\varphi', 'each particle\'s own head start'],
      ['A', 'the size of the figure'],
    ],
    reacts: 'Brightness picks the ratio: unison, fifth, octave, twelfth or double octave. Onsets shake the swarm.',
  },
  {
    title: 'Hive',
    plain: 'Ripples spreading across a honeycomb of cells. Each cell rises and falls a moment after the one nearer the centre. It borrows the picture of a wave moving through a crystal, with the travelling part only.',
    latex: 's=s_0+A\\cos(kr-\\omega t)',
    symbols: [
      ['r', 'distance from the centre'],
      ['k', 'how tightly packed the ripples are'],
      ['\\omega', 'how fast each cell bobs'],
      ['s_0,\\ A', 'a cell\'s resting size and how much it swells'],
    ],
    reacts: 'Brighter sound makes it bob faster. Louder sound swells the cells.',
  },
  {
    title: 'Phase',
    plain: 'Plot the sound against a copy of itself a moment later. A pure tone draws a circle. Add overtones and the circle grows loops and folds, so the shape is a fingerprint of the timbre.',
    latex: '\\bigl(x[n],\\ x[n+\\tau]\\bigr),\\qquad \\tau=\\frac{f_s}{4f_0}',
    symbols: [
      ['x[n]', 'the sound right now'],
      ['x[n+\\tau]', 'the sound a moment later'],
      ['\\tau', 'that moment: a quarter of one cycle of the loudest pitch'],
      ['f_s', 'samples per second'],
      ['f_0', 'the loudest pitch, in hertz'],
    ],
    reacts: 'Nothing is invented. The curve is the sound\'s own samples.',
  },
  {
    title: 'Fluid',
    plain: 'A field of little arrows describing a flow, with particles carried along it. The flow smooths itself out and slows down, and sudden sounds stir it. It uses one idea from real fluid simulation, the spreading-out step, and none of the rest.',
    latex: '\\frac{\\partial\\mathbf{u}}{\\partial t}=\\nu\\nabla^{2}\\mathbf{u}-\\gamma\\mathbf{u}+\\mathbf{F}',
    symbols: [
      ['\\mathbf{u}', 'which way, and how fast, the fluid moves at each point'],
      ['\\nu\\nabla^{2}\\mathbf{u}', 'spreading: motion leaks into its neighbours'],
      ['\\gamma\\mathbf{u}', 'friction: motion fades'],
      ['\\mathbf{F}', 'the push from the sound'],
    ],
    reacts: 'Onsets push the fluid. Treble stirs small eddies.',
  },
  {
    title: 'Vector',
    plain: 'The spectrum bent into a ring. Each spoke is one pitch, low to high round the circle, and its length is how much of that pitch is in the sound.',
    latex: 'r=R+g\\,\\bigl|X(f)\\bigr|',
    symbols: [
      ['X(f)', 'how much of pitch f the sound contains'],
      ['R', 'the resting radius of the ring'],
      ['g', 'a gain that scales with loudness'],
      ['r', 'how far that spoke reaches'],
    ],
    reacts: 'Louder pitches reach further. Bass pulses the core.',
  },
  {
    title: 'Lattice',
    plain: 'A map of musical harmony drawn by Euler in 1739. Move right and you rise a perfect fifth; move diagonally and you rise a third. Notes that sit together on the map sound good together, so chords show up as small triangles.',
    latex: '\\mathrm{pc}(i,j)=(7i+4j)\\bmod 12',
    symbols: [
      ['i,\\ j', 'steps across and diagonally on the grid'],
      ['7', 'a perfect fifth, in semitones'],
      ['4', 'a major third, in semitones'],
      ['\\bmod 12', 'after twelve semitones you are back at the same note, an octave up'],
      ['\\mathrm{pc}', 'the pitch class: which of the twelve notes'],
    ],
    reacts: 'The notes you are hearing light up, and the loudest one is marked.',
  },
  {
    title: 'Chaos',
    plain: 'Lorenz\'s weather model from 1963. Three numbers chase each other and never repeat, though nothing in it is random. Start two points almost together and they end up far apart. It is the butterfly picture.',
    latex: '\\dot x=\\sigma(y-x),\\quad \\dot y=x(\\rho-z)-y,\\quad \\dot z=xy-\\beta z',
    symbols: [
      ['x,\\ y,\\ z', 'the three quantities, and the point they trace in space'],
      ['\\dot x', 'how fast x is changing'],
      ['\\sigma=10,\\ \\beta=8/3', 'Lorenz\'s own constants'],
      ['\\rho', 'how hard the system is driven; at 28 it turns chaotic'],
    ],
    reacts: 'Bass raises ρ above 28. Treble makes time run faster.',
  },
];
