(function () {
'use strict';

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

function createFragment() {
	return document.createDocumentFragment();
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

var template$3 = (function () {
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

function encapsulateStyles$2 ( node ) {
	setAttribute( node, 'svelte-4157681185', '' );
}

function add_css$2 () {
	var style = createElement( 'style' );
	style.id = 'svelte-4157681185-style';
	style.textContent = ".scrim[svelte-4157681185]{position:fixed;top:0;right:0;left:0;height:100vh;-webkit-tap-highlight-color:rgba(0, 0, 0, 0)}";
	appendNode( style, document.head );
}

function create_main_fragment$3 ( state, component ) {
	var div, div_style_value;

	return {
		create: function () {
			div = createElement( 'div' );
			this.hydrate();
		},

		hydrate: function ( nodes ) {
			encapsulateStyles$2( div );
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
	this._state = assign( template$3.data(), options.data );

	this._observers = {
		pre: Object.create( null ),
		post: Object.create( null )
	};

	this._handlers = Object.create( null );

	this._root = options._root || this;
	this._yield = options._yield;
	this._bind = options._bind;

	if ( !document.getElementById( 'svelte-4157681185-style' ) ) add_css$2();

	this._fragment = create_main_fragment$3( this._state, this );

	if ( options.target ) {
		this._fragment.create();
		this._fragment.mount( options.target, options.anchor || null );
	}
}

assign( Scrim.prototype, proto );

template$3.setup( Scrim );

var template$2 = (function () {
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
const STATES = {
  open: 'open',
  hidden: 'hidden'
};
const DEFAULTS = {
  initialState: STATES.open,
  initialFocusElement: false,
  center: false,
  zIndexBase: 1,
  transitionDuration: 225,
  pressScrimToDismiss: true,
  escapeToDismiss: true,
  trapFocus: true
  //backButtonToDismiss: true, // TODO: implement this
};
const EVENTS = {
  opening: 'opening',
  opened: 'opened',

  result: 'result',
  dismissed: 'dismissed',
  closed: 'closed',

  hiding: 'hiding',
  hidden: 'hidden'
};
Object.freeze(DEFAULTS);
Object.freeze(STATES);
Object.freeze(EVENTS);
Object.freeze(STYLE);

return {
  setup (Modal) {
    Object.assign(Modal, { DEFAULTS, STATES, EVENTS });
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
      this.on(EVENTS.hidden, () => focusTrap && focusTrap.deactivate());
    }

    /* This is so focus style can be applied to the default action element while
         it is transitioning in.
       it won't get its :focus style applied if it is focused before transition is done
    */
    this.observe('initialFocusElementNeedsFocus', needsFocus => {
      if (needsFocus) {
        this.focusInitialFocusElement();
      }
    });

    if (this.get('initialState') === STATES.open) {
      this.open();
    }
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
      this.fire(EVENTS.opening);

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
          this.fire(EVENTS.opened);
        });

      return this
    },

    hide (reason, result) {
      if (this.get('hidden') || this.get('hiding')) { return }

      this.set({ opening: false, hiding: true });

      this.fire(EVENTS.result, result);
      this.fire(reason, result);
      this.fire(EVENTS.hiding);

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
          this.fire(EVENTS.hidden);
        });

      return this
    },

    close (result) {
      return this.hide(EVENTS.closed, result)
    },

    dismiss (result) {
      return this.hide(EVENTS.dismissed, result)
    }
  }
}
}());

function encapsulateStyles$1 ( node ) {
	setAttribute( node, 'svelte-2894883851', '' );
}

function add_css$1 () {
	var style = createElement( 'style' );
	style.id = 'svelte-2894883851-style';
	style.textContent = ".svelte-modal[svelte-2894883851]{position:fixed;top:0;left:0;right:0;height:100%;display:flex;align-items:flex-start;justify-content:center}[data-center=\"true\"][svelte-2894883851]{align-items:center}[data-hidden=\"true\"][svelte-2894883851]{visibility:hidden}.content[svelte-2894883851]{max-width:100vw;max-height:100vh;overflow:visible;z-index:1}";
	appendNode( style, document.head );
}

function create_main_fragment$2 ( state, component ) {
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
			encapsulateStyles$1( div );
			div.className = "svelte-modal";
			div.tabIndex = "-1";
			setAttribute( div, 'data-center', state.center );
			setAttribute( div, 'data-hidden', state.hidden );
			div.style.cssText = div_style_value = "z-index: " + ( state.zIndexBase ) + "; opacity: " + ( state.modalStyle.opacity ) + ";";
			encapsulateStyles$1( div_1 );
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
	this._state = assign( template$2.data(), options.data );
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

	if ( !document.getElementById( 'svelte-2894883851-style' ) ) add_css$1();

	var oncreate = template$2.oncreate.bind( this );

	if ( !options._root ) {
		this._oncreate = [oncreate];
		this._beforecreate = [];
		this._aftercreate = [];
	} else {
	 	this._root._oncreate.push(oncreate);
	 }

	this.slots = {};

	this._fragment = create_main_fragment$2( this._state, this );

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

assign( Modal.prototype, template$2.methods, proto );

Modal.prototype._recompute = function _recompute ( changed, state, oldState, isInitial ) {
	if ( isInitial || changed.hiding || changed.opening ) {
		if ( differs( ( state.transitioning = template$2.computed.transitioning( state.hiding, state.opening ) ), oldState.transitioning ) ) changed.transitioning = true;
	}

	if ( isInitial || changed.hidden || changed.transitioning ) {
		if ( differs( ( state.open = template$2.computed.open( state.hidden, state.transitioning ) ), oldState.open ) ) changed.open = true;
	}

	if ( isInitial || changed.initialFocusElement || changed.opening ) {
		if ( differs( ( state.initialFocusElementNeedsFocus = template$2.computed.initialFocusElementNeedsFocus( state.initialFocusElement, state.opening ) ), oldState.initialFocusElementNeedsFocus ) ) changed.initialFocusElementNeedsFocus = true;
	}
};

template$2.setup( Modal );

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

var template$1 = (function () {
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
const EVENTS = Modal.EVENTS;

return {
  setup (Dialog) {
    Object.assign(Dialog, { DEFAULTS, EVENTS });
  },

  data () {
    ++id;

    return Object.assign({}, DEFAULTS)
  },

  oncreate () {
    forwardData(this, this.refs.modal, Modal.DEFAULTS);
    forwardEvents(this.refs.modal, this, Modal.EVENTS);
  }
}
}());

function encapsulateStyles ( node ) {
	setAttribute( node, 'svelte-1943038861', '' );
}

function add_css () {
	var style = createElement( 'style' );
	style.id = 'svelte-1943038861-style';
	style.textContent = ".svelte-dialog[svelte-1943038861]{max-width:calc(100vw - 20px);background-color:white;box-shadow:0 7px 8px -4px rgba(0,0,0,.2), 0 13px 19px 2px rgba(0,0,0,.14), 0 5px 24px 4px rgba(0,0,0,.12);border-radius:4px;color:rgba(0,0,0,0.87)}.svelte-dialog[svelte-1943038861]:focus{outline:0}.dialog-container[svelte-1943038861]{min-width:275px;max-width:440px}@media(min-width: 768px){.dialog-container[svelte-1943038861]{min-width:360px;max-width:600px}}.dialog-main[svelte-1943038861]{padding:24px}.dialog-heading[svelte-1943038861]{font-size:20px;font-weight:500;margin:0 0 10px 0}.dialog-description[svelte-1943038861]{margin:12px 0 24px 0;font-size:16px;line-height:1.6}.dialog-actions[svelte-1943038861]{display:flex;justify-content:flex-end;margin:0 24px 0 48px}.dialog-action{font:inherit;font-size:14px;font-weight:500;color:rgb(16,108,200);text-transform:uppercase;border:0;background:none;padding:10px;margin:8px 0 8px 8px;box-sizing:border-box;min-width:93px;cursor:pointer;transition:background-color 400ms cubic-bezier(.25, .8, .25, 1)}.dialog-action:focus{outline:none}.dialog-action:focus,.dialog-action.emphasized{background-color:rgba(158,158,158,0.2)}";
	appendNode( style, document.head );
}

function create_main_fragment$1 ( state, component ) {
	var div, div_aria_labelledby_value, div_aria_describedby_value, div_1, section, h1, h1_id_value, text, text_1, p, p_id_value, text_2_value = state.description || '', text_2, text_4, div_2, slot_content_actions = component._slotted.actions, slot_content_actions_before, slot_content_actions_after;

	var modal = new Modal({
		_root: component._root,
		slots: { default: createFragment() }
	});

	component.refs.modal = modal;

	return {
		create: function () {
			div = createElement( 'div' );
			div_1 = createElement( 'div' );
			section = createElement( 'section' );
			h1 = createElement( 'h1' );
			text = createText( state.heading );
			text_1 = createText( "\n\n        " );
			p = createElement( 'p' );
			text_2 = createText( text_2_value );
			text_4 = createText( "\n\n      " );
			div_2 = createElement( 'div' );
			modal._fragment.create();
			this.hydrate();
		},

		hydrate: function ( nodes ) {
			encapsulateStyles( div );
			div.className = "svelte-dialog";
			setAttribute( div, 'role', "alertdialog" );
			setAttribute( div, 'aria-labelledby', div_aria_labelledby_value = state.ids.heading );
			setAttribute( div, 'aria-describedby', div_aria_describedby_value = state.ids.description );
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
			appendNode( div, modal._slotted.default );
			component.refs.dialog = div;
			appendNode( div_1, div );
			appendNode( section, div_1 );
			appendNode( h1, section );
			appendNode( text, h1 );
			appendNode( text_1, section );
			appendNode( p, section );
			appendNode( text_2, p );
			appendNode( text_4, div_1 );
			appendNode( div_2, div_1 );

			if (slot_content_actions) {
				appendNode(slot_content_actions_before || (slot_content_actions_before = createComment()), div_2);
				appendNode(slot_content_actions, div_2);
				appendNode(slot_content_actions_after || (slot_content_actions_after = createComment()), div_2);
			}

			modal._fragment.mount( target, anchor );
		},

		update: function ( changed, state ) {
			if ( ( changed.ids ) && div_aria_labelledby_value !== ( div_aria_labelledby_value = state.ids.heading ) ) {
				setAttribute( div, 'aria-labelledby', div_aria_labelledby_value );
			}

			if ( ( changed.ids ) && div_aria_describedby_value !== ( div_aria_describedby_value = state.ids.description ) ) {
				setAttribute( div, 'aria-describedby', div_aria_describedby_value );
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
				reinsertBetween(slot_content_actions_before, slot_content_actions_after, slot_content_actions);
				detachNode(slot_content_actions_before);
				detachNode(slot_content_actions_after);
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

function Dialog ( options ) {
	this.options = options;
	this.refs = {};
	this._state = assign( template$1.data(), options.data );

	this._observers = {
		pre: Object.create( null ),
		post: Object.create( null )
	};

	this._handlers = Object.create( null );

	this._root = options._root || this;
	this._yield = options._yield;
	this._bind = options._bind;
	this._slotted = options.slots || {};

	if ( !document.getElementById( 'svelte-1943038861-style' ) ) add_css();

	var oncreate = template$1.oncreate.bind( this );

	if ( !options._root ) {
		this._oncreate = [oncreate];
		this._beforecreate = [];
		this._aftercreate = [];
	} else {
	 	this._root._oncreate.push(oncreate);
	 }

	this.slots = {};

	this._fragment = create_main_fragment$1( this._state, this );

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

assign( Dialog.prototype, proto );

template$1.setup( Dialog );

var template$4 = (function () {
const DEFAULTS = Object.assign({}, Dialog.DEFAULTS, {
  heading: 'Are you sure?',
  description: 'Confirm if you wish to proceed.',
  denyText: 'Cancel',
  confirmText: 'Confirm',
  defaultAction: false
});
const ACTIONS = { confirm: 'confirm', deny: 'deny' };
Object.freeze(DEFAULTS);
Object.freeze(ACTIONS);

return {
  setup (Confirm) {
    Object.assign(Confirm, { DEFAULTS, ACTIONS });
  },

  data () {
    return Object.assign({}, DEFAULTS)
  },

  oncreate () {
    forwardData(this, this.refs.dialog, Dialog.DEFAULTS);
    forwardEvents(this.refs.dialog, this, Dialog.EVENTS);

    this.set({ initialFocusElement: this.refs[this.get('defaultAction')] });
  }
}
}());

function create_main_fragment$4 ( state, component ) {
	var div, button, text, text_1, button_1, text_2;

	function click_handler ( event ) {
		component.refs.dialog.refs.modal.dismiss({ confirmed: false });
	}

	function mouseenter_handler ( event ) {
		this.focus();
	}

	function mouseleave_handler ( event ) {
		this.blur();
	}

	function click_handler_1 ( event ) {
		component.refs.dialog.refs.modal.close({ confirmed: true });
	}

	function mouseenter_handler_1 ( event ) {
		this.focus();
	}

	function mouseleave_handler_1 ( event ) {
		this.blur();
	}

	var dialog = new Dialog({
		_root: component._root,
		slots: { default: createFragment(), actions: createFragment() }
	});

	component.refs.dialog = dialog;

	return {
		create: function () {
			div = createElement( 'div' );
			button = createElement( 'button' );
			text = createText( state.denyText );
			text_1 = createText( "\n    " );
			button_1 = createElement( 'button' );
			text_2 = createText( state.confirmText );
			dialog._fragment.create();
			this.hydrate();
		},

		hydrate: function ( nodes ) {
			setAttribute( div, 'slot', "actions" );
			button.className = "dialog-action deny";
			addListener( button, 'click', click_handler );
			addListener( button, 'mouseenter', mouseenter_handler );
			addListener( button, 'mouseleave', mouseleave_handler );
			button_1.className = "dialog-action confirm";
			addListener( button_1, 'click', click_handler_1 );
			addListener( button_1, 'mouseenter', mouseenter_handler_1 );
			addListener( button_1, 'mouseleave', mouseleave_handler_1 );
		},

		mount: function ( target, anchor ) {
			appendNode( div, dialog._slotted.actions );
			appendNode( button, div );
			component.refs.deny = button;
			appendNode( text, button );
			appendNode( text_1, div );
			appendNode( button_1, div );
			component.refs.confirm = button_1;
			appendNode( text_2, button_1 );
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
			removeListener( button, 'click', click_handler );
			removeListener( button, 'mouseenter', mouseenter_handler );
			removeListener( button, 'mouseleave', mouseleave_handler );
			if ( component.refs.deny === button ) component.refs.deny = null;
			removeListener( button_1, 'click', click_handler_1 );
			removeListener( button_1, 'mouseenter', mouseenter_handler_1 );
			removeListener( button_1, 'mouseleave', mouseleave_handler_1 );
			if ( component.refs.confirm === button_1 ) component.refs.confirm = null;
			dialog.destroy( false );
			if ( component.refs.dialog === dialog ) component.refs.dialog = null;
		}
	};
}

function Confirm ( options ) {
	this.options = options;
	this.refs = {};
	this._state = assign( template$4.data(), options.data );

	this._observers = {
		pre: Object.create( null ),
		post: Object.create( null )
	};

	this._handlers = Object.create( null );

	this._root = options._root || this;
	this._yield = options._yield;
	this._bind = options._bind;

	var oncreate = template$4.oncreate.bind( this );

	if ( !options._root ) {
		this._oncreate = [oncreate];
		this._beforecreate = [];
		this._aftercreate = [];
	} else {
	 	this._root._oncreate.push(oncreate);
	 }

	this._fragment = create_main_fragment$4( this._state, this );

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

assign( Confirm.prototype, proto );

template$4.setup( Confirm );

var template$5 = (function () {
const DEFAULTS = Object.assign({}, Dialog.DEFAULTS, {
  initialFocus: false
});
Object.freeze(DEFAULTS);

return {
  setup (Alert) {
    Object.assign(Alert, { DEFAULTS });
  },

  data () {
    return Object.assign({}, DEFAULTS)
  },

  oncreate () {
    forwardData(this, this.refs.dialog, Dialog.DEFAULTS);
    forwardEvents(this.refs.dialog, this, Dialog.EVENTS);

    console.log(this.get('initialFocus'));
    this.set({ initialFocusElement: this.get('initialFocus') ? this.refs.ok : false });
  },
}
}());

function create_main_fragment$5 ( state, component ) {
	var div, button, text;

	function click_handler ( event ) {
		component.refs.dialog.refs.modal.close();
	}

	function mouseenter_handler ( event ) {
		this.focus();
	}

	function mouseleave_handler ( event ) {
		this.blur();
	}

	var dialog = new Dialog({
		_root: component._root,
		slots: { default: createFragment(), actions: createFragment() }
	});

	component.refs.dialog = dialog;

	return {
		create: function () {
			div = createElement( 'div' );
			button = createElement( 'button' );
			text = createText( state.okText );
			dialog._fragment.create();
			this.hydrate();
		},

		hydrate: function ( nodes ) {
			setAttribute( div, 'slot', "actions" );
			button.className = "dialog-action ok";
			addListener( button, 'click', click_handler );
			addListener( button, 'mouseenter', mouseenter_handler );
			addListener( button, 'mouseleave', mouseleave_handler );
		},

		mount: function ( target, anchor ) {
			appendNode( div, dialog._slotted.actions );
			appendNode( button, div );
			component.refs.ok = button;
			appendNode( text, button );
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
			removeListener( button, 'click', click_handler );
			removeListener( button, 'mouseenter', mouseenter_handler );
			removeListener( button, 'mouseleave', mouseleave_handler );
			if ( component.refs.ok === button ) component.refs.ok = null;
			dialog.destroy( false );
			if ( component.refs.dialog === dialog ) component.refs.dialog = null;
		}
	};
}

function Alert ( options ) {
	this.options = options;
	this.refs = {};
	this._state = assign( template$5.data(), options.data );

	this._observers = {
		pre: Object.create( null ),
		post: Object.create( null )
	};

	this._handlers = Object.create( null );

	this._root = options._root || this;
	this._yield = options._yield;
	this._bind = options._bind;

	var oncreate = template$5.oncreate.bind( this );

	if ( !options._root ) {
		this._oncreate = [oncreate];
		this._beforecreate = [];
		this._aftercreate = [];
	} else {
	 	this._root._oncreate.push(oncreate);
	 }

	this._fragment = create_main_fragment$5( this._state, this );

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

assign( Alert.prototype, proto );

template$5.setup( Alert );

var template = (function () {
return {
  data () {
    return {
      dialogOpen: false,
      dialogType: 'confirm',
      dialogOptions: {
        alert: {
          initialFocus: true
        },
        confirm: {
          defaultAction: Confirm.ACTIONS.confirm
        }
      }
    }
  }
}
}());

function create_main_fragment ( state, component ) {
	var div, fieldset, legend, text, text_1, ul, li, label, input, input_updating = false, text_2, li_1, label_1, input_1, input_1_updating = false, text_4, li_2, label_2, input_2, input_2_updating = false, text_6, text_9, text_10, text_11, button, text_12, text_14, if_block_2_anchor;

	function input_change_handler () {
		input_updating = true;
		if ( !input.checked ) return;
		component.set({ dialogType: input.__value });
		input_updating = false;
	}

	function input_1_change_handler () {
		input_1_updating = true;
		if ( !input_1.checked ) return;
		component.set({ dialogType: input_1.__value });
		input_1_updating = false;
	}

	function input_2_change_handler () {
		input_2_updating = true;
		if ( !input_2.checked ) return;
		component.set({ dialogType: input_2.__value });
		input_2_updating = false;
	}

	var if_block = (state.dialogType === 'alert') && create_if_block( state, component );

	var if_block_1 = (state.dialogType === 'confirm') && create_if_block_1( state, component );

	function click_handler ( event ) {
		component.set({ dialogOpen: true });
	}

	var if_block_2 = (state.dialogOpen) && create_if_block_2( state, component );

	return {
		create: function () {
			div = createElement( 'div' );
			fieldset = createElement( 'fieldset' );
			legend = createElement( 'legend' );
			text = createText( "Dialog type" );
			text_1 = createText( "\n    " );
			ul = createElement( 'ul' );
			li = createElement( 'li' );
			label = createElement( 'label' );
			input = createElement( 'input' );
			text_2 = createText( "\n          alert" );
			li_1 = createElement( 'li' );
			label_1 = createElement( 'label' );
			input_1 = createElement( 'input' );
			text_4 = createText( "\n          confirm" );
			li_2 = createElement( 'li' );
			label_2 = createElement( 'label' );
			input_2 = createElement( 'input' );
			text_6 = createText( "\n          prompt" );
			text_9 = createText( "\n\n  " );
			if ( if_block ) if_block.create();
			text_10 = createText( "\n\n  " );
			if ( if_block_1 ) if_block_1.create();
			text_11 = createText( "\n\n  " );
			button = createElement( 'button' );
			text_12 = createText( "Open Dialog" );
			text_14 = createText( "\n\n" );
			if ( if_block_2 ) if_block_2.create();
			if_block_2_anchor = createComment();
			this.hydrate();
		},

		hydrate: function ( nodes ) {
			div.className = "container-fluid";
			fieldset.className = "dialog-type-options";
			input.type = "radio";
			input.name = "dialog-type";
			input.__value = "alert";
			input.value = input.__value;
			component._bindingGroups[0].push( input );
			addListener( input, 'change', input_change_handler );
			input_1.type = "radio";
			input_1.name = "dialog-type";
			input_1.__value = "confirm";
			input_1.value = input_1.__value;
			component._bindingGroups[0].push( input_1 );
			addListener( input_1, 'change', input_1_change_handler );
			input_2.type = "radio";
			input_2.name = "dialog-type";
			input_2.__value = "prompt";
			input_2.value = input_2.__value;
			component._bindingGroups[0].push( input_2 );
			addListener( input_2, 'change', input_2_change_handler );
			addListener( button, 'click', click_handler );
		},

		mount: function ( target, anchor ) {
			insertNode( div, target, anchor );
			appendNode( fieldset, div );
			appendNode( legend, fieldset );
			appendNode( text, legend );
			appendNode( text_1, fieldset );
			appendNode( ul, fieldset );
			appendNode( li, ul );
			appendNode( label, li );
			appendNode( input, label );

			input.checked = input.__value === state.dialogType;

			appendNode( text_2, label );
			appendNode( li_1, ul );
			appendNode( label_1, li_1 );
			appendNode( input_1, label_1 );

			input_1.checked = input_1.__value === state.dialogType;

			appendNode( text_4, label_1 );
			appendNode( li_2, ul );
			appendNode( label_2, li_2 );
			appendNode( input_2, label_2 );

			input_2.checked = input_2.__value === state.dialogType;

			appendNode( text_6, label_2 );
			appendNode( text_9, div );
			if ( if_block ) if_block.mount( div, null );
			appendNode( text_10, div );
			if ( if_block_1 ) if_block_1.mount( div, null );
			appendNode( text_11, div );
			appendNode( button, div );
			appendNode( text_12, button );
			insertNode( text_14, target, anchor );
			if ( if_block_2 ) if_block_2.mount( target, anchor );
			insertNode( if_block_2_anchor, target, anchor );
		},

		update: function ( changed, state ) {
			if ( !input_updating ) {
				input.checked = input.__value === state.dialogType;
			}

			if ( !input_1_updating ) {
				input_1.checked = input_1.__value === state.dialogType;
			}

			if ( !input_2_updating ) {
				input_2.checked = input_2.__value === state.dialogType;
			}

			if ( state.dialogType === 'alert' ) {
				if ( if_block ) {
					if_block.update( changed, state );
				} else {
					if_block = create_if_block( state, component );
					if_block.create();
					if_block.mount( div, text_10 );
				}
			} else if ( if_block ) {
				if_block.unmount();
				if_block.destroy();
				if_block = null;
			}

			if ( state.dialogType === 'confirm' ) {
				if ( if_block_1 ) {
					if_block_1.update( changed, state );
				} else {
					if_block_1 = create_if_block_1( state, component );
					if_block_1.create();
					if_block_1.mount( div, text_11 );
				}
			} else if ( if_block_1 ) {
				if_block_1.unmount();
				if_block_1.destroy();
				if_block_1 = null;
			}

			if ( state.dialogOpen ) {
				if ( if_block_2 ) {
					if_block_2.update( changed, state );
				} else {
					if_block_2 = create_if_block_2( state, component );
					if_block_2.create();
					if_block_2.mount( if_block_2_anchor.parentNode, if_block_2_anchor );
				}
			} else if ( if_block_2 ) {
				if_block_2.unmount();
				if_block_2.destroy();
				if_block_2 = null;
			}
		},

		unmount: function () {
			detachNode( div );
			if ( if_block ) if_block.unmount();
			if ( if_block_1 ) if_block_1.unmount();
			detachNode( text_14 );
			if ( if_block_2 ) if_block_2.unmount();
			detachNode( if_block_2_anchor );
		},

		destroy: function () {
			component._bindingGroups[0].splice( component._bindingGroups[0].indexOf( input ), 1 );

			removeListener( input, 'change', input_change_handler );

			component._bindingGroups[0].splice( component._bindingGroups[0].indexOf( input_1 ), 1 );

			removeListener( input_1, 'change', input_1_change_handler );

			component._bindingGroups[0].splice( component._bindingGroups[0].indexOf( input_2 ), 1 );

			removeListener( input_2, 'change', input_2_change_handler );
			if ( if_block ) if_block.destroy();
			if ( if_block_1 ) if_block_1.destroy();
			removeListener( button, 'click', click_handler );
			if ( if_block_2 ) if_block_2.destroy();
		}
	};
}

function create_if_block ( state, component ) {
	var div, label, text, input, input_updating = false;

	function input_change_handler () {
		input_updating = true;
		var state = component.get();
		state.dialogOptions.alert.initialFocus = input.checked;
		component.set({ dialogOptions: state.dialogOptions });
		input_updating = false;
	}

	return {
		create: function () {
			div = createElement( 'div' );
			label = createElement( 'label' );
			text = createText( "initial focus\n        " );
			input = createElement( 'input' );
			this.hydrate();
		},

		hydrate: function ( nodes ) {
			input.type = "checkbox";
			input.name = "initial-focus";
			addListener( input, 'change', input_change_handler );
		},

		mount: function ( target, anchor ) {
			insertNode( div, target, anchor );
			appendNode( label, div );
			appendNode( text, label );
			appendNode( input, label );

			input.checked = state.dialogOptions.alert.initialFocus;
		},

		update: function ( changed, state ) {
			if ( !input_updating ) {
				input.checked = state.dialogOptions.alert.initialFocus;
			}
		},

		unmount: function () {
			detachNode( div );
		},

		destroy: function () {
			removeListener( input, 'change', input_change_handler );
		}
	};
}

function create_if_block_1 ( state, component ) {
	var fieldset, legend, text, text_1, ul, li, label, input, input_updating = false, text_2, li_1, label_1, input_1, input_1_updating = false, text_4, li_2, label_2, input_2, input_2_value_value, input_2_updating = false, text_6, text_9, p, strong, text_10, text_11, text_12_value = state.confirmed || false, text_12;

	function input_change_handler () {
		input_updating = true;
		if ( !input.checked ) return;
		var state = component.get();
		state.dialogOptions.confirm.defaultAction = input.__value;
		component.set({ dialogOptions: state.dialogOptions });
		input_updating = false;
	}

	function input_1_change_handler () {
		input_1_updating = true;
		if ( !input_1.checked ) return;
		var state = component.get();
		state.dialogOptions.confirm.defaultAction = input_1.__value;
		component.set({ dialogOptions: state.dialogOptions });
		input_1_updating = false;
	}

	function input_2_change_handler () {
		input_2_updating = true;
		if ( !input_2.checked ) return;
		var state = component.get();
		state.dialogOptions.confirm.defaultAction = input_2.__value;
		component.set({ dialogOptions: state.dialogOptions });
		input_2_updating = false;
	}

	return {
		create: function () {
			fieldset = createElement( 'fieldset' );
			legend = createElement( 'legend' );
			text = createText( "Default action" );
			text_1 = createText( "\n      " );
			ul = createElement( 'ul' );
			li = createElement( 'li' );
			label = createElement( 'label' );
			input = createElement( 'input' );
			text_2 = createText( "\n            confirm" );
			li_1 = createElement( 'li' );
			label_1 = createElement( 'label' );
			input_1 = createElement( 'input' );
			text_4 = createText( "\n            deny" );
			li_2 = createElement( 'li' );
			label_2 = createElement( 'label' );
			input_2 = createElement( 'input' );
			text_6 = createText( "\n            none" );
			text_9 = createText( "\n\n    " );
			p = createElement( 'p' );
			strong = createElement( 'strong' );
			text_10 = createText( "Confirmed:" );
			text_11 = createText( " " );
			text_12 = createText( text_12_value );
			this.hydrate();
		},

		hydrate: function ( nodes ) {
			fieldset.className = "dialog-default-action";
			input.type = "radio";
			input.name = "default-action";
			input.__value = "confirm";
			input.value = input.__value;
			component._bindingGroups[1].push( input );
			addListener( input, 'change', input_change_handler );
			input_1.type = "radio";
			input_1.name = "default-action";
			input_1.__value = "deny";
			input_1.value = input_1.__value;
			component._bindingGroups[1].push( input_1 );
			addListener( input_1, 'change', input_1_change_handler );
			input_2.type = "radio";
			input_2.name = "default-action";
			input_2.__value = input_2_value_value = false;
			input_2.value = input_2.__value;
			component._bindingGroups[1].push( input_2 );
			addListener( input_2, 'change', input_2_change_handler );
		},

		mount: function ( target, anchor ) {
			insertNode( fieldset, target, anchor );
			appendNode( legend, fieldset );
			appendNode( text, legend );
			appendNode( text_1, fieldset );
			appendNode( ul, fieldset );
			appendNode( li, ul );
			appendNode( label, li );
			appendNode( input, label );

			input.checked = input.__value === state.dialogOptions.confirm.defaultAction;

			appendNode( text_2, label );
			appendNode( li_1, ul );
			appendNode( label_1, li_1 );
			appendNode( input_1, label_1 );

			input_1.checked = input_1.__value === state.dialogOptions.confirm.defaultAction;

			appendNode( text_4, label_1 );
			appendNode( li_2, ul );
			appendNode( label_2, li_2 );
			appendNode( input_2, label_2 );

			input_2.checked = input_2.__value === state.dialogOptions.confirm.defaultAction;

			appendNode( text_6, label_2 );
			insertNode( text_9, target, anchor );
			insertNode( p, target, anchor );
			appendNode( strong, p );
			appendNode( text_10, strong );
			appendNode( text_11, p );
			appendNode( text_12, p );
		},

		update: function ( changed, state ) {
			if ( !input_updating ) {
				input.checked = input.__value === state.dialogOptions.confirm.defaultAction;
			}

			if ( !input_1_updating ) {
				input_1.checked = input_1.__value === state.dialogOptions.confirm.defaultAction;
			}

			input_2.value = input_2.__value;

			if ( !input_2_updating ) {
				input_2.checked = input_2.__value === state.dialogOptions.confirm.defaultAction;
			}

			if ( ( changed.confirmed ) && text_12_value !== ( text_12_value = state.confirmed || false ) ) {
				text_12.data = text_12_value;
			}
		},

		unmount: function () {
			detachNode( fieldset );
			detachNode( text_9 );
			detachNode( p );
		},

		destroy: function () {
			component._bindingGroups[1].splice( component._bindingGroups[1].indexOf( input ), 1 );

			removeListener( input, 'change', input_change_handler );

			component._bindingGroups[1].splice( component._bindingGroups[1].indexOf( input_1 ), 1 );

			removeListener( input_1, 'change', input_1_change_handler );

			component._bindingGroups[1].splice( component._bindingGroups[1].indexOf( input_2 ), 1 );

			removeListener( input_2, 'change', input_2_change_handler );
		}
	};
}

function create_if_block_3 ( state, component ) {

	var alert = new Alert({
		_root: component._root,
		data: {
			heading: "I would love it if you noticed",
			description: "♪ I'm not going home ♪",
			okText: "Great. Good. Fine. Ok.",
			initialFocus: state.dialogOptions.alert.initialFocus
		}
	});

	alert.on( 'hidden', function ( event ) {
		component.set({ dialogOpen: false });
	});

	return {
		create: function () {
			alert._fragment.create();
		},

		mount: function ( target, anchor ) {
			alert._fragment.mount( target, anchor );
		},

		update: function ( changed, state ) {
			var alert_changes = {};
			if ( changed.dialogOptions ) alert_changes.initialFocus = state.dialogOptions.alert.initialFocus;
			alert._set( alert_changes );
		},

		unmount: function () {
			alert._fragment.unmount();
		},

		destroy: function () {
			alert.destroy( false );
		}
	};
}

function create_if_block_4 ( state, component ) {

	var confirm = new Confirm({
		_root: component._root,
		data: {
			heading: "Do you want a JavaScript dialog?",
			description: "npm install svelte-dialog",
			denyText: "I really just don't",
			confirmText: "Sure, Whatever",
			defaultAction: state.dialogOptions.confirm.defaultAction
		}
	});

	confirm.on( 'result', function ( event ) {
		component.set({ confirmed: event && event.confirmed });
	});

	confirm.on( 'hidden', function ( event ) {
		component.set({ dialogOpen: false });
	});

	return {
		create: function () {
			confirm._fragment.create();
		},

		mount: function ( target, anchor ) {
			confirm._fragment.mount( target, anchor );
		},

		update: function ( changed, state ) {
			var confirm_changes = {};
			if ( changed.dialogOptions ) confirm_changes.defaultAction = state.dialogOptions.confirm.defaultAction;
			confirm._set( confirm_changes );
		},

		unmount: function () {
			confirm._fragment.unmount();
		},

		destroy: function () {
			confirm.destroy( false );
		}
	};
}

function create_if_block_2 ( state, component ) {
	var text, if_block_4_anchor;

	var if_block_3 = (state.dialogType === 'alert') && create_if_block_3( state, component );

	var if_block_4 = (state.dialogType === 'confirm') && create_if_block_4( state, component );

	return {
		create: function () {
			if ( if_block_3 ) if_block_3.create();
			text = createText( "\n\n  " );
			if ( if_block_4 ) if_block_4.create();
			if_block_4_anchor = createComment();
		},

		mount: function ( target, anchor ) {
			if ( if_block_3 ) if_block_3.mount( target, anchor );
			insertNode( text, target, anchor );
			if ( if_block_4 ) if_block_4.mount( target, anchor );
			insertNode( if_block_4_anchor, target, anchor );
		},

		update: function ( changed, state ) {
			if ( state.dialogType === 'alert' ) {
				if ( if_block_3 ) {
					if_block_3.update( changed, state );
				} else {
					if_block_3 = create_if_block_3( state, component );
					if_block_3.create();
					if_block_3.mount( text.parentNode, text );
				}
			} else if ( if_block_3 ) {
				if_block_3.unmount();
				if_block_3.destroy();
				if_block_3 = null;
			}

			if ( state.dialogType === 'confirm' ) {
				if ( if_block_4 ) {
					if_block_4.update( changed, state );
				} else {
					if_block_4 = create_if_block_4( state, component );
					if_block_4.create();
					if_block_4.mount( if_block_4_anchor.parentNode, if_block_4_anchor );
				}
			} else if ( if_block_4 ) {
				if_block_4.unmount();
				if_block_4.destroy();
				if_block_4 = null;
			}
		},

		unmount: function () {
			if ( if_block_3 ) if_block_3.unmount();
			detachNode( text );
			if ( if_block_4 ) if_block_4.unmount();
			detachNode( if_block_4_anchor );
		},

		destroy: function () {
			if ( if_block_3 ) if_block_3.destroy();
			if ( if_block_4 ) if_block_4.destroy();
		}
	};
}

function Demo ( options ) {
	this.options = options;
	this._state = assign( template.data(), options.data );
	this._bindingGroups = [ [], [] ];

	this._observers = {
		pre: Object.create( null ),
		post: Object.create( null )
	};

	this._handlers = Object.create( null );

	this._root = options._root || this;
	this._yield = options._yield;
	this._bind = options._bind;

	if ( !options._root ) {
		this._oncreate = [];
		this._beforecreate = [];
		this._aftercreate = [];
	}

	this._fragment = create_main_fragment( this._state, this );

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

assign( Demo.prototype, proto );

new Demo({ target: document.body });

}());
