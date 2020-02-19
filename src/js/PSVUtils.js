/**
 * Static utilities for PSV
 * @namespace
 */
var PSVUtils = {};

/**
 * @summary exposes {@link PSVUtils}
 * @member {object}
 * @memberof PhotoSphereViewer
 * @readonly
 */
PhotoSphereViewer.Utils = PSVUtils;

/**
 * @summary Short-Hand for PI*2
 * @type {float}
 * @readonly
 */
PSVUtils.TwoPI = Math.PI * 2.0;

/**
 * @summary Short-Hand for PI/2
 * @type {float}
 * @readonly
 */
PSVUtils.HalfPI = Math.PI / 2.0;

/**
 * @summary Namespace for SVG creation
 * @type {string}
 * @readonly
 */
PSVUtils.svgNS = 'http://www.w3.org/2000/svg';

/**
 * @summary Checks if some three.js components are loaded
 * @param {...string} components
 * @returns {boolean}
 */
PSVUtils.checkTHREE = function(components) {
  for (var i = 0, l = arguments.length; i < l; i++) {
    if (!(arguments[i] in THREE)) {
      return false;
    }
  }

  return true;
};

/**
 * @summary Detects if canvas is supported
 * @returns {boolean}
 */
PSVUtils.isCanvasSupported = function() {
  var canvas = document.createElement('canvas');
  return !!(canvas.getContext && canvas.getContext('2d'));
};

/**
 * @summary Tries to return a canvas webgl context
 * @returns {WebGLRenderingContext}
 */
PSVUtils.getWebGLCtx = function() {
  var canvas = document.createElement('canvas');
  var names = ['webgl', 'experimental-webgl', 'moz-webgl', 'webkit-3d'];
  var context = null;

  if (!canvas.getContext) {
    return null;
  }

  if (names.some(function(name) {
      try {
        context = canvas.getContext(name);
        return (context && typeof context.getParameter === 'function');
      } catch (e) {
        return false;
      }
    })) {
    return context;
  }
  else {
    return null;
  }
};

/**
 * @summary Detects if WebGL is supported
 * @returns {boolean}
 */
PSVUtils.isWebGLSupported = function() {
  return !!window.WebGLRenderingContext && PSVUtils.getWebGLCtx() !== null;
};

/**
 * @summary Detects if device orientation is supported
 * @description We can only be sure device orientation is supported once received an event with coherent data
 * @returns {Promise<boolean>}
 */
PSVUtils.isDeviceOrientationSupported = function() {
  return new Promise(function(resolve) {
    if ('DeviceOrientationEvent' in window) {
      var listener = function(e) {
        if (e && e.alpha !== null && !isNaN(e.alpha)) {
          resolve(true);
        }
        else {
          resolve(false);
        }

        window.removeEventListener('deviceorientation', listener);
      };

      window.addEventListener('deviceorientation', listener, false);

      // after 2 secs, auto-reject the promise
      setTimeout(listener, 2000);
    }
    else {
      resolve(false);
    }
  });
};

/**
 * @summary Detects if the user is using a touch screen
 * @returns {Promise<boolean>}
 */
PSVUtils.isTouchEnabled = function() {
  return new Promise(function(resolve) {
    var listener = function(e) {
      if (e) {
        resolve(true);
      }
      else {
        resolve(false);
      }

      window.removeEventListener('touchstart', listener);
    };

    window.addEventListener('touchstart', listener, false);

    // after 10 secs auto-reject the promise
    setTimeout(listener, 10000);
  });
};

/**
 * @summary Gets max texture width in WebGL context
 * @returns {int}
 */
PSVUtils.getMaxTextureWidth = function() {
  var ctx = PSVUtils.getWebGLCtx();
  if (ctx !== null) {
    return ctx.getParameter(ctx.MAX_TEXTURE_SIZE);
  }
  else {
    return 0;
  }
};

/**
 * @summary Toggles a CSS class
 * @param {HTMLElement|SVGElement} element
 * @param {string} className
 * @param {boolean} [active] - forced state
 */
PSVUtils.toggleClass = function(element, className, active) {
  // manual implementation for IE11 and SVGElement
  if (!element.classList) {
    var currentClassName = element.getAttribute('class') || '';
    var currentActive = currentClassName.indexOf(className) !== -1;
    var regex = new RegExp('(?:^|\\s)' + className + '(?:\\s|$)');

    if ((active === undefined || active) && !currentActive) {
      currentClassName += currentClassName.length > 0 ? ' ' + className : className;
    }
    else if (!active) {
      currentClassName = currentClassName.replace(regex, ' ');
    }

    element.setAttribute('class', currentClassName);
  }
  else {
    if (active === undefined) {
      element.classList.toggle(className);
    }
    else if (active && !element.classList.contains(className)) {
      element.classList.add(className);
    }
    else if (!active) {
      element.classList.remove(className);
    }
  }
};

/**
 * @summary Adds one or several CSS classes to an element
 * @param {HTMLElement} element
 * @param {string} className
 */
PSVUtils.addClasses = function(element, className) {
  if (!className) {
    return;
  }
  className.split(' ').forEach(function(name) {
    PSVUtils.toggleClass(element, name, true);
  });
};

/**
 * @summary Removes one or several CSS classes to an element
 * @param {HTMLElement} element
 * @param {string} className
 */
PSVUtils.removeClasses = function(element, className) {
  if (!className) {
    return;
  }
  className.split(' ').forEach(function(name) {
    PSVUtils.toggleClass(element, name, false);
  });
};

/**
 * @summary Searches if an element has a particular parent at any level including itself
 * @param {HTMLElement} el
 * @param {HTMLElement} parent
 * @returns {boolean}
 */
PSVUtils.hasParent = function(el, parent) {
  do {
    if (el === parent) {
      return true;
    }
  } while (!!(el = el.parentNode));

  return false;
};

/**
 * @summary Gets the closest parent (can by itself)
 * @param {HTMLElement|SVGElement} el
 * @param {string} selector
 * @returns {HTMLElement}
 */
PSVUtils.getClosest = function(el, selector) {
  var matches = el.matches || el.msMatchesSelector;

  do {
    if (matches.bind(el)(selector)) {
      return el;
    }
  } while (!!(el instanceof SVGElement ? el = el.parentNode : el = el.parentElement));

  return null;
};

/**
 * @summary Gets the event name for mouse wheel
 * @returns {string}
 */
PSVUtils.mouseWheelEvent = function() {
  return 'onwheel' in document.createElement('div') ? 'wheel' : // Modern browsers support "wheel"
    document.onmousewheel !== undefined ? 'mousewheel' : // Webkit and IE support at least "mousewheel"
      'DOMMouseScroll'; // let's assume that remaining browsers are older Firefox
};

/**
 * @summary Returns the key name of a KeyboardEvent
 * @param {KeyboardEvent} evt
 * @returns {string}
 */
PSVUtils.getEventKey = function(evt) {
  var key = evt.key || PSVUtils.getEventKey.KEYMAP[evt.keyCode || evt.which];

  if (key && PSVUtils.getEventKey.MS_KEYMAP[key]) {
    key = PSVUtils.getEventKey.MS_KEYMAP[key];
  }

  return key;
};

/**
 * @summary Map between keyboard events `keyCode|which` and `key`
 * @type {Object.<int, string>}
 * @readonly
 * @protected
 */
PSVUtils.getEventKey.KEYMAP = {
  13: 'Enter',
  27: 'Escape',
  32: ' ',
  33: 'PageUp',
  34: 'PageDown',
  37: 'ArrowLeft',
  38: 'ArrowUp',
  39: 'ArrowRight',
  40: 'ArrowDown',
  46: 'Delete',
  107: '+',
  109: '-'
};

/**
 * @summary Map for non standard keyboard events `key` for IE and Edge
 * @see https://github.com/shvaikalesh/shim-keyboard-event-key
 * @type {Object.<string, string>}
 * @readonly
 * @protected
 */
PSVUtils.getEventKey.MS_KEYMAP = {
  Add: '+',
  Del: 'Delete',
  Down: 'ArrowDown',
  Esc: 'Escape',
  Left: 'ArrowLeft',
  Right: 'ArrowRight',
  Spacebar: ' ',
  Subtract: '-',
  Up: 'ArrowUp'
};

/**
 * @summary  Gets the event name for fullscreen
 * @returns {string}
 */
PSVUtils.fullscreenEvent = function() {
  var map = {
    'exitFullscreen': 'fullscreenchange',
    'webkitExitFullscreen': 'webkitfullscreenchange',
    'mozCancelFullScreen': 'mozfullscreenchange',
    'msExitFullscreen': 'MSFullscreenChange'
  };

  for (var exit in map) {
    if (map.hasOwnProperty(exit) && exit in document) {
      return map[exit];
    }
  }

  return null;
};

/**
 * @summary Ensures that a number is in a given interval
 * @param {number} x
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
PSVUtils.bound = function(x, min, max) {
  return Math.max(min, Math.min(max, x));
};

/**
 * @summary Checks if a value is an integer
 * @function
 * @param {*} value
 * @returns {boolean}
 */
PSVUtils.isInteger = Number.isInteger || function(value) {
    return typeof value === 'number' && isFinite(value) && Math.floor(value) === value;
  };

/**
 * @summary Computes the sum of an array
 * @param {number[]} array
 * @returns {number}
 */
PSVUtils.sum = function(array) {
  return array.reduce(function(a, b) {
    return a + b;
  }, 0);
};

/**
 * @summary Transforms a string to dash-case
 * {@link https://github.com/shahata/dasherize}
 * @param {string} str
 * @returns {string}
 */
PSVUtils.dasherize = function(str) {
  return str.replace(/[A-Z](?:(?=[^A-Z])|[A-Z]*(?=[A-Z][^A-Z]|$))/g, function(s, i) {
    return (i > 0 ? '-' : '') + s.toLowerCase();
  });
};

/**
 * @summary Returns the value of a given attribute in the panorama metadata
 * @param {string} data
 * @param {string} attr
 * @returns (string)
 */
PSVUtils.getXMPValue = function(data, attr) {
  var result;
  // XMP data are stored in children
  if ((result = data.match('<GPano:' + attr + '>(.*)</GPano:' + attr + '>')) !== null) {
    return result[1];
  }
  // XMP data are stored in attributes
  else if ((result = data.match('GPano:' + attr + '="(.*?)"')) !== null) {
    return result[1];
  }
  else {
    return null;
  }
};

/**
 * @summary Detects if fullscreen is enabled
 * @param {HTMLElement} elt
 * @returns {boolean}
 */
PSVUtils.isFullscreenEnabled = function(elt) {
  return (document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement) === elt;
};

/**
 * @summary Enters fullscreen mode
 * @param {HTMLElement} elt
 */
PSVUtils.requestFullscreen = function(elt) {
  (elt.requestFullscreen || elt.mozRequestFullScreen || elt.webkitRequestFullscreen || elt.msRequestFullscreen).call(elt);
};

/**
 * @summary Exits fullscreen mode
 */
PSVUtils.exitFullscreen = function() {
  (document.exitFullscreen || document.mozCancelFullScreen || document.webkitExitFullscreen || document.msExitFullscreen).call(document);
};

/**
 * @summary Gets an element style
 * @param {HTMLElement} elt
 * @param {string} prop
 * @returns {*}
 */
PSVUtils.getStyle = function(elt, prop) {
  return window.getComputedStyle(elt, null)[prop];
};

/**
 * @summary Compute the shortest offset between two longitudes
 * @param {float} from
 * @param {float} to
 * @returns {float}
 */
PSVUtils.getShortestArc = function(from, to) {
  var tCandidates = [
    0, // direct
    PSVUtils.TwoPI, // clock-wise cross zero
    -PSVUtils.TwoPI // counter-clock-wise cross zero
  ];

  return tCandidates.reduce(function(value, candidate) {
    candidate = to - from + candidate;
    return Math.abs(candidate) < Math.abs(value) ? candidate : value;
  }, Infinity);
};

/**
 * @summary Computes the angle between the current position and a target position
 * @param {PhotoSphereViewer.Position} position1
 * @param {PhotoSphereViewer.Position} position2
 * @returns {number}
 */
PSVUtils.getAngle = function(position1, position2) {
  return Math.acos(
    Math.cos(position1.latitude) *
    Math.cos(position2.latitude) *
    Math.cos(position1.longitude - position2.longitude) +
    Math.sin(position1.latitude) *
    Math.sin(position2.latitude)
  );
};

/**
 * @summary Translate CSS values like "top center" or "10% 50%" as top and left positions
 * @description The implementation is as close as possible to the "background-position" specification
 * {@link https://developer.mozilla.org/en-US/docs/Web/CSS/background-position}
 * @param {string} value
 * @returns {{top: float, left: float}}
 */
PSVUtils.parsePosition = function(value) {
  if (!value) {
    return { top: 0.5, left: 0.5 };
  }

  if (typeof value === 'object') {
    return value;
  }

  var tokens = value.toLocaleLowerCase().split(' ').slice(0, 2);

  if (tokens.length === 1) {
    if (PSVUtils.parsePosition.positions[tokens[0]] !== undefined) {
      tokens = [tokens[0], 'center'];
    }
    else {
      tokens = [tokens[0], tokens[0]];
    }
  }

  var xFirst = tokens[1] !== 'left' && tokens[1] !== 'right' && tokens[0] !== 'top' && tokens[0] !== 'bottom';

  tokens = tokens.map(function(token) {
    return PSVUtils.parsePosition.positions[token] || token;
  });

  if (!xFirst) {
    tokens.reverse();
  }

  var parsed = tokens.join(' ').match(/^([0-9.]+)% ([0-9.]+)%$/);

  if (parsed) {
    return {
      left: parsed[1] / 100,
      top: parsed[2] / 100
    };
  }
  else {
    return { top: 0.5, left: 0.5 };
  }
};

PSVUtils.parsePosition.positions = { 'top': '0%', 'bottom': '100%', 'left': '0%', 'right': '100%', 'center': '50%' };

/**
 * @summary Parses an speed
 * @param {string} speed - The speed, in radians/degrees/revolutions per second/minute
 * @returns {float} radians per second
 * @throws {PSVError} when the speed cannot be parsed
 */
PSVUtils.parseSpeed = function(speed) {
  if (typeof speed === 'string') {
    speed = speed.toString().trim();

    // Speed extraction
    var speed_value = parseFloat(speed.replace(/^(-?[0-9]+(?:\.[0-9]*)?).*$/, '$1'));
    var speed_unit = speed.replace(/^-?[0-9]+(?:\.[0-9]*)?(.*)$/, '$1').trim();

    // "per minute" -> "per second"
    if (speed_unit.match(/(pm|per minute)$/)) {
      speed_value /= 60;
    }

    // Which unit?
    switch (speed_unit) {
      // Degrees per minute / second
      case 'dpm':
      case 'degrees per minute':
      case 'dps':
      case 'degrees per second':
        speed = THREE.Math.degToRad(speed_value);
        break;

      // Radians per minute / second
      case 'radians per minute':
      case 'radians per second':
        speed = speed_value;
        break;

      // Revolutions per minute / second
      case 'rpm':
      case 'revolutions per minute':
      case 'rps':
      case 'revolutions per second':
        speed = speed_value * PSVUtils.TwoPI;
        break;

      // Unknown unit
      default:
        throw new PSVError('unknown speed unit "' + speed_unit + '"');
    }
  }

  return speed;
};

/**
 * @summary Parses an angle value in radians or degrees and returns a normalized value in radians
 * @param {string|number} angle - eg: 3.14, 3.14rad, 180deg
 * @param {boolean} [zeroCenter=false] - normalize between -Pi/2 - Pi/2 instead of 0 - 2*Pi
 * @param {boolean} [halfCircle=zeroCenter] - normalize between -Pi - Pi instead of -Pi/2 - Pi/2
 * @returns {float}
 * @throws {PSVError} when the angle cannot be parsed
 */
PSVUtils.parseAngle = function(angle, zeroCenter, halfCircle) {
  if (halfCircle === undefined) {
    halfCircle = zeroCenter;
  }

  if (typeof angle === 'string') {
    var match = angle.toLowerCase().trim().match(/^(-?[0-9]+(?:\.[0-9]*)?)(.*)$/);

    if (!match) {
      throw new PSVError('unknown angle "' + angle + '"');
    }

    var value = parseFloat(match[1]);
    var unit = match[2];

    if (unit) {
      switch (unit) {
        case 'deg':
        case 'degs':
          angle = THREE.Math.degToRad(value);
          break;
        case 'rad':
        case 'rads':
          angle = value;
          break;
        default:
          throw new PSVError('unknown angle unit "' + unit + '"');
      }
    }
    else {
      angle = value;
    }
  }

  angle = (zeroCenter ? angle + Math.PI : angle) % PSVUtils.TwoPI;

  if (angle < 0) {
    angle = PSVUtils.TwoPI + angle;
  }

  return zeroCenter ? PSVUtils.bound(angle - Math.PI, -Math.PI / (halfCircle ? 2 : 1), Math.PI / (halfCircle ? 2 : 1)) : angle;
};

/**
 * @summary Removes all children of a three.js scene and dispose all textures
 * @param {THREE.Scene} scene
 */
PSVUtils.cleanTHREEScene = function(scene) {
  scene.children.forEach(function(item) {
    if (item instanceof THREE.Mesh) {
      if (item.geometry) {
        item.geometry.dispose();
        item.geometry = null;
      }

      if (item.material) {
        if (item.material.materials) {
          item.material.materials.forEach(function(material) {
            if (material.map) {
              material.map.dispose();
              material.map = null;
            }

            material.dispose();
          });

          item.material.materials.length = 0;
        }
        else {
          if (item.material.map) {
            item.material.map.dispose();
            item.material.map = null;
          }

          item.material.dispose();
        }

        item.material = null;
      }
    }
  });
  scene.children.length = 0;
};

/**
 * @summary Returns a function, that, when invoked, will only be triggered at most once during a given window of time.
 * @copyright underscore.js - modified by Clément Prévost {@link http://stackoverflow.com/a/27078401}
 * @param {Function} func
 * @param {int} wait
 * @returns {Function}
 */
PSVUtils.throttle = function(func, wait) {
  var self, args, result;
  var timeout = null;
  var previous = 0;
  var later = function() {
    previous = Date.now();
    timeout = null;
    result = func.apply(self, args);
    if (!timeout) {
      self = args = null;
    }
  };
  return function() {
    var now = Date.now();
    if (!previous) {
      previous = now;
    }
    var remaining = wait - (now - previous);
    self = this;
    args = arguments;
    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = now;
      result = func.apply(self, args);
      if (!timeout) {
        self = args = null;
      }
    }
    else if (!timeout) {
      timeout = setTimeout(later, remaining);
    }
    return result;
  };
};

/**
 * @summary Test if an object is a plain object
 * @description Test if an object is a plain object, i.e. is constructed
 * by the built-in Object constructor and inherits directly from Object.prototype
 * or null. Some built-in objects pass the test, e.g. Math which is a plain object
 * and some host or exotic objects may pass also.
 * {@link http://stackoverflow.com/a/5878101/1207670}
 * @param {*} obj
 * @returns {boolean}
 */
PSVUtils.isPlainObject = function(obj) {
  // Basic check for Type object that's not null
  if (typeof obj === 'object' && obj !== null) {
    // If Object.getPrototypeOf supported, use it
    if (typeof Object.getPrototypeOf === 'function') {
      var proto = Object.getPrototypeOf(obj);
      return proto === Object.prototype || proto === null;
    }

    // Otherwise, use internal class
    // This should be reliable as if getPrototypeOf not supported, is pre-ES5
    return Object.prototype.toString.call(obj) === '[object Object]';
  }

  // Not an object
  return false;
};

/**
 * @summary Merges the enumerable attributes of two objects
 * @description Replaces arrays and alters the target object.
 * @copyright Nicholas Fisher <nfisher110@gmail.com>
 * @param {Object} target
 * @param {Object} src
 * @returns {Object} target
 */
PSVUtils.deepmerge = function(target, src) {
  var first = src;

  return (function merge(target, src) {
    if (Array.isArray(src)) {
      if (!target || !Array.isArray(target)) {
        target = [];
      }
      else {
        target.length = 0;
      }
      src.forEach(function(e, i) {
        target[i] = merge(null, e);
      });
    }
    else if (typeof src === 'object') {
      if (!target || Array.isArray(target)) {
        target = {};
      }
      Object.keys(src).forEach(function(key) {
        if (typeof src[key] !== 'object' || !src[key] || !PSVUtils.isPlainObject(src[key])) {
          target[key] = src[key];
        }
        else if (src[key] != first) {
          if (!target[key]) {
            target[key] = merge(null, src[key]);
          }
          else {
            merge(target[key], src[key]);
          }
        }
      });
    }
    else {
      target = src;
    }

    return target;
  }(target, src));
};

/**
 * @summary Clones an object
 * @param {Object} src
 * @returns {Object}
 */
PSVUtils.clone = function(src) {
  return PSVUtils.deepmerge(null, src);
};

/**
 * @summary Normalize mousewheel values accross browsers
 * @description From Facebook's Fixed Data Table
 * {@link https://github.com/facebookarchive/fixed-data-table/blob/master/src/vendor_upstream/dom/normalizeWheel.js}
 * @copyright Facebook
 * @param {MouseWheelEvent} event
 * @returns {{spinX: number, spinY: number, pixelX: number, pixelY: number}}
 */
PSVUtils.normalizeWheel = function(event) {
  var PIXEL_STEP  = 10;
  var LINE_HEIGHT = 40;
  var PAGE_HEIGHT = 800;

  var sX = 0, sY = 0; // spinX, spinY
  var pX = 0, pY = 0; // pixelX, pixelY

  // Legacy
  if ('detail'      in event) { sY = event.detail; }
  if ('wheelDelta'  in event) { sY = -event.wheelDelta / 120; }
  if ('wheelDeltaY' in event) { sY = -event.wheelDeltaY / 120; }
  if ('wheelDeltaX' in event) { sX = -event.wheelDeltaX / 120; }

  // side scrolling on FF with DOMMouseScroll
  if ('axis' in event && event.axis === event.HORIZONTAL_AXIS) {
    sX = sY;
    sY = 0;
  }

  pX = sX * PIXEL_STEP;
  pY = sY * PIXEL_STEP;

  if ('deltaY' in event) { pY = event.deltaY; }
  if ('deltaX' in event) { pX = event.deltaX; }

  if ((pX || pY) && event.deltaMode) {
    if (event.deltaMode === 1) { // delta in LINE units
      pX *= LINE_HEIGHT;
      pY *= LINE_HEIGHT;
    }
    else {                      // delta in PAGE units
      pX *= PAGE_HEIGHT;
      pY *= PAGE_HEIGHT;
    }
  }

  // Fall-back if spin cannot be determined
  if (pX && !sX) { sX = (pX < 1) ? -1 : 1; }
  if (pY && !sY) { sY = (pY < 1) ? -1 : 1; }

  return {
    spinX: sX,
    spinY: sY,
    pixelX: pX,
    pixelY: pY
  };
};

/**
 * @callback ForEach
 * @memberOf PSVUtils
 * @param {*} value
 * @param {string} key
 */

/**
 * Loops over enumerable properties of an object
 * @param {object} object
 * @param {ForEach} callback
 */
PSVUtils.forEach = function(object, callback) {
  for (var key in object) {
    if (object.hasOwnProperty(key)) {
      callback(object[key], key);
    }
  }
};
