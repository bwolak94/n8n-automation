/**
 * Console-capture setup injected at the top of every sandbox context.
 * Defines `__sandbox_logs` array and a `console` shim that appends to it.
 */
export const CONSOLE_SETUP_CODE = /* js */ `
var __sandbox_logs = [];
var console = {
  log: function() {
    var args = Array.prototype.slice.call(arguments);
    __sandbox_logs.push(args.map(function(a) {
      return (a !== null && typeof a === 'object') ? JSON.stringify(a) : String(a);
    }).join(' '));
  },
  warn: function() {
    var args = Array.prototype.slice.call(arguments);
    __sandbox_logs.push('[warn] ' + args.map(function(a) {
      return (a !== null && typeof a === 'object') ? JSON.stringify(a) : String(a);
    }).join(' '));
  },
  error: function() {
    var args = Array.prototype.slice.call(arguments);
    __sandbox_logs.push('[error] ' + args.map(function(a) {
      return (a !== null && typeof a === 'object') ? JSON.stringify(a) : String(a);
    }).join(' '));
  },
};
`;

/**
 * Lodash-subset + date-fns-subset injected into every sandbox context.
 * Pure JS, no Node.js APIs required.
 */
export const SANDBOX_UTILS_CODE = /* js */ `
// ── Lodash subset (exposed as _) ───────────────────────────────────────────
var _ = (function() {
  function pick(obj, keys) {
    var result = {};
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (Object.prototype.hasOwnProperty.call(obj, k)) result[k] = obj[k];
    }
    return result;
  }

  function omit(obj, keys) {
    var keySet = {};
    for (var i = 0; i < keys.length; i++) keySet[keys[i]] = true;
    var result = {};
    var all = Object.keys(obj);
    for (var j = 0; j < all.length; j++) {
      if (!keySet[all[j]]) result[all[j]] = obj[all[j]];
    }
    return result;
  }

  function groupBy(arr, key) {
    return arr.reduce(function(acc, item) {
      var k = typeof key === 'function' ? key(item) : item[key];
      if (!acc[k]) acc[k] = [];
      acc[k].push(item);
      return acc;
    }, {});
  }

  function sortBy(arr, key) {
    return arr.slice().sort(function(a, b) {
      var va = typeof key === 'function' ? key(a) : a[key];
      var vb = typeof key === 'function' ? key(b) : b[key];
      return va < vb ? -1 : va > vb ? 1 : 0;
    });
  }

  function flatten(arr) {
    var result = [];
    for (var i = 0; i < arr.length; i++) {
      if (Array.isArray(arr[i])) {
        var sub = arr[i];
        for (var j = 0; j < sub.length; j++) result.push(sub[j]);
      } else {
        result.push(arr[i]);
      }
    }
    return result;
  }

  function uniq(arr) {
    var seen = {};
    var result = [];
    for (var i = 0; i < arr.length; i++) {
      var k = String(arr[i]);
      if (!seen[k]) { seen[k] = true; result.push(arr[i]); }
    }
    return result;
  }

  function chunk(arr, size) {
    var result = [];
    for (var i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size));
    }
    return result;
  }

  return { pick: pick, omit: omit, groupBy: groupBy, sortBy: sortBy,
           flatten: flatten, uniq: uniq, chunk: chunk };
})();

// ── date-fns subset (top-level functions) ─────────────────────────────────
function parseISO(str) {
  return new Date(str);
}

function format(date, fmt) {
  var d = (date instanceof Date) ? date : new Date(date);
  var pad = function(n, w) { return String(n).padStart(w || 2, '0'); };
  var MONTHS     = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var MONTHS_LNG = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
  return fmt
    .replace('MMMM', MONTHS_LNG[d.getMonth()])
    .replace('MMM',  MONTHS[d.getMonth()])
    .replace('MM',   pad(d.getMonth() + 1))
    .replace('dd',   pad(d.getDate()))
    .replace('d',    String(d.getDate()))
    .replace('yyyy', String(d.getFullYear()))
    .replace('HH',   pad(d.getHours()))
    .replace('mm',   pad(d.getMinutes()))
    .replace('ss',   pad(d.getSeconds()));
}

function addDays(date, days) {
  var d = new Date((date instanceof Date) ? date.getTime() : date);
  d.setDate(d.getDate() + days);
  return d;
}

function differenceInDays(dateA, dateB) {
  var a = (dateA instanceof Date) ? dateA : new Date(dateA);
  var b = (dateB instanceof Date) ? dateB : new Date(dateB);
  return Math.floor((a.getTime() - b.getTime()) / 86400000);
}
`;
