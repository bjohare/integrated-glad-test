const vertexSource = `
    uniform mat4 u_matrix;

    uniform vec2 u_tl_parent;
    uniform vec2 u_perspective_transform;
    uniform float u_scale_parent;

    attribute vec2 a_pos;

    varying vec2 v_tex_coord0;
    varying vec2 v_tex_coord1;

    float Extent = 8192.0;

    void main() {
        vec4 a = u_matrix * vec4(a_pos * Extent, 0, 1);
        gl_Position = a;
        v_tex_coord0 = a_pos;
        v_tex_coord1 = (v_tex_coord0 * u_scale_parent) + u_tl_parent;
    }
`

const fragmentSource = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
    #else
      precision mediump float;
    #endif

    varying vec2 v_tex_coord0;
    varying vec2 v_tex_coord1;

    uniform sampler2D u_texture0;
    uniform sampler2D u_texture1;

    uniform float u_var_start;
    uniform float u_var_end;

    uniform float u_fade_opacity;
    uniform float u_fade_t;
    uniform float u_layer_opacity;


    // https://github.com/wri/gfw/blob/1b2d73fe8f1545c5de82438c4bac01d00c974585/providers/datasets-provider/config.js#L256
    vec4 decodeFunction(vec4 color) {

        // First 6 bits Alpha channel used to individual alert confidence
        // First two bits (leftmost) are GLAD-L
        // Next, 3rd and 4th bits are GLAD-S2
        // Finally, 5th and 6th bits are RADD
        // Bits are either: 00 (0, no alerts), 01 (1, low conf), or 10 (2, high conf)
        // e.g. 00 10 01 00 --> no GLAD-L, high conf GLAD-S2, low conf RADD

        // return vec4(color); // uncomment to render encoded tiles

        float alpha = color.a;

        // passed as parameters from the date range filter
        float startDayIndex = u_var_start;
        float endDayIndex = u_var_end;

        // scale rgba values from 0 - 1 to 0 - 255
        float agreementValue = alpha * 255.; // determines confidence level

        float r = color.r * 255.;
        float g = color.g * 255.;
        // float b = color.b * 255.;

        // calculate date, confidence, intensity values

        float day = r * 255. + g;

        // not currently used
        // float confidence = floor(b / 100.) - 1.;
        // float intensity = mod(b, 100.) * 150.;

        if (
          // day >= 0. &&
          // day >= startDayIndex
          // && day <= endDayIndex &&
          agreementValue > 0.
        )
        {
            if (agreementValue == 4. || agreementValue == 16. || agreementValue == 64.) {
              // ONE ALERT LOW CONF: 4,16,64 i.e. 2**(2+n) for n<8

              color.r = 237. / 255.;
              color.g = 164. / 255.;
              color.b = 194. / 255.;
              color.a = 1.; // ignore intensity

            } else if (agreementValue == 8. || agreementValue == 32. || agreementValue == 128.){
              // ONE HIGH CONF ALERT: 8,32,128 i.e. 2**(2+n) for n<8 and odd

              color.r = 220. / 255.;
              color.g = 102. / 255.;
              color.b = 153. / 255.;
              color.a = 1.; // ignore intensity

            } else {
              // MULTIPLE ALERTS: >0 and not 2**(2+n)

              color.r = 201. / 255.;
              color.g = 42. / 255.;
              color.b = 109. / 255.;
              color.a = 1.; // ignore intensity
            }

        } else {
          discard;
        }

        return vec4(color);
    }

    void main() {
        vec4 color = texture2D(u_texture1, v_tex_coord1);
        color = decodeFunction(color);
        gl_FragColor = color;
    }
`

export class MapboxCustomLayer {
  map = null
  painter = null
  program = null
  sourceCache = null

  constructor ({ id, source, options }) {
    this.id = id
    this.type = 'custom'
    this.renderingMode = '2d'

    this.source = source

    this.options = options
  }

  onAdd(map, gl) {

    this.map = map
    this.painter = map.painter

    this.sourceCache = map.style._sourceCaches['other:' + this.source]
    this.map.style._layers[this.id].source = this.source

    const vertexShader = gl.createShader(gl.VERTEX_SHADER)
    gl.shaderSource(vertexShader, vertexSource)
    gl.compileShader(vertexShader)

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)
    gl.shaderSource(fragmentShader, fragmentSource)
    gl.compileShader(fragmentShader)

    const program = gl.createProgram()
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)
    gl.validateProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Could not compile WebGL program')
    }

    // bind the uniforms to the program
    program.u_var_start = gl.getUniformLocation(program, 'u_var_start')
    program.u_var_end = gl.getUniformLocation(program, 'u_var_end')
    program.u_layer_opacity = gl.getUniformLocation(program, 'u_layer_opacity')
    program.u_opacity = gl.getUniformLocation(program, 'u_fade_opacity')
    program.u_fade_t = gl.getUniformLocation(program, 'u_fade_t')
    program.a_pos = gl.getAttribLocation(program, 'a_pos')
    program.u_matrix = gl.getUniformLocation(program, 'u_matrix')
    program.u_texture0 = gl.getUniformLocation(program, 'u_texture0')
    program.u_texture1 = gl.getUniformLocation(program, 'u_texture1')
    program.u_tl_parent = gl.getUniformLocation(program, 'u_tl_parent')
    program.u_scale_parent = gl.getUniformLocation(program, 'u_scale_parent')
    program.u_perspective_transform = gl.getUniformLocation(program, 'u_perspective_transform')

    // vertices of the two triangles that make up the tile
    const vertexArray = new Float32Array([ 0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1 ])

    program.vertexBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, program.vertexBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, vertexArray, gl.STATIC_DRAW)

    this.program = program
  }

  render(gl) {

    const program = this.program
    const painter = this.map.painter
    const sourceCache = this.sourceCache

    gl.useProgram(program)

    if (painter.renderPass !== 'translucent') return

    const tiles = sourceCache.getVisibleCoordinates().map(tileid => sourceCache.getTile(tileid))
    if (!tiles.length) return

    const tileIDs = tiles.map(tile => tile.tileID)

    const [ stencilModes, coords ] = painter.stencilConfigForOverlap(tileIDs)
    const align = !painter.options.moving

    const {
      startDateIndex,
      endDateIndex,
      opacity,
    } = this.options

    coords.forEach(coord => {
      const unwrappedTileID = coord.toUnwrapped()
      const tile = sourceCache.getTile(coord)
      if (!tile.texture) return
      tile.texture.useMipmap = false
      const texture0 = tile.texture.texture
      // const projMatrix = tile.tileID.projMatrix;
      const projMatrix = painter.transform.calculateProjMatrix(unwrappedTileID, align)
      const parentTile = sourceCache.findLoadedParent(tile.tileID, 0)
      const stencilMode = stencilModes[coord.overscaledZ]
      painter.context.setStencilMode(stencilMode)
      const fadeDuration = painter.options.isInitialLoad ? 100 : 400
      const fade = rasterFade(tile, parentTile, sourceCache, painter.transform, fadeDuration)
      tile.registerFadeDuration(fade)

      // the default tile texture unchanged
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, texture0)

      let parentScaleBy = 1
      let parentTL = [ 0, 0 ]
      const perspectiveTransform = [ 0, 0 ]

      gl.activeTexture(gl.TEXTURE1)

      if (parentTile) {
        parentTile.texture.bind(gl.NEAREST, gl.CLAMP_TO_EDGE)
        parentScaleBy = Math.pow(2, parentTile.tileID.overscaledZ - tile.tileID.overscaledZ)
        parentTL = [ tile.tileID.canonical.x * parentScaleBy % 1, tile.tileID.canonical.y * parentScaleBy % 1 ]
      } else {
        tile.texture.bind(gl.NEAREST, gl.CLAMP_TO_EDGE)
      }

      // bind the uniform values
      gl.uniform1f(program.u_var_start, startDateIndex)
      gl.uniform1f(program.u_var_end, endDateIndex)
      gl.uniform1f(program.u_layer_opacity, opacity)
      gl.uniform1f(program.u_opacity, fade.opacity)
      gl.uniform1f(program.u_fade_t, fade.mix)
      gl.uniform1f(program.u_fade_t, 0)
      gl.uniform2fv(program.u_tl_parent, parentTL)
      gl.uniform1f(program.u_scale_parent, parentScaleBy)
      gl.uniform2fv(program.u_perspective_transform, perspectiveTransform)

      gl.bindBuffer(gl.ARRAY_BUFFER, program.vertexBuffer)
      gl.enableVertexAttribArray(program.a_pos)
      gl.vertexAttribPointer(program.a_pos, 2, gl.FLOAT, false, 0, 0)

      gl.uniformMatrix4fv(program.u_matrix, false, projMatrix)
      gl.uniform1i(program.u_texture0, 0)
      gl.uniform1i(program.u_texture1, 1)

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

      gl.drawArrays(gl.TRIANGLES, 0, 6)
    })

    this.painter.resetStencilClippingMasks()

  }

  setOpacity (value) {
    this.options.opacity = value
  }

  filter(start, end) {
    console.log('Start', start, 'End', end)
    this.options.startDateIndex = start
    this.options.endDateIndex = end
  }
}

/**
 * constrain n to the given range via min + max
 *
 * @param n value
 * @param min the minimum value to be returned
 * @param max the maximum value to be returned
 * @returns the clamped value
 * @private
 */
function clamp (n, min, max) {
  return Math.min(max, Math.max(min, n))
}

export function rasterFade(tile, parentTile, sourceCache, transform, fadeDuration) {
  if (fadeDuration > 0) {
    const now = window.performance.now()
    const sinceTile = (now - tile.timeAdded) / fadeDuration
    const sinceParent = parentTile ? (now - parentTile.timeAdded) / fadeDuration : -1

    const source = sourceCache.getSource()
    const idealZ = transform.coveringZoomLevel({
      tileSize: source.tileSize,
      roundZoom: source.roundZoom
    })

    // if no parent or parent is older, fade in; if parent is younger, fade out
    const fadeIn = !parentTile || Math.abs(parentTile.tileID.overscaledZ - idealZ) > Math.abs(tile.tileID.overscaledZ - idealZ)

    const childOpacity = (fadeIn && tile.refreshedUponExpiration) ? 1 : clamp(fadeIn ? sinceTile : 1 - sinceParent, 0, 1)

    // we don't crossfade tiles that were just refreshed upon expiring:
    // once they're old enough to pass the crossfading threshold
    // (fadeDuration), unset the `refreshedUponExpiration` flag so we don't
    // incorrectly fail to crossfade them when zooming
    if (tile.refreshedUponExpiration && sinceTile >= 1) tile.refreshedUponExpiration = false
    if (parentTile) {
      return {
        opacity: 1,
        mix: 1 - childOpacity
      }
    } else {
      return {
        opacity: childOpacity,
        mix: 0
      }
    }
  } else {
    return {
      opacity: 1,
      mix: 0
    }
  }
}
