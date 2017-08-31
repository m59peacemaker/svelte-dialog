'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var scheduler = {
    components: [],
    running: false,
    add: function (component) {
        if (~scheduler.components.indexOf(component))
            return;
        scheduler.components.push(component);
        if (!scheduler.running) {
            scheduler.running = true;
            requestAnimationFrame(scheduler.next);
        }
    },
    next: function () {
        var now = window.performance.now();
        var hasComponents = false;
        var i = scheduler.components.length;
        while (i--) {
            var component = scheduler.components[i];
            var data = {};
            var hasTweens = false;
            for (var key in component._currentTweens) {
                var t = component._currentTweens[key];
                if (now >= t.end) {
                    data[key] = t.to;
                    delete component._currentTweens[key];
                    t.fulfil();
                }
                else {
                    hasTweens = true;
                    hasComponents = true;
                    if (now >= t.start) {
                        var p = (now - t.start) / t.duration;
                        data[key] = t.value(t.ease(p));
                    }
                }
            }
            component._tweening = true;
            component.set(data);
            component._tweening = false;
            if (!hasTweens)
                scheduler.components.splice(i, 1);
        }
        if (hasComponents) {
            requestAnimationFrame(scheduler.next);
        }
        else {
            scheduler.running = false;
        }
    }
};
function snap(to) {
    return function () { return to; };
}
function interpolate(a, b) {
    if (a === b || a !== a)
        return snap(a);
    var type = typeof a;
    if (type !== typeof b || Array.isArray(a) !== Array.isArray(b)) {
        throw new Error('Cannot interpolate values of different type');
    }
    if (Array.isArray(a)) {
        var arr_1 = b.map(function (bi, i) {
            return interpolate(a[i], bi);
        });
        return function (t) {
            return arr_1.map(function (fn) { return fn(t); });
        };
    }
    if (type === 'object') {
        if (!a || !b)
            throw new Error('Object cannot be null');
        if (isDate(a) && isDate(b)) {
            a = a.getTime();
            b = b.getTime();
            var delta_1 = b - a;
            return function (t) {
                return new Date(a + t * delta_1);
            };
        }
        var keys_1 = Object.keys(b);
        var interpolators_1 = {};
        var result_1 = {};
        keys_1.forEach(function (key) {
            interpolators_1[key] = interpolate(a[key], b[key]);
        });
        return function (t) {
            keys_1.forEach(function (key) {
                result_1[key] = interpolators_1[key](t);
            });
            return result_1;
        };
    }
    if (type === 'number') {
        var delta_2 = b - a;
        return function (t) {
            return a + t * delta_2;
        };
    }
    throw new Error("Cannot interpolate " + type + " values");
}
function linear(x) {
    return x;
}
function tween(key, to, options) {
    var _this = this;
    if (options === void 0) { options = {}; }
    if (!this._currentTweens) {
        this._currentTweens = Object.create(null);
        this._tweening = false;
        var set_1 = this.set;
        this.set = function (data) {
            if (!_this._tweening) {
                for (var key_1 in data) {
                    if (_this._currentTweens[key_1])
                        _this._currentTweens[key_1].abort();
                }
            }
            set_1.call(_this, data);
        };
    }
    var durationProgressModifier = 1;
    if (this._currentTweens[key]) {
        var progressRatio = this._currentTweens[key].abort().progressRatio;
        if (options.adjustDuration) {
            durationProgressModifier = progressRatio;
        }
    }
    var start = window.performance.now() + (options.delay || 0);
    var duration = (options.duration || 400) * durationProgressModifier;
    var end = start + duration;
    var t = {
        key: key,
        value: (options.interpolate || interpolate)(this.get(key), to),
        to: to,
        start: start,
        end: end,
        duration: duration,
        ease: options.easing || linear,
        running: true,
        abort: function () {
            t.running = false;
            delete _this._currentTweens[key];
            return { progressRatio: (window.performance.now() - start) / duration };
        }
    };
    this._currentTweens[key] = t;
    scheduler.add(this);
    var promise = new Promise(function (fulfil) {
        t.fulfil = fulfil;
    });
    promise.abort = t.abort;
    return promise;
}
function isDate(obj) {
    return Object.prototype.toString.call(obj) === '[object Date]';
}

function cubicOut(t) {
  var f = t - 1.0;
  return f * f * f + 1.0
}

var tabbable = function(el) {
  var basicTabbables = [];
  var orderedTabbables = [];

  // A node is "available" if
  // - it's computed style
  var isUnavailable = createIsUnavailable();

  var candidateSelectors = [
    'input',
    'select',
    'a[href]',
    'textarea',
    'button',
    '[tabindex]',
  ];

  var candidates = el.querySelectorAll(candidateSelectors);

  var candidate, candidateIndex;
  for (var i = 0, l = candidates.length; i < l; i++) {
    candidate = candidates[i];
    candidateIndex = parseInt(candidate.getAttribute('tabindex'), 10) || candidate.tabIndex;

    if (
      candidateIndex < 0
      || (candidate.tagName === 'INPUT' && candidate.type === 'hidden')
      || candidate.disabled
      || isUnavailable(candidate)
    ) {
      continue;
    }

    if (candidateIndex === 0) {
      basicTabbables.push(candidate);
    } else {
      orderedTabbables.push({
        index: i,
        tabIndex: candidateIndex,
        node: candidate,
      });
    }
  }

  var tabbableNodes = orderedTabbables
    .sort(function(a, b) {
      return a.tabIndex === b.tabIndex ? a.index - b.index : a.tabIndex - b.tabIndex;
    })
    .map(function(a) {
      return a.node
    });

  Array.prototype.push.apply(tabbableNodes, basicTabbables);

  return tabbableNodes;
};

function createIsUnavailable() {
  // Node cache must be refreshed on every check, in case
  // the content of the element has changed
  var isOffCache = [];

  // "off" means `display: none;`, as opposed to "hidden",
  // which means `visibility: hidden;`. getComputedStyle
  // accurately reflects visiblity in context but not
  // "off" state, so we need to recursively check parents.

  function isOff(node, nodeComputedStyle) {
    if (node === document.documentElement) return false;

    // Find the cached node (Array.prototype.find not available in IE9)
    for (var i = 0, length = isOffCache.length; i < length; i++) {
      if (isOffCache[i][0] === node) return isOffCache[i][1];
    }

    nodeComputedStyle = nodeComputedStyle || window.getComputedStyle(node);

    var result = false;

    if (nodeComputedStyle.display === 'none') {
      result = true;
    } else if (node.parentNode) {
      result = isOff(node.parentNode);
    }

    isOffCache.push([node, result]);

    return result;
  }

  return function isUnavailable(node) {
    if (node === document.documentElement) return false;

    var computedStyle = window.getComputedStyle(node);

    if (isOff(node, computedStyle)) return true;

    return computedStyle.visibility === 'hidden';
  }
}

var listeningFocusTrap = null;

function focusTrap(element, userOptions) {
  var tabbableNodes = [];
  var nodeFocusedBeforeActivation = null;
  var active = false;
  var paused = false;

  var container = (typeof element === 'string')
    ? document.querySelector(element)
    : element;

  var config = userOptions || {};
  config.returnFocusOnDeactivate = (userOptions && userOptions.returnFocusOnDeactivate !== undefined)
    ? userOptions.returnFocusOnDeactivate
    : true;
  config.escapeDeactivates = (userOptions && userOptions.escapeDeactivates !== undefined)
    ? userOptions.escapeDeactivates
    : true;

  var trap = {
    activate: activate,
    deactivate: deactivate,
    pause: pause,
    unpause: unpause,
  };

  return trap;

  function activate(activateOptions) {
    if (active) return;

    var defaultedActivateOptions = {
      onActivate: (activateOptions && activateOptions.onActivate !== undefined)
        ? activateOptions.onActivate
        : config.onActivate,
    };

    active = true;
    paused = false;
    nodeFocusedBeforeActivation = document.activeElement;

    if (defaultedActivateOptions.onActivate) {
      defaultedActivateOptions.onActivate();
    }

    addListeners();
    return trap;
  }

  function deactivate(deactivateOptions) {
    if (!active) return;

    var defaultedDeactivateOptions = {
      returnFocus: (deactivateOptions && deactivateOptions.returnFocus !== undefined)
        ? deactivateOptions.returnFocus
        : config.returnFocusOnDeactivate,
      onDeactivate: (deactivateOptions && deactivateOptions.onDeactivate !== undefined)
        ? deactivateOptions.onDeactivate
        : config.onDeactivate,
    };

    removeListeners();

    if (defaultedDeactivateOptions.onDeactivate) {
      defaultedDeactivateOptions.onDeactivate();
    }

    if (defaultedDeactivateOptions.returnFocus) {
      setTimeout(function () {
        tryFocus(nodeFocusedBeforeActivation);
      }, 0);
    }

    active = false;
    paused = false;
    return this;
  }

  function pause() {
    if (paused || !active) return;
    paused = true;
    removeListeners();
  }

  function unpause() {
    if (!paused || !active) return;
    paused = false;
    addListeners();
  }

  function addListeners() {
    if (!active) return;

    // There can be only one listening focus trap at a time
    if (listeningFocusTrap) {
      listeningFocusTrap.pause();
    }
    listeningFocusTrap = trap;

    updateTabbableNodes();
    tryFocus(firstFocusNode());
    document.addEventListener('focus', checkFocus, true);
    document.addEventListener('click', checkClick, true);
    document.addEventListener('mousedown', checkPointerDown, true);
    document.addEventListener('touchstart', checkPointerDown, true);
    document.addEventListener('keydown', checkKey, true);

    return trap;
  }

  function removeListeners() {
    if (!active || listeningFocusTrap !== trap) return;

    document.removeEventListener('focus', checkFocus, true);
    document.removeEventListener('click', checkClick, true);
    document.removeEventListener('mousedown', checkPointerDown, true);
    document.removeEventListener('touchstart', checkPointerDown, true);
    document.removeEventListener('keydown', checkKey, true);

    listeningFocusTrap = null;

    return trap;
  }

  function getNodeForOption(optionName) {
    var optionValue = config[optionName];
    var node = optionValue;
    if (!optionValue) {
      return null;
    }
    if (typeof optionValue === 'string') {
      node = document.querySelector(optionValue);
      if (!node) {
        throw new Error('`' + optionName + '` refers to no known node');
      }
    }
    if (typeof optionValue === 'function') {
      node = optionValue();
      if (!node) {
        throw new Error('`' + optionName + '` did not return a node');
      }
    }
    return node;
  }

  function firstFocusNode() {
    var node;
    if (getNodeForOption('initialFocus') !== null) {
      node = getNodeForOption('initialFocus');
    } else if (container.contains(document.activeElement)) {
      node = document.activeElement;
    } else {
      node = tabbableNodes[0] || getNodeForOption('fallbackFocus');
    }

    if (!node) {
      throw new Error('You can\'t have a focus-trap without at least one focusable element');
    }

    return node;
  }

  // This needs to be done on mousedown and touchstart instead of click
  // so that it precedes the focus event
  function checkPointerDown(e) {
    if (config.clickOutsideDeactivates && !container.contains(e.target)) {
      deactivate({ returnFocus: false });
    }
  }

  function checkClick(e) {
    if (config.clickOutsideDeactivates) return;
    if (container.contains(e.target)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }

  function checkFocus(e) {
    if (container.contains(e.target)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    // Checking for a blur method here resolves a Firefox issue (#15)
    if (typeof e.target.blur === 'function') e.target.blur();
  }

  function checkKey(e) {
    if (e.key === 'Tab' || e.keyCode === 9) {
      handleTab(e);
    }

    if (config.escapeDeactivates !== false && isEscapeEvent(e)) {
      deactivate();
    }
  }

  function handleTab(e) {
    e.preventDefault();
    updateTabbableNodes();
    var currentFocusIndex = tabbableNodes.indexOf(e.target);
    var lastTabbableNode = tabbableNodes[tabbableNodes.length - 1];
    var firstTabbableNode = tabbableNodes[0];

    if (e.shiftKey) {
      if (e.target === firstTabbableNode || tabbableNodes.indexOf(e.target) === -1) {
        return tryFocus(lastTabbableNode);
      }
      return tryFocus(tabbableNodes[currentFocusIndex - 1]);
    }

    if (e.target === lastTabbableNode) return tryFocus(firstTabbableNode);

    tryFocus(tabbableNodes[currentFocusIndex + 1]);
  }

  function updateTabbableNodes() {
    tabbableNodes = tabbable(container);
  }
}

function isEscapeEvent(e) {
  return e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27;
}

function tryFocus(node) {
  if (!node || !node.focus) return;
  node.focus();
  if (node.tagName.toLowerCase() === 'input') {
    node.select();
  }
}

var focusTrap_1 = focusTrap;

function noop() {}

function assign(target) {
	var k,
		source,
		i = 1,
		len = arguments.length;
	for (; i < len; i++) {
		source = arguments[i];
		for (k in source) target[k] = source[k];
	}

	return target;
}

function appendNode(node, target) {
	target.appendChild(node);
}

function insertNode(node, target, anchor) {
	target.insertBefore(node, anchor);
}

function detachNode(node) {
	node.parentNode.removeChild(node);
}

function reinsertBetween(before, after, target) {
	while (before.nextSibling && before.nextSibling !== after) {
		target.appendChild(before.parentNode.removeChild(before.nextSibling));
	}
}

function createElement(name) {
	return document.createElement(name);
}

function createText(data) {
	return document.createTextNode(data);
}

function createComment() {
	return document.createComment('');
}

function addListener(node, event, handler) {
	node.addEventListener(event, handler, false);
}

function removeListener(node, event, handler) {
	node.removeEventListener(event, handler, false);
}

function setAttribute(node, attribute, value) {
	node.setAttribute(attribute, value);
}

function destroy(detach) {
	this.destroy = this.set = this.get = noop;
	this.fire('destroy');

	if (detach !== false) this._fragment.unmount();
	this._fragment.destroy();
	this._fragment = this._state = null;
}

function differs(a, b) {
	return a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}

function dispatchObservers(component, group, changed, newState, oldState) {
	for (var key in group) {
		if (!changed[key]) continue;

		var newValue = newState[key];
		var oldValue = oldState[key];

		var callbacks = group[key];
		if (!callbacks) continue;

		for (var i = 0; i < callbacks.length; i += 1) {
			var callback = callbacks[i];
			if (callback.__calling) continue;

			callback.__calling = true;
			callback.call(component, newValue, oldValue);
			callback.__calling = false;
		}
	}
}

function get(key) {
	return key ? this._state[key] : this._state;
}

function fire(eventName, data) {
	var handlers =
		eventName in this._handlers && this._handlers[eventName].slice();
	if (!handlers) return;

	for (var i = 0; i < handlers.length; i += 1) {
		handlers[i].call(this, data);
	}
}

function observe(key, callback, options) {
	var group = options && options.defer
		? this._observers.post
		: this._observers.pre;

	(group[key] || (group[key] = [])).push(callback);

	if (!options || options.init !== false) {
		callback.__calling = true;
		callback.call(this, this._state[key]);
		callback.__calling = false;
	}

	return {
		cancel: function() {
			var index = group[key].indexOf(callback);
			if (~index) group[key].splice(index, 1);
		}
	};
}

function on(eventName, handler) {
	if (eventName === 'teardown') return this.on('destroy', handler);

	var handlers = this._handlers[eventName] || (this._handlers[eventName] = []);
	handlers.push(handler);

	return {
		cancel: function() {
			var index = handlers.indexOf(handler);
			if (~index) handlers.splice(index, 1);
		}
	};
}

function set(newState) {
	this._set(assign({}, newState));
	if (this._root._lock) return;
	this._root._lock = true;
	callAll(this._root._beforecreate);
	callAll(this._root._oncreate);
	callAll(this._root._aftercreate);
	this._root._lock = false;
}

function _set(newState) {
	var oldState = this._state,
		changed = {},
		dirty = false;

	for (var key in newState) {
		if (differs(newState[key], oldState[key])) changed[key] = dirty = true;
	}
	if (!dirty) return;

	this._state = assign({}, oldState, newState);
	this._recompute(changed, this._state, oldState, false);
	if (this._bind) this._bind(changed, this._state);
	dispatchObservers(this, this._observers.pre, changed, this._state, oldState);
	this._fragment.update(changed, this._state);
	dispatchObservers(this, this._observers.post, changed, this._state, oldState);
}

function callAll(fns) {
	while (fns && fns.length) fns.pop()();
}

var proto = {
	destroy: destroy,
	get: get,
	fire: fire,
	observe: observe,
	on: on,
	set: set,
	teardown: destroy,
	_recompute: noop,
	_set: _set
};

var template$1 = (function () {
const DEFAULTS = {
  opacity: 0.3,
  background: '#000'
};
Object.freeze(DEFAULTS);

return {
  setup (Scrim) {
    Scrim.DEFAULTS = DEFAULTS;
  },

  data () {
    return Object.assign({}, DEFAULTS)
  }
}
}());

function encapsulateStyles$1 ( node ) {
	setAttribute( node, 'svelte-4157681185', '' );
}

function add_css$1 () {
	var style = createElement( 'style' );
	style.id = 'svelte-4157681185-style';
	style.textContent = ".scrim[svelte-4157681185]{position:fixed;top:0;right:0;left:0;height:100vh;-webkit-tap-highlight-color:rgba(0, 0, 0, 0)}";
	appendNode( style, document.head );
}

function create_main_fragment$1 ( state, component ) {
	var div, div_style_value;

	return {
		create: function () {
			div = createElement( 'div' );
			this.hydrate();
		},

		hydrate: function ( nodes ) {
			encapsulateStyles$1( div );
			div.className = "scrim";
			div.style.cssText = div_style_value = "\n    opacity: " + ( state.opacity ) + ";\n    background: " + ( state.background ) + ";\n  ";
		},

		mount: function ( target, anchor ) {
			insertNode( div, target, anchor );
		},

		update: function ( changed, state ) {
			if ( ( changed.opacity || changed.background ) && div_style_value !== ( div_style_value = "\n    opacity: " + ( state.opacity ) + ";\n    background: " + ( state.background ) + ";\n  " ) ) {
				div.style.cssText = div_style_value;
			}
		},

		unmount: function () {
			detachNode( div );
		},

		destroy: noop
	};
}

function Scrim ( options ) {
	this.options = options;
	this._state = assign( template$1.data(), options.data );

	this._observers = {
		pre: Object.create( null ),
		post: Object.create( null )
	};

	this._handlers = Object.create( null );

	this._root = options._root || this;
	this._yield = options._yield;
	this._bind = options._bind;

	if ( !document.getElementById( 'svelte-4157681185-style' ) ) add_css$1();

	this._fragment = create_main_fragment$1( this._state, this );

	if ( options.target ) {
		this._fragment.create();
		this._fragment.mount( options.target, options.anchor || null );
	}
}

assign( Scrim.prototype, proto );

template$1.setup( Scrim );

var template$1$1 = (function () {
// TODO: write a smaller, less "featured" focusTrap
const makeFocusTrap = ({ rootElement, initialFocusElement }) => {
  return focusTrap_1(rootElement, {
    initialFocus: initialFocusElement || rootElement,
    fallbackFocus: rootElement,
    escapeDeactivates: false,
    returnFocusOnDeactivate: true,
    clickOutsideDeactivates: false
  })
};

/* TODO: be fancy and take a touch/click/element position to transition in from */
/* TODO: maybe make a way to accept custom transition styles and easings */
const STYLE = {
  modal:   { open: { opacity: 1 }, hidden: { opacity: 0 } },
  content: { open: { scale: 1 },   hidden: { scale: 0.9 } }
};
const DEFAULTS = {
  initiallyHidden: false,
  initialFocusElement: false,
  center: false,
  zIndexBase: 1,
  transitionDuration: 225,
  pressScrimToDismiss: true,
  escapeToDismiss: true,
  trapFocus: true
  //backButtonToDismiss: true, // TODO: implement this
};
const FIRES = {
  opening: 'opening',
  opened: 'opened',

  result: 'result',
  dismissed: 'dismissed',
  closed: 'closed',

  hiding: 'hiding',
  hidden: 'hidden'
};
const ONS = {
  open: 'open',
  dismiss: 'dismiss',
  close: 'close'
};[ STYLE, DEFAULTS, FIRES, ONS ].forEach(Object.freeze);

return {
  setup (Modal) {
    Object.assign(Modal, { DEFAULTS, FIRES, ONS });
  },

  data () {
    return Object.assign({
      hidden: true,
      hiding: false,
      opening: false,
      modalStyle: STYLE.modal.hidden,
      contentStyle: STYLE.content.hidden
    }, DEFAULTS)
  },

  computed: {
    transitioning: (hiding, opening) => hiding || opening,
    open: (hidden, transitioning) => !hidden && !transitioning,
    initialFocusElementNeedsFocus: (initialFocusElement, opening) => initialFocusElement && opening
  },

  oncreate () {
    if (this.get('trapFocus')) {
      let focusTrap;
      this.on('opened', () => {
        focusTrap = makeFocusTrap({
          rootElement: this.refs.modal,
          initialFocusElement: this.get('initialFocusElement')
        });
        focusTrap.activate();
      });
      this.on(FIRES.hidden, () => focusTrap && focusTrap.deactivate());
    }

    this.observe('initialFocusElementNeedsFocus', needsFocus => {
      if (needsFocus) {
        this.focusInitialFocusElement();
      }
    });

    if (!this.get('initiallyHidden')) {
      this.open();
    }

    this.on(ONS.open, () => this.open());
    this.on(ONS.dismiss, e => this.dismiss(e));
    this.on(ONS.close, e => this.close(e));
  },

  methods: {
    tween,

    focusInitialFocusElement () {
      const initialFocusElement = this.get('initialFocusElement');
      initialFocusElement && initialFocusElement.focus();
    },

    onKeyup (event) {
      if (event.key.toLowerCase() === 'escape' && this.get('escapeToDismiss')) {
        this.dismiss();
      }
    },

    onScrimPress () {
      if (this.get('pressScrimToDismiss')) {
        this.dismiss();
      }
    },

    open () {
      if (this.get('open') || this.get('opening')) { return }

      this.set({ opening: true, hiding: false, hidden: false });
      this.fire(FIRES.opening);

      Promise.all([
        this.tween(
          'modalStyle',
          STYLE.modal.open,
          { duration: this.get('transitionDuration'), easing: cubicOut, adjustDuration: true }
        ),
        this.tween(
          'contentStyle',
          STYLE.content.open,
          { duration: this.get('transitionDuration'), easing: cubicOut, adjustDuration: true }
        )
      ])
        .then(() => {
          this.set({ opening: false });
          this.fire(FIRES.opened);
        });

      return this
    },

    hide (reason, result) {
      if (this.get('hidden') || this.get('hiding')) { return }

      this.set({ opening: false, hiding: true });

      this.fire(FIRES.result, result);
      this.fire(reason, result);
      this.fire(FIRES.hiding);

      Promise.all([
        this.tween(
          'modalStyle',
          STYLE.modal.hidden,
          { duration: this.get('transitionDuration'), easing: cubicOut, adjustDuration: true }
        ),
        this.tween(
          'contentStyle',
          STYLE.content.hidden,
          { duration: this.get('transitionDuration'), easing: cubicOut, adjustDuration: true }
        )
      ])
        .then(() => {
          this.set({ hiding: false, hidden: true });
          this.fire(FIRES.hidden);
        });

      return this
    },

    close (result) {
      return this.hide(FIRES.closed, result)
    },

    dismiss (result) {
      return this.hide(FIRES.dismissed, result)
    }
  }
}
}());

function encapsulateStyles$1$1 ( node ) {
	setAttribute( node, 'svelte-4112083598', '' );
}

function add_css$1$1 () {
	var style = createElement( 'style' );
	style.id = 'svelte-4112083598-style';
	style.textContent = ".svelte-modal[svelte-4112083598]{position:fixed;top:0;left:0;right:0;height:100%;display:flex;align-items:flex-start;justify-content:center}[data-center=\"true\"][svelte-4112083598]{align-items:center}[data-hidden=\"true\"][svelte-4112083598]{visibility:hidden}.content[svelte-4112083598]{max-width:100vw;max-height:100vh;overflow:visible;z-index:1}";
	appendNode( style, document.head );
}

function create_main_fragment$1$1 ( state, component ) {
	var text, div, div_style_value, div_1, div_1_style_value, slot_content_default = component._slotted.default, slot_content_default_before, slot_content_default_after, text_2, div_2, slot_content_scrim = component._slotted.scrim, slot_content_scrim_before, slot_content_scrim_after;

	function onwindowkeyup ( event ) {
		var state = component.get();
		component.onKeyup(event);
	}
	window.addEventListener( 'keyup', onwindowkeyup );

	function click_handler ( event ) {
		component.onScrimPress();
	}

	var scrim = new Scrim({
		_root: component._root
	});

	return {
		create: function () {
			text = createText( "\n" );
			div = createElement( 'div' );
			div_1 = createElement( 'div' );
			text_2 = createText( "\n\n  " );
			div_2 = createElement( 'div' );
			if (!slot_content_scrim) {
				scrim._fragment.create();
			}
			this.hydrate();
		},

		hydrate: function ( nodes ) {
			encapsulateStyles$1$1( div );
			div.className = "svelte-modal";
			div.tabIndex = "-1";
			setAttribute( div, 'data-center', state.center );
			setAttribute( div, 'data-hidden', state.hidden );
			div.style.cssText = div_style_value = "z-index: " + ( state.zIndexBase ) + "; opacity: " + ( state.modalStyle.opacity ) + ";";
			encapsulateStyles$1$1( div_1 );
			div_1.className = "content";
			div_1.style.cssText = div_1_style_value = "transform: scale(" + ( state.contentStyle.scale ) + ");";
			addListener( div_2, 'click', click_handler );
		},

		mount: function ( target, anchor ) {
			insertNode( text, target, anchor );
			insertNode( div, target, anchor );
			component.refs.modal = div;
			appendNode( div_1, div );
			component.refs.content = div_1;

			if (slot_content_default) {
				appendNode(slot_content_default_before || (slot_content_default_before = createComment()), div_1);
				appendNode(slot_content_default, div_1);
				appendNode(slot_content_default_after || (slot_content_default_after = createComment()), div_1);
			}

			appendNode( text_2, div );
			appendNode( div_2, div );
			if (!slot_content_scrim) {
				scrim._fragment.mount( div_2, null );
			}

			if (slot_content_scrim) {
				appendNode(slot_content_scrim_before || (slot_content_scrim_before = createComment()), div_2);
				appendNode(slot_content_scrim, div_2);
				appendNode(slot_content_scrim_after || (slot_content_scrim_after = createComment()), div_2);
			}
		},

		update: function ( changed, state ) {
			if ( changed.center ) {
				setAttribute( div, 'data-center', state.center );
			}

			if ( changed.hidden ) {
				setAttribute( div, 'data-hidden', state.hidden );
			}

			if ( ( changed.zIndexBase || changed.modalStyle ) && div_style_value !== ( div_style_value = "z-index: " + ( state.zIndexBase ) + "; opacity: " + ( state.modalStyle.opacity ) + ";" ) ) {
				div.style.cssText = div_style_value;
			}

			if ( ( changed.contentStyle ) && div_1_style_value !== ( div_1_style_value = "transform: scale(" + ( state.contentStyle.scale ) + ");" ) ) {
				div_1.style.cssText = div_1_style_value;
			}
		},

		unmount: function () {
			detachNode( text );
			detachNode( div );

			if (slot_content_default) {
				reinsertBetween(slot_content_default_before, slot_content_default_after, slot_content_default);
				detachNode(slot_content_default_before);
				detachNode(slot_content_default_after);
			}

			if (slot_content_scrim) {
				reinsertBetween(slot_content_scrim_before, slot_content_scrim_after, slot_content_scrim);
				detachNode(slot_content_scrim_before);
				detachNode(slot_content_scrim_after);
			}
		},

		destroy: function () {
			window.removeEventListener( 'keyup', onwindowkeyup );

			if ( component.refs.modal === div ) component.refs.modal = null;
			if ( component.refs.content === div_1 ) component.refs.content = null;
			removeListener( div_2, 'click', click_handler );
			if (!slot_content_scrim) {
				scrim.destroy( false );
			}
		}
	};
}

function Modal ( options ) {
	this.options = options;
	this.refs = {};
	this._state = assign( template$1$1.data(), options.data );
	this._recompute( {}, this._state, {}, true );

	this._observers = {
		pre: Object.create( null ),
		post: Object.create( null )
	};

	this._handlers = Object.create( null );

	this._root = options._root || this;
	this._yield = options._yield;
	this._bind = options._bind;
	this._slotted = options.slots || {};

	if ( !document.getElementById( 'svelte-4112083598-style' ) ) add_css$1$1();

	var oncreate = template$1$1.oncreate.bind( this );

	if ( !options._root ) {
		this._oncreate = [oncreate];
		this._beforecreate = [];
		this._aftercreate = [];
	} else {
	 	this._root._oncreate.push(oncreate);
	 }

	this.slots = {};

	this._fragment = create_main_fragment$1$1( this._state, this );

	if ( options.target ) {
		this._fragment.create();
		this._fragment.mount( options.target, options.anchor || null );
	}

	if ( !options._root ) {
		this._lock = true;
		callAll(this._beforecreate);
		callAll(this._oncreate);
		callAll(this._aftercreate);
		this._lock = false;
	}
}

assign( Modal.prototype, template$1$1.methods, proto );

Modal.prototype._recompute = function _recompute ( changed, state, oldState, isInitial ) {
	if ( isInitial || changed.hiding || changed.opening ) {
		if ( differs( ( state.transitioning = template$1$1.computed.transitioning( state.hiding, state.opening ) ), oldState.transitioning ) ) changed.transitioning = true;
	}

	if ( isInitial || changed.hidden || changed.transitioning ) {
		if ( differs( ( state.open = template$1$1.computed.open( state.hidden, state.transitioning ) ), oldState.open ) ) changed.open = true;
	}

	if ( isInitial || changed.initialFocusElement || changed.opening ) {
		if ( differs( ( state.initialFocusElementNeedsFocus = template$1$1.computed.initialFocusElementNeedsFocus( state.initialFocusElement, state.opening ) ), oldState.initialFocusElementNeedsFocus ) ) changed.initialFocusElementNeedsFocus = true;
	}
};

template$1$1.setup( Modal );

const toArray = v => Array.isArray(v) ? v : Object.keys(v);
const makeCancelAll = listeners =>
  () => listeners.forEach(listener => listener.cancel());

const forwardData = (from, to, keys) => {
  const listeners = toArray(keys)
    .map(key => from.observe(key, value => to.set({ [key]: value }), { init: true }));
  return { cancel: makeCancelAll(listeners) }
};

const forwardEvents = (from, to, eventNames) => {
  const listeners = toArray(eventNames)
    .map(eventName => from.on(eventName, event => to.fire(eventName, event)));
  return { cancel: makeCancelAll(listeners)  }
};

const addMethodsFrom = (from, to, methodNames) => {
  toArray(methodNames).forEach(
    methodName => to[methodName] = (...args) => from[methodName](...args)
  );
};

function noop$1() {}

function assign$1(target) {
	var k,
		source,
		i = 1,
		len = arguments.length;
	for (; i < len; i++) {
		source = arguments[i];
		for (k in source) target[k] = source[k];
	}

	return target;
}

function appendNode$1(node, target) {
	target.appendChild(node);
}

function detachNode$1(node) {
	node.parentNode.removeChild(node);
}

function reinsertBetween$1(before, after, target) {
	while (before.nextSibling && before.nextSibling !== after) {
		target.appendChild(before.parentNode.removeChild(before.nextSibling));
	}
}

function createFragment() {
	return document.createDocumentFragment();
}

function createElement$1(name) {
	return document.createElement(name);
}

function createText$1(data) {
	return document.createTextNode(data);
}

function createComment$1() {
	return document.createComment('');
}

function addListener$1(node, event, handler) {
	node.addEventListener(event, handler, false);
}

function removeListener$1(node, event, handler) {
	node.removeEventListener(event, handler, false);
}

function setAttribute$1(node, attribute, value) {
	node.setAttribute(attribute, value);
}

function destroy$1(detach) {
	this.destroy = this.set = this.get = noop$1;
	this.fire('destroy');

	if (detach !== false) this._fragment.unmount();
	this._fragment.destroy();
	this._fragment = this._state = null;
}

function differs$1(a, b) {
	return a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}

function dispatchObservers$1(component, group, changed, newState, oldState) {
	for (var key in group) {
		if (!changed[key]) continue;

		var newValue = newState[key];
		var oldValue = oldState[key];

		var callbacks = group[key];
		if (!callbacks) continue;

		for (var i = 0; i < callbacks.length; i += 1) {
			var callback = callbacks[i];
			if (callback.__calling) continue;

			callback.__calling = true;
			callback.call(component, newValue, oldValue);
			callback.__calling = false;
		}
	}
}

function get$1(key) {
	return key ? this._state[key] : this._state;
}

function fire$1(eventName, data) {
	var handlers =
		eventName in this._handlers && this._handlers[eventName].slice();
	if (!handlers) return;

	for (var i = 0; i < handlers.length; i += 1) {
		handlers[i].call(this, data);
	}
}

function observe$1(key, callback, options) {
	var group = options && options.defer
		? this._observers.post
		: this._observers.pre;

	(group[key] || (group[key] = [])).push(callback);

	if (!options || options.init !== false) {
		callback.__calling = true;
		callback.call(this, this._state[key]);
		callback.__calling = false;
	}

	return {
		cancel: function() {
			var index = group[key].indexOf(callback);
			if (~index) group[key].splice(index, 1);
		}
	};
}

function on$1(eventName, handler) {
	if (eventName === 'teardown') return this.on('destroy', handler);

	var handlers = this._handlers[eventName] || (this._handlers[eventName] = []);
	handlers.push(handler);

	return {
		cancel: function() {
			var index = handlers.indexOf(handler);
			if (~index) handlers.splice(index, 1);
		}
	};
}

function set$1(newState) {
	this._set(assign$1({}, newState));
	if (this._root._lock) return;
	this._root._lock = true;
	callAll$1(this._root._beforecreate);
	callAll$1(this._root._oncreate);
	callAll$1(this._root._aftercreate);
	this._root._lock = false;
}

function _set$1(newState) {
	var oldState = this._state,
		changed = {},
		dirty = false;

	for (var key in newState) {
		if (differs$1(newState[key], oldState[key])) changed[key] = dirty = true;
	}
	if (!dirty) return;

	this._state = assign$1({}, oldState, newState);
	this._recompute(changed, this._state, oldState, false);
	if (this._bind) this._bind(changed, this._state);
	dispatchObservers$1(this, this._observers.pre, changed, this._state, oldState);
	this._fragment.update(changed, this._state);
	dispatchObservers$1(this, this._observers.post, changed, this._state, oldState);
}

function callAll$1(fns) {
	while (fns && fns.length) fns.pop()();
}

var proto$1 = {
	destroy: destroy$1,
	get: get$1,
	fire: fire$1,
	observe: observe$1,
	on: on$1,
	set: set$1,
	teardown: destroy$1,
	_recompute: noop$1,
	_set: _set$1
};

var template = (function () {
let id = -1;

const DEFAULTS = Object.assign({}, Modal.DEFAULTS, {
  center: true,
  heading: `${location.host} says...`,
  description: 'Press "OK" to continue.',
  okText: 'OK',
  ids: {
    heading: `svelte-dialog-heading-${id}`,
    description: `svelte-dialog-description-${id}`
  }
});
const FIRES = Object.assign({}, Modal.FIRES, {
  dismiss: 'dismiss',
  close: 'close'
});
const ONS = Modal.ONS;[ DEFAULTS, FIRES ].forEach(Object.freeze);

return {
  setup (Dialog) {
    Object.assign(Dialog, { DEFAULTS, FIRES, ONS });
  },

  data () {
    ++id;

    return Object.assign({}, DEFAULTS)
  },

  oncreate () {
    forwardData(this, this.refs.modal, Modal.DEFAULTS);
    forwardEvents(this.refs.modal, this, Modal.FIRES);
    addMethodsFrom(this.refs.modal, this, [ 'open', 'dismiss', 'close' ]);
  }
}
}());

function encapsulateStyles ( node ) {
	setAttribute$1( node, 'svelte-3997845366', '' );
}

function add_css () {
	var style = createElement$1( 'style' );
	style.id = 'svelte-3997845366-style';
	style.textContent = ".svelte-dialog[svelte-3997845366]{max-width:calc(100vw - 20px);background-color:white;box-shadow:0 7px 8px -4px rgba(0,0,0,.2), 0 13px 19px 2px rgba(0,0,0,.14), 0 5px 24px 4px rgba(0,0,0,.12);border-radius:4px;color:rgba(0,0,0,0.87)}.svelte-dialog[svelte-3997845366]:focus{outline:0}.dialog-container[svelte-3997845366]{min-width:275px;max-width:440px}@media(min-width: 768px){.dialog-container[svelte-3997845366]{min-width:360px;max-width:600px}}.dialog-main[svelte-3997845366]{padding:24px}.dialog-heading[svelte-3997845366]{font-size:20px;font-weight:500;margin:0 0 10px 0}.dialog-description[svelte-3997845366]{margin:12px 0 24px 0;font-size:16px;line-height:1.6}.dialog-actions[svelte-3997845366]{display:flex;justify-content:flex-end;margin:0 24px 0 48px}.dialog-action{font:inherit;font-size:14px;font-weight:500;color:rgb(16,108,200);text-transform:uppercase;border:0;background:none;padding:10px;margin:8px 0 8px 8px;box-sizing:border-box;min-width:93px;cursor:pointer;transition:background-color 400ms cubic-bezier(.25, .8, .25, 1)}.dialog-action:focus{outline:none}.dialog-action:focus,.dialog-action.emphasized{background-color:rgba(158,158,158,0.2)}";
	appendNode$1( style, document.head );
}

function create_main_fragment ( state, component ) {
	var div, div_aria_labelledby_value, div_aria_describedby_value, div_1, section, h1, h1_id_value, text, text_1, p, p_id_value, text_2_value = state.description || '', text_2, text_4, div_2, slot_content_actions = component._slotted.actions, slot_content_actions_before, slot_content_actions_after;

	var modal = new Modal({
		_root: component._root,
		slots: { default: createFragment() }
	});

	component.refs.modal = modal;

	return {
		create: function () {
			div = createElement$1( 'div' );
			div_1 = createElement$1( 'div' );
			section = createElement$1( 'section' );
			h1 = createElement$1( 'h1' );
			text = createText$1( state.heading );
			text_1 = createText$1( "\n\n        " );
			p = createElement$1( 'p' );
			text_2 = createText$1( text_2_value );
			text_4 = createText$1( "\n\n      " );
			div_2 = createElement$1( 'div' );
			modal._fragment.create();
			this.hydrate();
		},

		hydrate: function ( nodes ) {
			encapsulateStyles( div );
			div.className = "svelte-dialog";
			setAttribute$1( div, 'role', "alertdialog" );
			setAttribute$1( div, 'aria-labelledby', div_aria_labelledby_value = state.ids.heading );
			setAttribute$1( div, 'aria-describedby', div_aria_describedby_value = state.ids.description );
			encapsulateStyles( div_1 );
			div_1.className = "dialog-container";
			encapsulateStyles( section );
			section.className = "dialog-main";
			encapsulateStyles( h1 );
			h1.id = h1_id_value = state.ids.heading;
			h1.className = "dialog-heading";
			encapsulateStyles( p );
			p.id = p_id_value = state.ids.description;
			p.className = "dialog-description";
			encapsulateStyles( div_2 );
			div_2.className = "dialog-actions";
		},

		mount: function ( target, anchor ) {
			appendNode$1( div, modal._slotted.default );
			component.refs.dialog = div;
			appendNode$1( div_1, div );
			appendNode$1( section, div_1 );
			appendNode$1( h1, section );
			appendNode$1( text, h1 );
			appendNode$1( text_1, section );
			appendNode$1( p, section );
			appendNode$1( text_2, p );
			appendNode$1( text_4, div_1 );
			appendNode$1( div_2, div_1 );

			if (slot_content_actions) {
				appendNode$1(slot_content_actions_before || (slot_content_actions_before = createComment$1()), div_2);
				appendNode$1(slot_content_actions, div_2);
				appendNode$1(slot_content_actions_after || (slot_content_actions_after = createComment$1()), div_2);
			}

			modal._fragment.mount( target, anchor );
		},

		update: function ( changed, state ) {
			if ( ( changed.ids ) && div_aria_labelledby_value !== ( div_aria_labelledby_value = state.ids.heading ) ) {
				setAttribute$1( div, 'aria-labelledby', div_aria_labelledby_value );
			}

			if ( ( changed.ids ) && div_aria_describedby_value !== ( div_aria_describedby_value = state.ids.description ) ) {
				setAttribute$1( div, 'aria-describedby', div_aria_describedby_value );
			}

			if ( ( changed.ids ) && h1_id_value !== ( h1_id_value = state.ids.heading ) ) {
				h1.id = h1_id_value;
			}

			if ( changed.heading ) {
				text.data = state.heading;
			}

			if ( ( changed.ids ) && p_id_value !== ( p_id_value = state.ids.description ) ) {
				p.id = p_id_value;
			}

			if ( ( changed.description ) && text_2_value !== ( text_2_value = state.description || '' ) ) {
				text_2.data = text_2_value;
			}
		},

		unmount: function () {
			if (slot_content_actions) {
				reinsertBetween$1(slot_content_actions_before, slot_content_actions_after, slot_content_actions);
				detachNode$1(slot_content_actions_before);
				detachNode$1(slot_content_actions_after);
			}

			modal._fragment.unmount();
		},

		destroy: function () {
			if ( component.refs.dialog === div ) component.refs.dialog = null;
			modal.destroy( false );
			if ( component.refs.modal === modal ) component.refs.modal = null;
		}
	};
}

function Dialog$1 ( options ) {
	this.options = options;
	this.refs = {};
	this._state = assign$1( template.data(), options.data );

	this._observers = {
		pre: Object.create( null ),
		post: Object.create( null )
	};

	this._handlers = Object.create( null );

	this._root = options._root || this;
	this._yield = options._yield;
	this._bind = options._bind;
	this._slotted = options.slots || {};

	if ( !document.getElementById( 'svelte-3997845366-style' ) ) add_css();

	var oncreate = template.oncreate.bind( this );

	if ( !options._root ) {
		this._oncreate = [oncreate];
		this._beforecreate = [];
		this._aftercreate = [];
	} else {
	 	this._root._oncreate.push(oncreate);
	 }

	this.slots = {};

	this._fragment = create_main_fragment( this._state, this );

	if ( options.target ) {
		this._fragment.create();
		this._fragment.mount( options.target, options.anchor || null );
	}

	if ( !options._root ) {
		this._lock = true;
		callAll$1(this._beforecreate);
		callAll$1(this._oncreate);
		callAll$1(this._aftercreate);
		this._lock = false;
	}
}

assign$1( Dialog$1.prototype, proto$1 );

template.setup( Dialog$1 );

var template$2 = (function () {
const DEFAULTS = Object.assign({}, Dialog$1.DEFAULTS, {
  initialFocus: false
});
const FIRES = Dialog$1.FIRES;
Object.freeze(DEFAULTS);

return {
  setup (Alert) {
    Object.assign(Alert, { DEFAULTS, FIRES });
  },

  data () {
    return Object.assign({}, DEFAULTS)
  },

  oncreate () {
    forwardData(this, this.refs.dialog, Dialog$1.DEFAULTS);
    forwardEvents(this.refs.dialog, this, Dialog$1.FIRES);

    this.set({ initialFocusElement: this.get('initialFocus') ? this.refs.ok : false });
  },

  methods: {
    open () {
      this.refs.dialog.open();
    },
    close () {
      this.refs.dialog.close();
    }
  }
}
}());

function create_main_fragment$2 ( state, component ) {
	var div, button, text;

	function click_handler ( event ) {
		component.close();
	}

	function mouseenter_handler ( event ) {
		this.focus();
	}

	function mouseleave_handler ( event ) {
		this.blur();
	}

	var dialog = new Dialog$1({
		_root: component._root,
		slots: { default: createFragment(), actions: createFragment() }
	});

	component.refs.dialog = dialog;

	return {
		create: function () {
			div = createElement$1( 'div' );
			button = createElement$1( 'button' );
			text = createText$1( state.okText );
			dialog._fragment.create();
			this.hydrate();
		},

		hydrate: function ( nodes ) {
			setAttribute$1( div, 'slot', "actions" );
			button.className = "dialog-action ok";
			addListener$1( button, 'click', click_handler );
			addListener$1( button, 'mouseenter', mouseenter_handler );
			addListener$1( button, 'mouseleave', mouseleave_handler );
		},

		mount: function ( target, anchor ) {
			appendNode$1( div, dialog._slotted.actions );
			appendNode$1( button, div );
			component.refs.ok = button;
			appendNode$1( text, button );
			dialog._fragment.mount( target, anchor );
		},

		update: function ( changed, state ) {
			if ( changed.okText ) {
				text.data = state.okText;
			}
		},

		unmount: function () {
			dialog._fragment.unmount();
		},

		destroy: function () {
			removeListener$1( button, 'click', click_handler );
			removeListener$1( button, 'mouseenter', mouseenter_handler );
			removeListener$1( button, 'mouseleave', mouseleave_handler );
			if ( component.refs.ok === button ) component.refs.ok = null;
			dialog.destroy( false );
			if ( component.refs.dialog === dialog ) component.refs.dialog = null;
		}
	};
}

function Alert ( options ) {
	this.options = options;
	this.refs = {};
	this._state = assign$1( template$2.data(), options.data );

	this._observers = {
		pre: Object.create( null ),
		post: Object.create( null )
	};

	this._handlers = Object.create( null );

	this._root = options._root || this;
	this._yield = options._yield;
	this._bind = options._bind;

	var oncreate = template$2.oncreate.bind( this );

	if ( !options._root ) {
		this._oncreate = [oncreate];
		this._beforecreate = [];
		this._aftercreate = [];
	} else {
	 	this._root._oncreate.push(oncreate);
	 }

	this._fragment = create_main_fragment$2( this._state, this );

	if ( options.target ) {
		this._fragment.create();
		this._fragment.mount( options.target, options.anchor || null );
	}

	if ( !options._root ) {
		this._lock = true;
		callAll$1(this._beforecreate);
		callAll$1(this._oncreate);
		callAll$1(this._aftercreate);
		this._lock = false;
	}
}

assign$1( Alert.prototype, template$2.methods, proto$1 );

template$2.setup( Alert );

var template$3 = (function () {
const DEFAULTS = Object.assign({}, Dialog$1.DEFAULTS, {
  heading: 'Are you sure?',
  description: 'Confirm if you wish to proceed.',
  denyText: 'Cancel',
  confirmText: 'Confirm',
  defaultAction: false
});
const ACTIONS = { confirm: 'confirm', deny: 'deny' };
[ DEFAULTS, ACTIONS ].forEach(Object.freeze);

return {
  setup (Confirm) {
    Object.assign(Confirm, { DEFAULTS, ACTIONS });
  },

  data () {
    return Object.assign({}, DEFAULTS)
  },

  oncreate () {
    forwardData(this, this.refs.dialog, Dialog$1.DEFAULTS);
    forwardEvents(this.refs.dialog, this, Dialog$1.FIRES);

    this.set({ initialFocusElement: this.refs[this.get('defaultAction')] });
  },

  methods: {
    open () {
      this.refs.dialog.open();
    },
    deny () {
      this.refs.dialog.dismiss({ confirmed: false });
    },
    confirm () {
      this.refs.dialog.close({ confirmed: true });
    }
  }
}
}());

function create_main_fragment$3 ( state, component ) {
	var div, button, text, text_1, button_1, text_2;

	function click_handler ( event ) {
		component.deny();
	}

	function mouseenter_handler ( event ) {
		this.focus();
	}

	function mouseleave_handler ( event ) {
		this.blur();
	}

	function click_handler_1 ( event ) {
		component.confirm();
	}

	function mouseenter_handler_1 ( event ) {
		this.focus();
	}

	function mouseleave_handler_1 ( event ) {
		this.blur();
	}

	var dialog = new Dialog$1({
		_root: component._root,
		slots: { default: createFragment(), actions: createFragment() }
	});

	component.refs.dialog = dialog;

	return {
		create: function () {
			div = createElement$1( 'div' );
			button = createElement$1( 'button' );
			text = createText$1( state.denyText );
			text_1 = createText$1( "\n    " );
			button_1 = createElement$1( 'button' );
			text_2 = createText$1( state.confirmText );
			dialog._fragment.create();
			this.hydrate();
		},

		hydrate: function ( nodes ) {
			setAttribute$1( div, 'slot', "actions" );
			button.className = "dialog-action deny";
			addListener$1( button, 'click', click_handler );
			addListener$1( button, 'mouseenter', mouseenter_handler );
			addListener$1( button, 'mouseleave', mouseleave_handler );
			button_1.className = "dialog-action confirm";
			addListener$1( button_1, 'click', click_handler_1 );
			addListener$1( button_1, 'mouseenter', mouseenter_handler_1 );
			addListener$1( button_1, 'mouseleave', mouseleave_handler_1 );
		},

		mount: function ( target, anchor ) {
			appendNode$1( div, dialog._slotted.actions );
			appendNode$1( button, div );
			component.refs.deny = button;
			appendNode$1( text, button );
			appendNode$1( text_1, div );
			appendNode$1( button_1, div );
			component.refs.confirm = button_1;
			appendNode$1( text_2, button_1 );
			dialog._fragment.mount( target, anchor );
		},

		update: function ( changed, state ) {
			if ( changed.denyText ) {
				text.data = state.denyText;
			}

			if ( changed.confirmText ) {
				text_2.data = state.confirmText;
			}
		},

		unmount: function () {
			dialog._fragment.unmount();
		},

		destroy: function () {
			removeListener$1( button, 'click', click_handler );
			removeListener$1( button, 'mouseenter', mouseenter_handler );
			removeListener$1( button, 'mouseleave', mouseleave_handler );
			if ( component.refs.deny === button ) component.refs.deny = null;
			removeListener$1( button_1, 'click', click_handler_1 );
			removeListener$1( button_1, 'mouseenter', mouseenter_handler_1 );
			removeListener$1( button_1, 'mouseleave', mouseleave_handler_1 );
			if ( component.refs.confirm === button_1 ) component.refs.confirm = null;
			dialog.destroy( false );
			if ( component.refs.dialog === dialog ) component.refs.dialog = null;
		}
	};
}

function Confirm ( options ) {
	this.options = options;
	this.refs = {};
	this._state = assign$1( template$3.data(), options.data );

	this._observers = {
		pre: Object.create( null ),
		post: Object.create( null )
	};

	this._handlers = Object.create( null );

	this._root = options._root || this;
	this._yield = options._yield;
	this._bind = options._bind;

	var oncreate = template$3.oncreate.bind( this );

	if ( !options._root ) {
		this._oncreate = [oncreate];
		this._beforecreate = [];
		this._aftercreate = [];
	} else {
	 	this._root._oncreate.push(oncreate);
	 }

	this._fragment = create_main_fragment$3( this._state, this );

	if ( options.target ) {
		this._fragment.create();
		this._fragment.mount( options.target, options.anchor || null );
	}

	if ( !options._root ) {
		this._lock = true;
		callAll$1(this._beforecreate);
		callAll$1(this._oncreate);
		callAll$1(this._aftercreate);
		this._lock = false;
	}
}

assign$1( Confirm.prototype, template$3.methods, proto$1 );

template$3.setup( Confirm );

const unComponent = (DialogComponent) => {
  function dialog (options) {
    const dialogComponent = new DialogComponent({ data: options, target: document.body });
    dialogComponent.on('hidden', () => dialogComponent.destroy());
    return dialogComponent
  }
  return dialog
};

const alert = unComponent(Alert);
const confirm = unComponent(Confirm);

exports['default'] = Dialog$1;
exports.Alert = Alert;
exports.alert = alert;
exports.Confirm = Confirm;
exports.confirm = confirm;
