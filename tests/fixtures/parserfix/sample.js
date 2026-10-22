'use strict';
const path = require('path');

/**
 * Join two segments.
 */
function join(a, b) {
  return path.join(a, b);
}

const arrow = (x) => x * 2;

const obj = {
  method() { return 1; },
  prop: function () { return 2; },
  arrowProp: (y) => y + 1
};

class Widget {
  constructor(name) { this.name = name; }
  /** Render the widget. */
  render() { return `<${this.name}>`; }
  static create(name) { return new Widget(name); }
  get label() { return this.name; }
}

function factory(options) {
  return { options, join, arrow };
}
module.exports = factory;

exports.helper = function helper(x) { return x; };

async function load(url) { return url; }

function* gen() { yield 1; }

module.exports.Widget = Widget;
module.exports.obj = obj;
module.exports.load = load;
module.exports.gen = gen;
