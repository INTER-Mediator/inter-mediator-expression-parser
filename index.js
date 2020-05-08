/*
 Based on ndef.parser, by Raphael Graf(r@undefined.ch)
 http://www.undefined.ch/mparser/index.html
 Ported to JavaScript and modified by Matthew Crumley (email@matthewcrumley.com, http://silentmatt.com/)
 You are free to use and modify this code in anyway you find useful. Please leave this comment in the code
 to acknowledge its original source. If you feel like it, I enjoy hearing about projects that use my code,
 but don't feel like you have to let me know or ask permission.
 */
/*
 * INTER-Mediator
 * Copyright (c) INTER-Mediator Directive Committee (http://inter-mediator.org)
 * This project started at the end of 2009 by Masayuki Nii msyk@msyk.net.
 *
 * INTER-Mediator is supplied under MIT License.
 * Please see the full license for details:
 * https://github.com/INTER-Mediator/INTER-Mediator/blob/master/dist-docs/License.txt
 */
/**
 *
 * Usually you don't have to instanciate this class with new operator.
 * @constructor
 */
let Parser = (function (scope) {
  let TNUMBER = 0
  let TOP1 = 1
  let TOP2 = 2
  let TOP3 = 5
  let SEP = 65
  let TVAR = 3
  let TFUNCALL = 4

  Parser.regFirstVarChar = new RegExp('[\u00A0-\u1FFF\u2C00-\uDFFFa-zA-Z@_]')
  Parser.regRestVarChar = new RegExp('[\u00A0-\u1FFF\u2C00-\uDFFFa-zA-Z@_:0-9]')

  function Token(type_, index_, prio_, number_) {
    this.type_ = type_
    this.index_ = index_ || 0
    this.prio_ = prio_ || 0
    this.number_ = (number_ !== undefined && number_ !== null) ? number_ : 0
    this.toString = function () {
      switch (this.type_) {
        case TNUMBER:
          return this.number_
        case TOP1:
        case TOP2:
        case TOP3:
        case TVAR:
          return this.index_
        case TFUNCALL:
          return 'CALL'
        case SEP:
          return 'SEPARATOR'
        default:
          return 'Invalid Token'
      }
    }
  }

  function Expression(tokens, ops1, ops2, functions, ops3, ops3Trail) {
    this.tokens = tokens
  }

  // Based on http://www.json.org/json2.js
//    let cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g
  let escapable = /[\\\'\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g
  let meta = {    // table of character substitutions
    '\b': '\\b',
    '\t': '\\t',
    '\n': '\\n',
    '\f': '\\f',
    '\r': '\\r',
    '\'': '\\\'',
    '\\': '\\\\'
  }

  function escapeValue(v) {
    if (typeof v === 'string') {
      escapable.lastIndex = 0
      return escapable.test(v) ? '\'' + v.replace(escapable, function (a) {
        let c = meta[a]
        return typeof c === 'string' ? c : '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4)
      }) + '\'' : '\'' + v + '\''
    }
    return v
  }

  Expression.prototype = {
    simplify: function (values) {
      values = values || {}
      let nstack = []
      let newexpression = []
      let n1
      let n2
      let n3
      let f
      let L = this.tokens.length
      let item
      let i
      for (i = 0; i < L; i++) {
        item = this.tokens[i]
        let type_ = item.type_
        if (type_ === TNUMBER) {
          nstack.push(item)
        } else if (type_ === TVAR && (item.index_ in values)) {
          item = new Token(TNUMBER, 0, 0, values[item.index_])
          nstack.push(item)
        } else if (type_ === TOP3 && nstack.length > 2) {
          n3 = nstack.pop()
          n2 = nstack.pop()
          n1 = nstack.pop()
          f = Parser.ops3[item.index_]
          item = new Token(TNUMBER, 0, 0, f(n1.number_, n2.number_, n3.number_))
          nstack.push(item)
        } else if (type_ === TOP2 && nstack.length > 1) {
          n2 = nstack.pop()
          n1 = nstack.pop()
          f = Parser.ops2[item.index_]
          item = new Token(TNUMBER, 0, 0, f(n1.number_, n2.number_))
          nstack.push(item)
        } else if (type_ === TOP1 && nstack.length > 0) {
          n1 = nstack.pop()
          f = Parser.ops1[item.index_]
          item = new Token(TNUMBER, 0, 0, f(n1.number_))
          nstack.push(item)
        } else {
          while (nstack.length > 0) {
            newexpression.push(nstack.shift())
          }
          newexpression.push(item)
        }
      }
      while (nstack.length > 0) {
        newexpression.push(nstack.shift())
      }

      return new Expression(newexpression)
    },

    substitute: function (variable, expr) {
      if (!(expr instanceof Expression)) {
        expr = new Parser().parse(String(expr))
      }
      let newexpression = []
      let L = this.tokens.length
      let item
      let i
      for (i = 0; i < L; i++) {
        item = this.tokens[i]
        let type_ = item.type_
        if (type_ === TVAR && item.index_ === variable) {
          for (let j = 0; j < expr.tokens.length; j++) {
            let expritem = expr.tokens[j]
            let replitem = new Token(expritem.type_, expritem.index_, expritem.prio_, expritem.number_)
            newexpression.push(replitem)
          }
        } else {
          newexpression.push(item)
        }
      }
      return new Expression(newexpression)
    },

    evaluate: function (values) {
      values = values || {}
      let nstack = []
      let n1
      let n2
      let n3
      let f
      let L = this.tokens.length
      let item
      let i = 0
      for (i = 0; i < L; i++) {
        item = this.tokens[i]
        let type_ = item.type_
        if (type_ === TNUMBER) {
          nstack.push(item.number_)
        } else if (type_ === TOP3) {
          n3 = nstack.pop()
          n2 = nstack.pop()
          n1 = nstack.pop()
          f = Parser.ops3Trail[item.index_]
          nstack.push(f(n1, n2, n3))
        } else if (type_ === TOP2) {
          n2 = nstack.pop()
          n1 = nstack.pop()
          f = Parser.ops2[item.index_]
          nstack.push(f(n1, n2))
        } else if (type_ === TVAR) {
          if (item.index_ in values) {
            nstack.push(values[item.index_])
          } else if (item.index_ in Parser.functions) {
            nstack.push(Parser.functions[item.index_])
          } else {
            throw new Error('undefined variable: ' + item.index_)
          }
        } else if (type_ === TOP1) {
          n1 = nstack.pop()
          f = Parser.ops1[item.index_]
          nstack.push(f(n1))
        } else if (type_ === SEP) {
          n2 = nstack.pop()
          n1 = nstack.pop()
          nstack.push([n1, n2])
        } else if (type_ === TFUNCALL) {
          n1 = nstack.pop()
          f = nstack.pop()

          if (f.apply && f.call) {
            if (Object.prototype.toString.call(n1) == '[object Array]') {
              nstack.push(f.apply(undefined, n1))
            } else {
              nstack.push(f.call(undefined, n1))
            }
          } else {
            throw new Error(f + ' is not a function')
          }
        } else {
          throw new Error('invalid Expression')
        }
      }
      if (nstack.length > 1) {
        throw new Error('invalid Expression (parity)')
      }
      return nstack[0]
    },

    variables: function () {
      let L = this.tokens.length
      let vars = []
      for (let i = 0; i < L; i++) {
        let item = this.tokens[i]
        if (item.type_ === TVAR && (vars.indexOf(item.index_) == -1) && !(item.index_ in Parser.functions)) {
          vars.push(item.index_)
        }
      }
      return vars
    }
  }

  function iff(a, b, c) {
    let vala, valb, valc
    vala = (a instanceof Array) ? arguments[0][0] : arguments[0]
    valb = (b instanceof Array) ? arguments[1][0] : arguments[1]
    valc = (c instanceof Array) ? arguments[2][0] : arguments[2]
    return vala ? valb : valc
  }

  function greaterthan(a, b) {
    let numa, numb
    numa = toNumber(a)
    numb = toNumber(b)
    if (!isNaN(numa) && !isNaN(numa)) {
      return Number(numa) > Number(numb)
    }
    return a > b
  }

  function lessthan(a, b) {
    let numa, numb
    numa = toNumber(a)
    numb = toNumber(b)
    if (!isNaN(numa) && !isNaN(numa)) {
      return Number(numa) < Number(numb)
    }
    return a < b
  }

  function greaterequal(a, b) {
    let numa, numb
    numa = toNumber(a)
    numb = toNumber(b)
    if (!isNaN(numa) && !isNaN(numa)) {
      return Number(numa) >= Number(numb)
    }
    return a >= b
  }

  function lessequal(a, b) {
    let numa, numb
    numa = toNumber(a)
    numb = toNumber(b)
    if (!isNaN(numa) && !isNaN(numa)) {
      return Number(numa) <= Number(numb)
    }
    return a <= b
  }

  function equal(a, b) {
    let numa, numb
    numa = toNumber(a)
    numb = toNumber(b)
    if (!isNaN(numa) && !isNaN(numa)) {
      return Number(numa) === Number(numb)
    }
    return a == b
  }

  function notequal(a, b) {
    let numa, numb
    numa = toNumber(a)
    numb = toNumber(b)
    if (!isNaN(numa) && !isNaN(numa)) {
      return Number(numa) !== Number(numb)
    }
    return a !== b
  }

  // http://qiita.com/south37/items/e400a3a698957ab4aa7a
  // NaN === NaN returns false.
  function isReallyNaN(x) {
    return x !== x    // if x is NaN returns true, otherwise false.
  }

  function add(a, b) {
    let numa, numb
    if ((typeof a) == 'string' || (typeof b) == 'string') {
      return addstring(a, b)
    }
    if (isReallyNaN(a) || isReallyNaN(b)) {
      return NaN
    }
    numa = toNumber(a)
    numb = toNumber(b)
    if (!isNaN(numa) && !isNaN(numb)) {
      return Number(numa) + Number(numb)
    }
    return a + b
  }

  function addstring(a, b) {
    return String(a) + String(b)
  }

  function sub(a, b) {
    let numa, numb, str, pos
    if (isReallyNaN(a) || isReallyNaN(b)) {
      return NaN
    }
    numa = toNumber(a)
    numb = toNumber(b)

    if (!isNaN(numa) && !isNaN(numb)) {
      return numa - numb   // Numeric substruct
    }
    str = String(a)
    do {  // String substruct
      pos = str.indexOf(b)
      if (pos > -1) {
        str = str.substr(0, pos) + str.substr(pos + b.length)
      }
    } while (pos > -1)
    return str
  }

  function mul(a, b) {
    if (isReallyNaN(a) || isReallyNaN(b)) {
      return NaN
    }
    a = toNumber(a)
    b = toNumber(b)
    return a * b
  }

  function div(a, b) {
    if (isReallyNaN(a) || isReallyNaN(b)) {
      return NaN
    }
    a = toNumber(a)
    b = toNumber(b)
    return a / b
  }

  function mod(a, b) {
    if (isReallyNaN(a) || isReallyNaN(b)) {
      return NaN
    }
    a = toNumber(a)
    b = toNumber(b)
    return a % b
  }

  function neg(a) {
    if (isReallyNaN(a)) {
      return NaN
    }
    a = toNumber(a)
    return -a
  }

  function random(a) {
    a = toNumber(a)
    return Math.random() * (a || 1)
  }

  function fac(a) { //a!
    if (isReallyNaN(a)) {
      return NaN
    }
    a = toNumber(a)
    a = Math.floor(a)
    let b = a
    while (a > 1) {
      b = b * (--a)
    }
    return b
  }

  function logicalnot(a) {
    a = toNumber(a)
    return !a
  }

  function logicaland(a, b) {
    a = toNumber(a)
    b = toNumber(b)
    return a && b
  }

  function logicalor(a, b) {
    a = toNumber(a)
    b = toNumber(b)
    return a || b
  }

  function sumfunc() {
    let result = 0, i
    for (i = 0; i < arguments.length; i++) {
      result += toNumber(arguments[i])
    }
    return result
  }

  function averagefunc() {
    let result = 0, i, count = 0

    for (i = 0; i < arguments.length; i++) {
      result += toNumber(arguments[i])
      count++
    }
    return result / count
  }

  function countElements() {
    let i, count = 0

    for (i = 0; i < arguments.length; i++) {
      count += Array.isArray(arguments[i]) ? arguments[i].length : 1
    }
    return count
  }

  function listfunc() {
    let result = '', i

    for (i = 0; i < arguments.length; i++) {
      result += String(arguments[i])
      result += '\n'
    }
    return result
  }

  function roundfunc(a, b) {
    if (b == undefined) {
      return Math.round(a)
    } else {
      a = (a instanceof Array) ? a.join() : a
      b = (b instanceof Array) ? b.join() : b
      return round(a, b)
    }
  }

  /**
   * This method returns the rounded value of the 1st parameter to the 2nd parameter from decimal point.
   * @param {number} value The source value.
   * @param {integer} digit Positive number means after the decimal point, and negative menas before it.
   * @returns {number}
   */
  function round(value, digit) {
    'use strict'
    let powers = Math.pow(10, digit)
    return Math.round(value * powers) / powers
  }

  function length(a) {
    if (a == undefined || a == null) {
      return 0
    } else {
      a = (a instanceof Array) ? a.join() : a
      return (new String(a)).length
    }
  }

  /* ===== private ===== */
  function toNumber(str) {
    let value

    if (str === undefined) {
      return NaN
    }
    if (str === true) {
      return true
    }
    if (str === false) {
      return false
    }
    if (str == '') {
      return 0
    }
    value = str
    if (Array.isArray(str)) {
      if (str.length < 1) {
        return 0
      } else {
        value = str[0]
      }
    }
    value = unformat(value)
    return value
  }

  /* ===== private ===== */

  // TODO: use hypot that doesn't overflow
  function pyt(a, b) {
    return Math.sqrt(a * a + b * b)
  }

  function append(a, b) {
    if (Object.prototype.toString.call(a) != '[object Array]') {
      return [a, b]
    }
    a = a.slice()
    a.push(b)
    return a
  }

  function charsetand(a, b) {
    let stra, strb, i, result = ''
    stra = (a instanceof Array) ? a.join() : a
    strb = (b instanceof Array) ? b.join() : b
    for (i = 0; i < stra.length; i++) {
      if (strb.indexOf(stra.substr(i, 1)) > -1) {
        result += stra.substr(i, 1)
      }
    }
    return result
  }

  function charsetor(a, b) {
    let stra, strb, i, result = ''
    stra = (a instanceof Array) ? a.join() : a
    strb = (b instanceof Array) ? b.join() : b
    for (i = 0; i < strb.length; i++) {
      if (stra.indexOf(strb.substr(i, 1)) < 0) {
        result += strb.substr(i, 1)
      }
    }
    return stra + result
  }

  function charsetnoother(a, b) {
    let stra, strb, i, result = ''
    stra = (a instanceof Array) ? a.join() : a
    strb = (b instanceof Array) ? b.join() : b
    for (i = 0; i < stra.length; i++) {
      if (strb.indexOf(stra.substr(i, 1)) < 0) {
        result += stra.substr(i, 1)
      }
    }
    return result
  }

  /* ===== private ===== */
  function parametersOfMultiline(a, b) {
    let stra, strb, arraya, arrayb, i, nls, nl = '\n'
    stra = (a instanceof Array) ? a.join() : a
    nls = [
      stra.indexOf('\r\n'),
      stra.indexOf('\r'), stra.indexOf('\n')
    ]
    for (i = 0; i < nls.length; i++) {
      nls[i] = (nls[i] < 0) ? stra.length : nls[i]
    }
    if (nls[0] < stra.length && nls[0] <= nls[1] && nls[0] < nls[2]) {
      nl = '\r\n'
    } else if (nls[1] < stra.length && nls[1] < nls[0] && nls[1] < nls[2]) {
      nl = '\r'
    }
    arraya = stra.replace('\r\n', '\n').replace('\r', '\n').split('\n')
    strb = (b instanceof Array) ? b.join() : b
    arrayb = strb.replace('\r\n', '\n').replace('\r', '\n').split('\n')
    return [arraya, arrayb, nl]
  }

  /* ===== private ===== */

  function itemsetand(a, b) {
    let params, arraya, arrayb, nl, i, result = ''
    params = parametersOfMultiline(a, b)
    arraya = params[0]
    arrayb = params[1]
    nl = params[2]
    for (i = 0; i < arraya.length; i++) {
      if (arrayb.indexOf(arraya[i]) > -1 && arraya[i].length > 0) {
        result += arraya[i] + nl
      }
    }
    return result
  }

  function itemsetor(a, b) {
    let params, arraya, arrayb, nl, i, result = ''
    params = parametersOfMultiline(a, b)
    arraya = params[0]
    arrayb = params[1]
    nl = params[2]
    for (i = 0; i < arraya.length; i++) {
      if (arraya[i].length > 0) {
        result += arraya[i] + nl
      }
    }
    for (i = 0; i < arrayb.length; i++) {
      if (arraya.indexOf(arrayb[i]) < 0 && arrayb[i].length > 0) {
        result += arrayb[i] + nl
      }
    }
    return result
  }

  function itemsetnoother(a, b) {
    let params, arraya, arrayb, nl, i, result = ''
    params = parametersOfMultiline(a, b)
    arraya = params[0]
    arrayb = params[1]
    nl = params[2]
    for (i = 0; i < arraya.length; i++) {
      if (arrayb.indexOf(arraya[i]) < 0 && arraya[i].length > 0) {
        result += arraya[i] + nl
      }
    }
    return result
  }

  function itematindex(a, start, end) {
    let params, arraya, nl, i, result = ''
    params = parametersOfMultiline(a, '')
    arraya = params[0]
    nl = params[2]
    end = (end == undefined) ? arraya.length : end
    for (i = start; (i < start + end) && (i < arraya.length); i++) {
      result += arraya[i] + nl
    }
    return result
  }

  function itemIndexOfFunc(list, str) {
    if (!list) {
      return -1
    }
    let a = list.replace('\r\n', '\n').replace('\r', '\n')
    let ix = 0
    let item, pos
    while (a.length > 0) {
      pos = a.indexOf('\n')
      if (pos > -1) {
        item = a.substr(0, pos)
        a = a.substr(pos + 1)
      } else {
        item = a
        a = ''
      }
      if (item == str) {
        return ix
      }
      ix++
    }
    return -1
  }

  function numberformat(val, digit) {
    let stra, strb
    stra = (val instanceof Array) ? val.join() : val
    strb = (digit instanceof Array) ? digit.join() : digit
    return IMLibFormat.numberFormat(stra, strb, {useSeparator: true})
  }

  function currencyformat(val, digit) {
    let stra, strb
    stra = (val instanceof Array) ? val.join() : val
    strb = (digit instanceof Array) ? digit.join() : digit
    return IMLibFormat.currencyFormat(stra, strb, {useSeparator: true})
  }

  function substr(str, pos, len) {
    let stra, p, l
    if (str == null) {
      return null
    }
    stra = (str instanceof Array) ? str.join() : str
    p = (pos instanceof Array) ? pos.join() : pos
    l = (len instanceof Array) ? len.join() : len

    return stra.substr(p, l)
  }

  function substring(str, start, end) {
    let stra, s, e
    if (str == null) {
      return null
    }
    stra = (str instanceof Array) ? str.join() : str
    s = (start instanceof Array) ? start.join() : start
    e = (end instanceof Array) ? end.join() : end

    return stra.substring(s, e)
  }

  function leftstring(str, start) {
    let stra, s
    if (str == null) {
      return null
    }
    stra = String((str instanceof Array) ? str.join() : str)
    s = parseInt((start instanceof Array) ? start.join() : start)

    return stra.substring(0, s)
  }

  function midstring(str, start, end) {
    let stra, s, e
    if (str == null) {
      return null
    }
    stra = String((str instanceof Array) ? str.join() : str)
    s = parseInt((start instanceof Array) ? start.join() : start)
    e = parseInt((end instanceof Array) ? end.join() : end)

    return stra.substr(s, e)
  }

  function rightstring(str, start) {
    let stra, s
    if (str == null) {
      return null
    }
    stra = String((str instanceof Array) ? str.join() : str)
    s = parseInt((start instanceof Array) ? start.join() : start)

    return stra.substring(stra.length - s)
  }

  function indexof(str, search, from) {
    let stra, s
    if (str == null) {
      return null
    }
    stra = (str instanceof Array) ? str.join() : str
    s = (search instanceof Array) ? search.join() : search
    if (from == undefined) {
      return stra.indexOf(s)
    }
    return stra.indexOf(s, from)

  }

  function lastindexof(str, search, from) {
    let stra, s
    if (str == null) {
      return null
    }
    stra = (str instanceof Array) ? str.join() : str
    s = (search instanceof Array) ? search.join() : search
    if (from == undefined) {
      return stra.lastIndexOf(s)
    }
    return stra.lastIndexOf(s, from)
  }

  function replace(str, start, end, rep) {
    let stra, s, e, r
    if (str == null) {
      return null
    }
    stra = (str instanceof Array) ? str.join() : str
    s = (start instanceof Array) ? start.join() : start
    e = (end instanceof Array) ? end.join() : end
    r = (rep instanceof Array) ? rep.join() : rep
    return stra.substr(0, s) + r + stra.substr(e)
  }

  function substitute(str, search, rep) {
    let stra, s, r, reg
    if (str == null) {
      return null
    }
    stra = (str instanceof Array) ? str.join() : str
    s = (search instanceof Array) ? search.join() : search
    r = (rep instanceof Array) ? rep.join() : rep
    reg = new RegExp(s, 'g')
    return stra.replace(reg, r)
  }

  function match(str, pattern) {
    let stra, p
    stra = (str instanceof Array) ? str.join() : str
    p = (pattern instanceof Array) ? pattern.join() : pattern
    return stra.match(new RegExp(p))
  }

  function test(str, pattern) {
    let stra, p
    if (str == null) {
      return null
    }
    stra = (str instanceof Array) ? str.join() : str
    p = (pattern instanceof Array) ? pattern.join() : pattern
    return (new RegExp(p)).test(stra)
  }

  function basename(path) {
    if (path == null) {
      return null
    }
    let str = (path instanceof Array) ? path.join() : String(path)
    if (str.substr(-1) == '/') {
      str = str.substr(0, str.length - 1)
    }
    return str.substr(str.lastIndexOf('/') - str.length + 1)
  }

  function extname(path) {
    if (path == null) {
      return null
    }
    const str = (path instanceof Array) ? path.join() : String(path)
    const dotPos = str.lastIndexOf('.')
    return (dotPos < 0) ? '' : str.substr(str.lastIndexOf('.') - str.length + 1)
  }

  function dirname(path) {
    if (path == null) {
      return null
    }
    const str = (path instanceof Array) ? path.join() : String(path)
    return str.substr(0, str.lastIndexOf('/'))
  }

  function startsWith(str, pin) {
    if (str === null || pin === null) {
      return null
    }
    const stra = (str instanceof Array) ? str.join() : String(str)
    const pina = (pin instanceof Array) ? pin.join() : String(pin)
    return stra.indexOf(pina) === 0
  }

  function endsWith(str, pin) {
    if (str === null || pin === null) {
      return null
    }
    const stra = (str instanceof Array) ? str.join() : String(str)
    const pina = (pin instanceof Array) ? pin.join() : String(pin)
    return (stra.indexOf(pina) + pina.length) === stra.length
  }

  Parser.timeOffset = (new Date()).getTimezoneOffset()

  function DateInt(str) {
    let theDate
    if (str === undefined) {
      theDate = Date.now()
    } else {
      theDate = Date.parse(str.replace(/-/g, '/'))
      theDate -= Parser.timeOffset * 60000
    }
    return parseInt(theDate / 86400000)
  }

  function SecondInt(str) {
    let theDate
    if (str === undefined) {
      theDate = Date.now()
    } else {
      theDate = Date.parse(str.replace(/-/g, '/'))
      //theDate -= Parser.timeOffset * 60000
    }
    return parseInt(theDate / 1000)
  }

  /* Internal use for date time functions */
  function dvalue(s) {
    if (parseInt(s).length == s.length) {
      return s
    } else {
      return DateInt(s)
    }
  }

  function dtvalue(s) {
    if (parseInt(s).length == s.length) {
      return s
    } else {
      return SecondInt(s)
    }
  }

  function calcDateComponent(d, a, index) {
    let dtComp = []
    dtComp.push(yeard(d))
    dtComp.push(monthd(d))
    dtComp.push(dayd(d))
    dtComp[index] += a
    return datecomponents(dtComp[0], dtComp[1], dtComp[2])
  }

  function calcDateTimeComponent(dt, a, index) {
    let dtComp = []
    dtComp.push(yeardt(dt))
    dtComp.push(monthdt(dt))
    dtComp.push(daydt(dt))
    dtComp.push(hourdt(dt))
    dtComp.push(minutedt(dt))
    dtComp.push(seconddt(dt))
    dtComp[index] += a
    return datetimecomponents(dtComp[0], dtComp[1], dtComp[2], dtComp[3], dtComp[4], dtComp[5])
  }

  /* - - - - - - - - - - - - - - - - - - - */

  function datecomponents(y, m, d) {
    let m0 = m - 1
    if (m0 < 0 || m0 > 11) {
      y += parseInt(m0 / 12)
      m = m0 % 12 + 1
    }
    //let str = parseInt(y) + '/' + ('0' + parseInt(m)).substr(-2, 2) + '/01'
    return parseInt(Date.UTC(y, m - 1, d, 0, 0, 0) / 86400000)
  }

  function datetimecomponents(y, m, d, h, i, s) {
    if (s < 0 || s > 59) {
      i += parseInt(s / 60)
      s = s % 60
    }
    if (i < 0 || i > 59) {
      h += parseInt(i / 60)
      i = i % 60
    }
    if (h < 0 || h > 23) {
      d += parseInt(h / 24)
      h = h % 24
    }
    let m0 = m - 1
    if (m0 < 0 || m0 > 11) {
      y += parseInt(m0 / 12)
      m = m0 % 12 + 1
    }
    //let str = parseInt(y) + '/' + ('0' + parseInt(m)).substr(-2, 2) + '/01 ' +
    //    ('0' + parseInt(h)).substr(-2, 2) + ':' + ('0' + parseInt(i)).substr(-2, 2) + ':' +
    //    ('0' + parseInt(s)).substr(-2, 2)
    return Date.UTC(y, m - 1, d, h, i, s) / 1000
  }

  let dateTimeFunction = false

  function yearAlt(d) {
    return this.dateTimeFunction ? yeardt(d) : yeard(d)
  }

  function monthAlt(d) {
    return this.dateTimeFunction ? monthdt(d) : monthd(d)
  }

  function dayAlt(d) {
    return this.dateTimeFunction ? daydt(d) : dayd(d)
  }

  function weekdayAlt(d) {
    return this.dateTimeFunction ? weekdaydt(d) : weekdayd(d)
  }

  function hourAlt(d) {
    return this.dateTimeFunction ? hourdt(d) : 0
  }

  function minuteAlt(d) {
    return this.dateTimeFunction ? minutedt(d) : 0
  }

  function secondAlt(d) {
    return this.dateTimeFunction ? seconddt(d) : 0
  }

  function yeard(d) {
    return new Date(dvalue(d) * 86400000).getFullYear()
  }

  function monthd(d) {
    return new Date(dvalue(d) * 86400000).getMonth() + 1
  }

  function dayd(d) {
    return new Date(dvalue(d) * 86400000).getDate()
  }

  function weekdayd(d) {
    return new Date(dvalue(d) * 86400000).getDay()
  }

  function yeardt(dt) {
    return new Date(dtvalue(dt) * 1000).getFullYear()
  }

  function monthdt(dt) {
    return new Date(dtvalue(dt) * 1000).getMonth() + 1
  }

  function daydt(dt) {
    return new Date(dtvalue(dt) * 1000).getDate()
  }

  function weekdaydt(dt) {
    return new Date(dtvalue(dt) * 1000).getDay()
  }

  function hourdt(dt) {
    return new Date(dtvalue(dt) * 1000).getHours()
  }

  function minutedt(dt) {
    return new Date(dtvalue(dt) * 1000).getMinutes()
  }

  function seconddt(dt) {
    return new Date(dtvalue(dt) * 1000).getSeconds()
  }

  function addyear(d, a) {
    return this.dateTimeFunction ? addyeardt(d, a) : addyeard(d, a)
  }

  function addmonth(d, a) {
    return this.dateTimeFunction ? addmonthdt(d, a) : addmonthd(d, a)
  }

  function addday(d, a) {
    return this.dateTimeFunction ? adddaydt(d, a) : adddayd(d, a)
  }

  function addhour(d, a) {
    return this.dateTimeFunction ? addhourdt(d, a) : NaN
  }

  function addminute(d, a) {
    return this.dateTimeFunction ? addminutedt(d, a) : NaN
  }

  function addsecond(d, a) {
    return this.dateTimeFunction ? addseconddt(d, a) : NaN
  }

  function addyeard(d, a) {
    return calcDateComponent(d, a, 0)
  }

  function addmonthd(d, a) {
    return calcDateComponent(d, a, 1)
  }

  function adddayd(d, a) {
    return calcDateComponent(d, a, 2)
  }

  function addyeardt(dt, a) {
    return calcDateTimeComponent(dt, a, 0)
  }

  function addmonthdt(dt, a) {
    return calcDateTimeComponent(dt, a, 1)
  }

  function adddaydt(dt, a) {
    return calcDateTimeComponent(dt, a, 2)
  }

  function addhourdt(dt, a) {
    return calcDateTimeComponent(dt, a, 3)
  }

  function addminutedt(dt, a) {
    return calcDateTimeComponent(dt, a, 4)
  }

  function addseconddt(dt, a) {
    return calcDateTimeComponent(dt, a, 5)
  }

  function endofmonth(d) {
    return this.dateTimeFunction ? endofmonthdt(d) : endofmonthd(d)
  }

  function endofmonthd(d) {
    return adddayd(addmonthd(startofmonthd(d), 1), -1)
  }

  function endofmonthdt(dt) {
    return addseconddt(addmonthdt(startofmonthdt(dt), 1), -1)
  }

  function startofmonth(d) {
    return this.dateTimeFunction ? startofmonthdt(d) : startofmonthd(d)
  }

  function startofmonthd(d) {
    let str = yeard(d) + '/' + ('0' + monthd(d)).substr(-2, 2) + '/01'
    return DateInt(str)
  }

  function startofmonthdt(dt) {
    let str = yeardt(dt) + '/' + ('0' + monthdt(dt)).substr(-2, 2) + '/01 00:00:00'
    return SecondInt(str)
  }

  function today() {
    return parseInt(Date.now() / 86400)
  }

  function nowFunction() {
    return parseInt(Date.now() / 1000)
  }

  function unformat(value) {
    let valueString, numberString, i, c
    valueString = String(value)
    numberString = ''
    for (i = 0; i < valueString.length; i++) {
      c = valueString.substr(i, 1)
      if (c >= '0' && c <= '9') {
        numberString += c
      } else if (c >= '０' && c <= '９') {
        numberString += String.fromCharCode('0'.charCodeAt(0) + c.charCodeAt(0) - '０'.charCodeAt(0))
      } else if (c == '.' || c == '-') {
        numberString += c
      }
    }
    return parseFloat(numberString)
  }

  function choiceFunc() {
    let index
    if (arguments[0] == null || arguments[0] == undefined) {
      return arguments[0]
    }
    index = parseInt(arguments[0])
    if (index < 0 || index >= (arguments.length - 1)) {
      return undefined
    }
    return arguments[index + 1]
  }

  function conditionFunc() {
    let index
    for (index = 0; index < arguments.length; index += 2) {
      if (arguments[index] == true && index + 1 < arguments.length) {
        return arguments[index + 1]
      }
    }
    return undefined
  }

  function accumulateFunc() {
    let index, c = ''
    for (index = 0; index < arguments.length; index += 2) {
      if (arguments[index] == true && index + 1 < arguments.length) {
        c = c + arguments[index + 1] + '\n'
      }
    }
    return c
  }

  function Parser() {
    this.success = false
    this.errormsg = ''
    this.expression = ''

    this.pos = 0

    this.tokennumber = 0
    this.tokenprio = 0
    this.tokenindex = 0
    this.tmpprio = 0

    Parser.functions = {
      'count': countElements,
      'random': random,
      'fac': fac,
      'min': Math.min,
      'max': Math.max,
      'pyt': pyt,
      'pow': Math.pow,
      'atan2': Math.atan2,
      'if': iff,
      'sum': sumfunc,
      'average': averagefunc,
      'list': listfunc,
      'format': numberformat,
      'currency': currencyformat,
      'substr': substr,
      'substring': substring,
      'indexof': indexof,
      'lastindexof': lastindexof,
      'replace': replace,
      'substitute': substitute,
      'match': match,
      'test': test,
      'sin': Math.sin,
      'cos': Math.cos,
      'tan': Math.tan,
      'asin': Math.asin,
      'acos': Math.acos,
      'atan': Math.atan,
      'sqrt': Math.sqrt,
      'log': Math.log,
      'abs': Math.abs,
      'ceil': Math.ceil,
      'floor': Math.floor,
      'round': roundfunc,
      'exp': Math.exp,
      'items': itematindex,
      'length': length,
      'datetime': SecondInt,
      'date': DateInt,
      'datecomponents': datecomponents,
      'datetimecomponents': datetimecomponents,
      'year': yearAlt,
      'month': monthAlt,
      'day': dayAlt,
      'weekday': weekdayAlt,
      'hour': hourAlt,
      'minute': minuteAlt,
      'second': secondAlt,
      'yeard': yeard,
      'monthd': monthd,
      'dayd': dayd,
      'weekdayd': weekdayd,
      'yeardt': yeardt,
      'monthdt': monthdt,
      'daydt': daydt,
      'weekdaydt': weekdaydt,
      'hourdt': hourdt,
      'minutedt': minutedt,
      'seconddt': seconddt,
      'addyear': addyear,
      'addmonth': addmonth,
      'addday': addday,
      'addhour': addhour,
      'addminute': addminute,
      'addsecond': addsecond,
      'addyeard': addyeard,
      'addmonthd': addmonthd,
      'adddayd': adddayd,
      'addyeardt': addyeardt,
      'addmonthdt': addmonthdt,
      'adddaydt': adddaydt,
      'addhourdt': addhourdt,
      'addminutedt': addminutedt,
      'addseconddt': addseconddt,
      'endofmonth': endofmonth,
      'startofmonth': startofmonth,
      'endofmonthd': endofmonthd,
      'startofmonthd': startofmonthd,
      'endofmonthdt': endofmonthdt,
      'startofmonthdt': startofmonthdt,
      'today': today,
      'now': nowFunction,
      'right': rightstring,
      'mid': midstring,
      'left': leftstring,
      'itemIndexOf': itemIndexOfFunc,
      'choice': choiceFunc,
      'condition': conditionFunc,
      'accumulate': accumulateFunc,
      'basename': basename,
      'extname': extname,
      'dirname': dirname,
      'startsWith': startsWith,
      'endsWith': endsWith
    }

    this.consts = {
      'E': Math.E,
      'PI': Math.PI,
      'true': true,
      'TRUE': true,
      'false': false,
      'FALSE': false
    }

    Parser.operators = {
      //    '-': [1, neg, 2], The minus operatior should be specially handled.
      '!': [1, logicalnot, 2],
      '+': [2, add, 4],
      '⊕': [2, addstring, 4],
      '-': [2, sub, 4],
      '*': [2, mul, 3],
      '/': [2, div, 3],
      '%': [2, mod, 3],
      '^': [2, Math.pow, 1],
      ',': [2, append, 15],
      '>': [2, greaterthan, 6],
      '<': [2, lessthan, 6],
      '>=': [2, greaterequal, 6],
      '<=': [2, lessequal, 6],
      '==': [2, equal, 7],
      '=': [2, equal, 7],
      '!=': [2, notequal, 7],
      '<>': [2, notequal, 7],
      '&&': [2, logicaland, 11],
      '||': [2, logicalor, 12],
      '∩': [2, charsetand, 3],
      '∪': [2, charsetor, 4],
      '⊁': [2, charsetnoother, 4],
      '⋀': [2, itemsetand, 3],
      '⋁': [2, itemsetor, 4],
      '⊬': [2, itemsetnoother, 4],
      '?': [2, iff, 13],
      ':': [4, iff, 13]
    }

    Parser.ops1 = {
      '-': neg//,   // The minus operatior should be specially handled.
    }
    Parser.ops2 = {}
    Parser.ops3 = {}
    Parser.ops3Trail = {}

    for (let op in Parser.operators) {
      if (Parser.operators.hasOwnProperty(op)) {
        switch (Parser.operators[op][0]) {
          case 1:
            Parser.ops1[op] = Parser.operators[op][1]
            break
          case 2:
            Parser.ops2[op] = Parser.operators[op][1]
            break
          case 3:
            Parser.ops3[op] = Parser.operators[op][1]
            break
          case 4:
            Parser.ops3Trail[op] = Parser.operators[op][1]
            break
        }
      }
    }

  }

  Parser.parse = function (expr) {
    return new Parser().parse(expr)
  }

  Parser.evaluate = function (expr, variables) {
    let result
    result = Parser.parse(expr).evaluate(variables)

    //console.log(expr, variables)
    //console.log('result=', result)

    return result
  }

  Parser.Expression = Expression

  let PRIMARY = 1 << 0
  let OPERATOR = 1 << 1
  let FUNCTION = 1 << 2
  let LPAREN = 1 << 3
  let RPAREN = 1 << 4
  let COMMA = 1 << 5
  let SIGN = 1 << 6
  let CALL = 1 << 7
  let NULLARY_CALL = 1 << 8

  Parser.prototype = {
    parse: function (expr) {
      this.errormsg = ''
      this.success = true
      let operstack = []
      let tokenstack = []
      this.tmpprio = 0
      let expected = (PRIMARY | LPAREN | FUNCTION | SIGN)
      let noperators = 0
      this.expression = expr
      this.pos = 0
      let funcstack = [], token

      while (this.pos < this.expression.length) {
        if (this.isOperator()) {
          if (this.isSign() && (expected & SIGN)) {
            if (this.isNegativeSign()) {
              this.tokenprio = 2
              this.tokenindex = '-'
              noperators++
              this.addfunc(tokenstack, operstack, TOP1)
            }
            expected = (PRIMARY | LPAREN | FUNCTION | SIGN)
          } else if (this.isComment()) {
            // do nothing
          } else {
            if ((expected & OPERATOR) === 0) {
              this.error_parsing(this.pos, 'unexpected operator')
            }
            if (this.tokenindex == '?') {
              this.tmpprio -= 40
              this.tokenindex = 'if'
              this.addfunc(tokenstack, operstack, TOP2)
              this.tmpprio += 40
              this.tokenindex = ','
              noperators += 3
              this.addfunc(tokenstack, operstack, TOP2)
            } else if (this.tokenindex == ':') {
              this.tokenindex = ','
              noperators += 2
              this.addfunc(tokenstack, operstack, TOP2)
            } else /* if (this.tokenindex != ',') */ {
              noperators += 2
              this.addfunc(tokenstack, operstack, TOP2)
            }
            expected = (PRIMARY | LPAREN | FUNCTION | SIGN)
          }
        } else if (this.isNumber()) {
          if ((expected & PRIMARY) === 0) {
            this.error_parsing(this.pos, 'unexpected number')
          }
          token = new Token(TNUMBER, 0, 0, this.tokennumber)
          tokenstack.push(token)

          expected = (OPERATOR | RPAREN | COMMA)
        } else if (this.isString()) {
          if ((expected & PRIMARY) === 0) {
            this.error_parsing(this.pos, 'unexpected string')
          }
          token = new Token(TNUMBER, 0, 0, this.tokennumber)
          tokenstack.push(token)

          expected = (OPERATOR | RPAREN | COMMA)
        } else if (this.isLeftParenth()) {
          if ((expected & LPAREN) === 0) {
            this.error_parsing(this.pos, 'unexpected \'(\"')
          }

          if (expected & CALL) {
            funcstack.push(true)
          } else {
            funcstack.push(false)
          }
          expected = (PRIMARY | LPAREN | FUNCTION | SIGN | NULLARY_CALL)
        } else if (this.isRightParenth()) {
          let isFunc = funcstack.pop()
          if (isFunc) {
            noperators += 2
            this.tokenprio = -2
            this.tokenindex = -1
            this.addfunc(tokenstack, operstack, TFUNCALL)
          }

          if (expected & NULLARY_CALL) {
            token = new Token(TNUMBER, 0, 0, [])
            tokenstack.push(token)
          } else if ((expected & RPAREN) === 0) {
            this.error_parsing(this.pos, 'unexpected \")\"')
          }

          expected = (OPERATOR | RPAREN | COMMA | LPAREN | CALL)
        } else if (this.isConst()) {
          if ((expected & PRIMARY) === 0) {
            this.error_parsing(this.pos, 'unexpected constant')
          }
          let consttoken = new Token(TNUMBER, 0, 0, this.tokennumber)
          tokenstack.push(consttoken)
          expected = (OPERATOR | RPAREN | COMMA)
        } else if (this.isVar()) {
          if ((expected & PRIMARY) === 0) {
            this.error_parsing(this.pos, 'unexpected variable')
          }
          let vartoken = new Token(TVAR, this.tokenindex, 0, 0)
          tokenstack.push(vartoken)
          expected = (OPERATOR | RPAREN | COMMA | LPAREN | CALL)
        } else if (this.isWhite()) {
          // do nothing
        } else {
          if (this.errormsg === '') {
            this.error_parsing(this.pos, 'unknown character')
          } else {
            this.error_parsing(this.pos, this.errormsg)
          }
        }
      }
      if (this.tmpprio < 0 || this.tmpprio >= 10) {
        this.error_parsing(this.pos, 'unmatched \"()\"')
      }
      while (operstack.length > 0) {
        let tmp = operstack.pop()
        tokenstack.push(tmp)
      }
//            if (noperators + 1 !== tokenstack.length) {
//                this.error_parsing(this.pos, 'parity')
//            }

      return new Expression(tokenstack)
    },

    evaluate: function (expr, variables) {
      let result
      this.parse(expr).evaluate(variables)
      return result
    },

    error_parsing: function (column, msg) {
      this.success = false
      this.errormsg = 'parse error [column ' + (column) + ']: ' + msg
      throw (new Error(this.errormsg))
    },

//\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\

    addfunc: function (tokenstack, operstack, type_) {
      let operator = new Token(type_, this.tokenindex, this.tokenprio + this.tmpprio, 0)
      while (operstack.length > 0) {
        if (operator.prio_ >= operstack[operstack.length - 1].prio_) {
          tokenstack.push(operstack.pop())
        } else {
          break
        }
      }
      operstack.push(operator)
    },

    isNumber: function () {
      let r = false
      let str = ''
      while (this.pos < this.expression.length) {
        let code = this.expression.charCodeAt(this.pos)
        if ((code >= 48 && code <= 57) || code === 46) {
          str += this.expression.charAt(this.pos)
          this.pos++
          this.tokennumber = parseFloat(str)
          r = true
        } else {
          break
        }
      }
      return r
    },

    // Ported from the yajjl JSON parser at http://code.google.com/p/yajjl/
    unescape: function (v, pos) {
      let buffer = []
      let escaping = false

      for (let i = 0; i < v.length; i++) {
        let c = v.charAt(i)

        if (escaping) {
          switch (c) {
            case '\'':
              buffer.push('\'')
              break
            case '\\':
              buffer.push('\\')
              break
            case '/':
              buffer.push('/')
              break
            case 'b':
              buffer.push('\b')
              break
            case 'f':
              buffer.push('\f')
              break
            case 'n':
              buffer.push('\n')
              break
            case 'r':
              buffer.push('\r')
              break
            case 't':
              buffer.push('\t')
              break
            case 'u':
              // interpret the following 4 characters as the hex of the unicode code point
              let codePoint = parseInt(v.substring(i + 1, i + 5), 16)
              buffer.push(String.fromCharCode(codePoint))
              i += 4
              break
            default:
              throw this.error_parsing(pos + i, 'Illegal escape sequence: \'\\' + c + '\'')
          }
          escaping = false
        } else {
          if (c == '\\') {
            escaping = true
          } else {
            buffer.push(c)
          }
        }
      }

      return buffer.join('')
    },

    isString: function () {
      let r = false
      let str = ''
      let startpos = this.pos
      if (this.pos < this.expression.length && this.expression.charAt(this.pos) == '\'') {
        this.pos++
        while (this.pos < this.expression.length) {
          let code = this.expression.charAt(this.pos)
          if (code != '\'' || str.slice(-1) == '\\') {
            str += this.expression.charAt(this.pos)
            this.pos++
          } else {
            this.pos++
            this.tokennumber = this.unescape(str, startpos)
            r = true
            break
          }
        }
      }
      return r
    },

    isConst: function () {
      let str, i
      for (i in this.consts) {
        if (this.consts.hasOwnProperty(i)) {
          let L = i.length
          str = this.expression.substr(this.pos, L)
          if (i === str) {
            this.tokennumber = this.consts[i]
            this.pos += L
            return true
          }
        }
      }
      return false
    },

    isOperator: function () {
      let code
      if (this.pos + 1 < this.expression.length) {
        code = this.expression.substr(this.pos, 2)
        if (Parser.operators[code]) {
          this.tokenprio = Parser.operators[code][2]
          this.tokenindex = code
          this.pos += 2
          return true
        }
      }
      code = this.expression.substr(this.pos, 1)
      if (Parser.operators[code]) {
        this.tokenprio = Parser.operators[code][2]
        this.tokenindex = code
        this.pos++
        return true
      }
      return false
    },

    isSign: function () {
      let code = this.expression.charCodeAt(this.pos - 1)
      if (code === 45 || code === 43) { // -
        return true
      }
      return false
    },

    isPositiveSign: function () {
      let code = this.expression.charCodeAt(this.pos - 1)
      if (code === 43) { // -
        return true
      }
      return false
    },

    isNegativeSign: function () {
      let code = this.expression.charCodeAt(this.pos - 1)
      if (code === 45) { // -
        return true
      }
      return false
    },

    isLeftParenth: function () {
      let code = this.expression.charCodeAt(this.pos)
      if (code === 40) { // (
        this.pos++
        this.tmpprio -= 20
        return true
      }
      return false
    },

    isRightParenth: function () {
      let code = this.expression.charCodeAt(this.pos)
      if (code === 41) { // )
        this.pos++
        this.tmpprio += 20
        return true
      }
      return false
    },

    isComma: function () {
      let code = this.expression.charCodeAt(this.pos)
      if (code === 44) { // ,
        this.pos++
        this.tokenprio = 15
        this.tokenindex = ','
        return true
      }
      return false
    },

    isWhite: function () {
      let code = this.expression.charCodeAt(this.pos)
      if (code === 32 || code === 9 || code === 10 || code === 13) {
        this.pos++
        return true
      }
      return false
    },

    isVar: function () {
      let str = ''
      for (let i = this.pos; i < this.expression.length; i++) {
        let c = this.expression.charAt(i)
        if (i === this.pos) {
          if (!c.match(Parser.regFirstVarChar)) {
            break
          }
        } else {
          if (!c.match(Parser.regRestVarChar)) {
            break
          }
        }
        str += c
      }
      if (str.length > 0) {
        this.tokenindex = str
        this.tokenprio = 0
        this.pos += str.length
        return true
      }
      return false
    },

    isComment: function () {
      let code = this.expression.charCodeAt(this.pos - 1)
      if (code === 47 && this.expression.charCodeAt(this.pos) === 42) {
        this.pos = this.expression.indexOf('*/', this.pos) + 2
        if (this.pos === 1) {
          this.pos = this.expression.length
        }
        return true
      }
      return false
    }
  }

  scope.Parser = Parser
  return Parser
})(typeof exports === 'undefined' ? {} : exports)

// @@IM@@IgnoringRestOfFile
module.exports = Parser
const IMLibFormat = require('../inter-mediator-formatter/index')
/*
 Based on ndef.parser, by Raphael Graf(r@undefined.ch)
 http://www.undefined.ch/mparser/index.html
 Ported to JavaScript and modified by Matthew Crumley (email@matthewcrumley.com, http://silentmatt.com/)
 You are free to use and modify this code in anyway you find useful. Please leave this comment in the code
 to acknowledge its original source. If you feel like it, I enjoy hearing about projects that use my code,
 but don't feel like you have to let me know or ask permission.
 */
/*
 * INTER-Mediator
 * Copyright (c) INTER-Mediator Directive Committee (http://inter-mediator.org)
 * This project started at the end of 2009 by Masayuki Nii msyk@msyk.net.
 *
 * INTER-Mediator is supplied under MIT License.
 * Please see the full license for details:
 * https://github.com/INTER-Mediator/INTER-Mediator/blob/master/dist-docs/License.txt
 */
/**
 *
 * Usually you don't have to instanciate this class with new operator.
 * @constructor
 */
let Parser = (function (scope) {
  let TNUMBER = 0
  let TOP1 = 1
  let TOP2 = 2
  let TOP3 = 5
  let SEP = 65
  let TVAR = 3
  let TFUNCALL = 4

  Parser.regFirstVarChar = new RegExp('[\u00A0-\u1FFF\u2C00-\uDFFFa-zA-Z@_]')
  Parser.regRestVarChar = new RegExp('[\u00A0-\u1FFF\u2C00-\uDFFFa-zA-Z@_:0-9]')

  function Token(type_, index_, prio_, number_) {
    this.type_ = type_
    this.index_ = index_ || 0
    this.prio_ = prio_ || 0
    this.number_ = (number_ !== undefined && number_ !== null) ? number_ : 0
    this.toString = function () {
      switch (this.type_) {
        case TNUMBER:
          return this.number_
        case TOP1:
        case TOP2:
        case TOP3:
        case TVAR:
          return this.index_
        case TFUNCALL:
          return 'CALL'
        case SEP:
          return 'SEPARATOR'
        default:
          return 'Invalid Token'
      }
    }
  }

  function Expression(tokens, ops1, ops2, functions, ops3, ops3Trail) {
    this.tokens = tokens
  }

  // Based on http://www.json.org/json2.js
//    let cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g
  let escapable = /[\\\'\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g
  let meta = {    // table of character substitutions
    '\b': '\\b',
    '\t': '\\t',
    '\n': '\\n',
    '\f': '\\f',
    '\r': '\\r',
    '\'': '\\\'',
    '\\': '\\\\'
  }

  function escapeValue(v) {
    if (typeof v === 'string') {
      escapable.lastIndex = 0
      return escapable.test(v) ? '\'' + v.replace(escapable, function (a) {
        let c = meta[a]
        return typeof c === 'string' ? c : '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4)
      }) + '\'' : '\'' + v + '\''
    }
    return v
  }

  Expression.prototype = {
    simplify: function (values) {
      values = values || {}
      let nstack = []
      let newexpression = []
      let n1
      let n2
      let n3
      let f
      let L = this.tokens.length
      let item
      let i
      for (i = 0; i < L; i++) {
        item = this.tokens[i]
        let type_ = item.type_
        if (type_ === TNUMBER) {
          nstack.push(item)
        } else if (type_ === TVAR && (item.index_ in values)) {
          item = new Token(TNUMBER, 0, 0, values[item.index_])
          nstack.push(item)
        } else if (type_ === TOP3 && nstack.length > 2) {
          n3 = nstack.pop()
          n2 = nstack.pop()
          n1 = nstack.pop()
          f = Parser.ops3[item.index_]
          item = new Token(TNUMBER, 0, 0, f(n1.number_, n2.number_, n3.number_))
          nstack.push(item)
        } else if (type_ === TOP2 && nstack.length > 1) {
          n2 = nstack.pop()
          n1 = nstack.pop()
          f = Parser.ops2[item.index_]
          item = new Token(TNUMBER, 0, 0, f(n1.number_, n2.number_))
          nstack.push(item)
        } else if (type_ === TOP1 && nstack.length > 0) {
          n1 = nstack.pop()
          f = Parser.ops1[item.index_]
          item = new Token(TNUMBER, 0, 0, f(n1.number_))
          nstack.push(item)
        } else {
          while (nstack.length > 0) {
            newexpression.push(nstack.shift())
          }
          newexpression.push(item)
        }
      }
      while (nstack.length > 0) {
        newexpression.push(nstack.shift())
      }

      return new Expression(newexpression)
    },

    substitute: function (variable, expr) {
      if (!(expr instanceof Expression)) {
        expr = new Parser().parse(String(expr))
      }
      let newexpression = []
      let L = this.tokens.length
      let item
      let i
      for (i = 0; i < L; i++) {
        item = this.tokens[i]
        let type_ = item.type_
        if (type_ === TVAR && item.index_ === variable) {
          for (let j = 0; j < expr.tokens.length; j++) {
            let expritem = expr.tokens[j]
            let replitem = new Token(expritem.type_, expritem.index_, expritem.prio_, expritem.number_)
            newexpression.push(replitem)
          }
        } else {
          newexpression.push(item)
        }
      }
      return new Expression(newexpression)
    },

    evaluate: function (values) {
      values = values || {}
      let nstack = []
      let n1
      let n2
      let n3
      let f
      let L = this.tokens.length
      let item
      let i = 0
      for (i = 0; i < L; i++) {
        item = this.tokens[i]
        let type_ = item.type_
        if (type_ === TNUMBER) {
          nstack.push(item.number_)
        } else if (type_ === TOP3) {
          n3 = nstack.pop()
          n2 = nstack.pop()
          n1 = nstack.pop()
          f = Parser.ops3Trail[item.index_]
          nstack.push(f(n1, n2, n3))
        } else if (type_ === TOP2) {
          n2 = nstack.pop()
          n1 = nstack.pop()
          f = Parser.ops2[item.index_]
          nstack.push(f(n1, n2))
        } else if (type_ === TVAR) {
          if (item.index_ in values) {
            nstack.push(values[item.index_])
          } else if (item.index_ in Parser.functions) {
            nstack.push(Parser.functions[item.index_])
          } else {
            throw new Error('undefined variable: ' + item.index_)
          }
        } else if (type_ === TOP1) {
          n1 = nstack.pop()
          f = Parser.ops1[item.index_]
          nstack.push(f(n1))
        } else if (type_ === SEP) {
          n2 = nstack.pop()
          n1 = nstack.pop()
          nstack.push([n1, n2])
        } else if (type_ === TFUNCALL) {
          n1 = nstack.pop()
          f = nstack.pop()

          if (f.apply && f.call) {
            if (Object.prototype.toString.call(n1) == '[object Array]') {
              nstack.push(f.apply(undefined, n1))
            } else {
              nstack.push(f.call(undefined, n1))
            }
          } else {
            throw new Error(f + ' is not a function')
          }
        } else {
          throw new Error('invalid Expression')
        }
      }
      if (nstack.length > 1) {
        throw new Error('invalid Expression (parity)')
      }
      return nstack[0]
    },

    variables: function () {
      let L = this.tokens.length
      let vars = []
      for (let i = 0; i < L; i++) {
        let item = this.tokens[i]
        if (item.type_ === TVAR && (vars.indexOf(item.index_) == -1) && !(item.index_ in Parser.functions)) {
          vars.push(item.index_)
        }
      }
      return vars
    }
  }

  function iff(a, b, c) {
    let vala, valb, valc
    vala = (a instanceof Array) ? arguments[0][0] : arguments[0]
    valb = (b instanceof Array) ? arguments[1][0] : arguments[1]
    valc = (c instanceof Array) ? arguments[2][0] : arguments[2]
    return vala ? valb : valc
  }

  function greaterthan(a, b) {
    let numa, numb
    numa = toNumber(a)
    numb = toNumber(b)
    if (!isNaN(numa) && !isNaN(numa)) {
      return Number(numa) > Number(numb)
    }
    return a > b
  }

  function lessthan(a, b) {
    let numa, numb
    numa = toNumber(a)
    numb = toNumber(b)
    if (!isNaN(numa) && !isNaN(numa)) {
      return Number(numa) < Number(numb)
    }
    return a < b
  }

  function greaterequal(a, b) {
    let numa, numb
    numa = toNumber(a)
    numb = toNumber(b)
    if (!isNaN(numa) && !isNaN(numa)) {
      return Number(numa) >= Number(numb)
    }
    return a >= b
  }

  function lessequal(a, b) {
    let numa, numb
    numa = toNumber(a)
    numb = toNumber(b)
    if (!isNaN(numa) && !isNaN(numa)) {
      return Number(numa) <= Number(numb)
    }
    return a <= b
  }

  function equal(a, b) {
    let numa, numb
    numa = toNumber(a)
    numb = toNumber(b)
    if (!isNaN(numa) && !isNaN(numa)) {
      return Number(numa) === Number(numb)
    }
    return a == b
  }

  function notequal(a, b) {
    let numa, numb
    numa = toNumber(a)
    numb = toNumber(b)
    if (!isNaN(numa) && !isNaN(numa)) {
      return Number(numa) !== Number(numb)
    }
    return a !== b
  }

  // http://qiita.com/south37/items/e400a3a698957ab4aa7a
  // NaN === NaN returns false.
  function isReallyNaN(x) {
    return x !== x    // if x is NaN returns true, otherwise false.
  }

  function add(a, b) {
    let numa, numb
    if ((typeof a) == 'string' || (typeof b) == 'string') {
      return addstring(a, b)
    }
    if (isReallyNaN(a) || isReallyNaN(b)) {
      return NaN
    }
    numa = toNumber(a)
    numb = toNumber(b)
    if (!isNaN(numa) && !isNaN(numb)) {
      return Number(numa) + Number(numb)
    }
    return a + b
  }

  function addstring(a, b) {
    return String(a) + String(b)
  }

  function sub(a, b) {
    let numa, numb, str, pos
    if (isReallyNaN(a) || isReallyNaN(b)) {
      return NaN
    }
    numa = toNumber(a)
    numb = toNumber(b)

    if (!isNaN(numa) && !isNaN(numb)) {
      return numa - numb   // Numeric substruct
    }
    str = String(a)
    do {  // String substruct
      pos = str.indexOf(b)
      if (pos > -1) {
        str = str.substr(0, pos) + str.substr(pos + b.length)
      }
    } while (pos > -1)
    return str
  }

  function mul(a, b) {
    if (isReallyNaN(a) || isReallyNaN(b)) {
      return NaN
    }
    a = toNumber(a)
    b = toNumber(b)
    return a * b
  }

  function div(a, b) {
    if (isReallyNaN(a) || isReallyNaN(b)) {
      return NaN
    }
    a = toNumber(a)
    b = toNumber(b)
    return a / b
  }

  function mod(a, b) {
    if (isReallyNaN(a) || isReallyNaN(b)) {
      return NaN
    }
    a = toNumber(a)
    b = toNumber(b)
    return a % b
  }

  function neg(a) {
    if (isReallyNaN(a)) {
      return NaN
    }
    a = toNumber(a)
    return -a
  }

  function random(a) {
    a = toNumber(a)
    return Math.random() * (a || 1)
  }

  function fac(a) { //a!
    if (isReallyNaN(a)) {
      return NaN
    }
    a = toNumber(a)
    a = Math.floor(a)
    let b = a
    while (a > 1) {
      b = b * (--a)
    }
    return b
  }

  function logicalnot(a) {
    a = toNumber(a)
    return !a
  }

  function logicaland(a, b) {
    a = toNumber(a)
    b = toNumber(b)
    return a && b
  }

  function logicalor(a, b) {
    a = toNumber(a)
    b = toNumber(b)
    return a || b
  }

  function sumfunc() {
    let result = 0, i
    for (i = 0; i < arguments.length; i++) {
      result += toNumber(arguments[i])
    }
    return result
  }

  function averagefunc() {
    let result = 0, i, count = 0

    for (i = 0; i < arguments.length; i++) {
      result += toNumber(arguments[i])
      count++
    }
    return result / count
  }

  function countElements() {
    let i, count = 0

    for (i = 0; i < arguments.length; i++) {
      count += Array.isArray(arguments[i]) ? arguments[i].length : 1
    }
    return count
  }

  function listfunc() {
    let result = '', i

    for (i = 0; i < arguments.length; i++) {
      result += String(arguments[i])
      result += '\n'
    }
    return result
  }

  function roundfunc(a, b) {
    if (b == undefined) {
      return Math.round(a)
    } else {
      a = (a instanceof Array) ? a.join() : a
      b = (b instanceof Array) ? b.join() : b
      return round(a, b)
    }
  }

  /**
   * This method returns the rounded value of the 1st parameter to the 2nd parameter from decimal point.
   * @param {number} value The source value.
   * @param {integer} digit Positive number means after the decimal point, and negative menas before it.
   * @returns {number}
   */
  function round(value, digit) {
    'use strict'
    let powers = Math.pow(10, digit)
    return Math.round(value * powers) / powers
  }

  function length(a) {
    if (a == undefined || a == null) {
      return 0
    } else {
      a = (a instanceof Array) ? a.join() : a
      return (new String(a)).length
    }
  }

  /* ===== private ===== */
  function toNumber(str) {
    let value

    if (str === undefined) {
      return NaN
    }
    if (str === true) {
      return true
    }
    if (str === false) {
      return false
    }
    if (str == '') {
      return 0
    }
    value = str
    if (Array.isArray(str)) {
      if (str.length < 1) {
        return 0
      } else {
        value = str[0]
      }
    }
    value = unformat(value)
    return value
  }

  /* ===== private ===== */

  // TODO: use hypot that doesn't overflow
  function pyt(a, b) {
    return Math.sqrt(a * a + b * b)
  }

  function append(a, b) {
    if (Object.prototype.toString.call(a) != '[object Array]') {
      return [a, b]
    }
    a = a.slice()
    a.push(b)
    return a
  }

  function charsetand(a, b) {
    let stra, strb, i, result = ''
    stra = (a instanceof Array) ? a.join() : a
    strb = (b instanceof Array) ? b.join() : b
    for (i = 0; i < stra.length; i++) {
      if (strb.indexOf(stra.substr(i, 1)) > -1) {
        result += stra.substr(i, 1)
      }
    }
    return result
  }

  function charsetor(a, b) {
    let stra, strb, i, result = ''
    stra = (a instanceof Array) ? a.join() : a
    strb = (b instanceof Array) ? b.join() : b
    for (i = 0; i < strb.length; i++) {
      if (stra.indexOf(strb.substr(i, 1)) < 0) {
        result += strb.substr(i, 1)
      }
    }
    return stra + result
  }

  function charsetnoother(a, b) {
    let stra, strb, i, result = ''
    stra = (a instanceof Array) ? a.join() : a
    strb = (b instanceof Array) ? b.join() : b
    for (i = 0; i < stra.length; i++) {
      if (strb.indexOf(stra.substr(i, 1)) < 0) {
        result += stra.substr(i, 1)
      }
    }
    return result
  }

  /* ===== private ===== */
  function parametersOfMultiline(a, b) {
    let stra, strb, arraya, arrayb, i, nls, nl = '\n'
    stra = (a instanceof Array) ? a.join() : a
    nls = [
      stra.indexOf('\r\n'),
      stra.indexOf('\r'), stra.indexOf('\n')
    ]
    for (i = 0; i < nls.length; i++) {
      nls[i] = (nls[i] < 0) ? stra.length : nls[i]
    }
    if (nls[0] < stra.length && nls[0] <= nls[1] && nls[0] < nls[2]) {
      nl = '\r\n'
    } else if (nls[1] < stra.length && nls[1] < nls[0] && nls[1] < nls[2]) {
      nl = '\r'
    }
    arraya = stra.replace('\r\n', '\n').replace('\r', '\n').split('\n')
    strb = (b instanceof Array) ? b.join() : b
    arrayb = strb.replace('\r\n', '\n').replace('\r', '\n').split('\n')
    return [arraya, arrayb, nl]
  }

  /* ===== private ===== */

  function itemsetand(a, b) {
    let params, arraya, arrayb, nl, i, result = ''
    params = parametersOfMultiline(a, b)
    arraya = params[0]
    arrayb = params[1]
    nl = params[2]
    for (i = 0; i < arraya.length; i++) {
      if (arrayb.indexOf(arraya[i]) > -1 && arraya[i].length > 0) {
        result += arraya[i] + nl
      }
    }
    return result
  }

  function itemsetor(a, b) {
    let params, arraya, arrayb, nl, i, result = ''
    params = parametersOfMultiline(a, b)
    arraya = params[0]
    arrayb = params[1]
    nl = params[2]
    for (i = 0; i < arraya.length; i++) {
      if (arraya[i].length > 0) {
        result += arraya[i] + nl
      }
    }
    for (i = 0; i < arrayb.length; i++) {
      if (arraya.indexOf(arrayb[i]) < 0 && arrayb[i].length > 0) {
        result += arrayb[i] + nl
      }
    }
    return result
  }

  function itemsetnoother(a, b) {
    let params, arraya, arrayb, nl, i, result = ''
    params = parametersOfMultiline(a, b)
    arraya = params[0]
    arrayb = params[1]
    nl = params[2]
    for (i = 0; i < arraya.length; i++) {
      if (arrayb.indexOf(arraya[i]) < 0 && arraya[i].length > 0) {
        result += arraya[i] + nl
      }
    }
    return result
  }

  function itematindex(a, start, end) {
    let params, arraya, nl, i, result = ''
    params = parametersOfMultiline(a, '')
    arraya = params[0]
    nl = params[2]
    end = (end == undefined) ? arraya.length : end
    for (i = start; (i < start + end) && (i < arraya.length); i++) {
      result += arraya[i] + nl
    }
    return result
  }

  function itemIndexOfFunc(list, str) {
    if (!list) {
      return -1
    }
    let a = list.replace('\r\n', '\n').replace('\r', '\n')
    let ix = 0
    let item, pos
    while (a.length > 0) {
      pos = a.indexOf('\n')
      if (pos > -1) {
        item = a.substr(0, pos)
        a = a.substr(pos + 1)
      } else {
        item = a
        a = ''
      }
      if (item == str) {
        return ix
      }
      ix++
    }
    return -1
  }

  function numberformat(val, digit) {
    let stra, strb
    stra = (val instanceof Array) ? val.join() : val
    strb = (digit instanceof Array) ? digit.join() : digit
    return IMLibFormat.numberFormat(stra, strb, {useSeparator: true})
  }

  function currencyformat(val, digit) {
    let stra, strb
    stra = (val instanceof Array) ? val.join() : val
    strb = (digit instanceof Array) ? digit.join() : digit
    return IMLibFormat.currencyFormat(stra, strb, {useSeparator: true})
  }

  function substr(str, pos, len) {
    let stra, p, l
    if (str == null) {
      return null
    }
    stra = (str instanceof Array) ? str.join() : str
    p = (pos instanceof Array) ? pos.join() : pos
    l = (len instanceof Array) ? len.join() : len

    return stra.substr(p, l)
  }

  function substring(str, start, end) {
    let stra, s, e
    if (str == null) {
      return null
    }
    stra = (str instanceof Array) ? str.join() : str
    s = (start instanceof Array) ? start.join() : start
    e = (end instanceof Array) ? end.join() : end

    return stra.substring(s, e)
  }

  function leftstring(str, start) {
    let stra, s
    if (str == null) {
      return null
    }
    stra = String((str instanceof Array) ? str.join() : str)
    s = parseInt((start instanceof Array) ? start.join() : start)

    return stra.substring(0, s)
  }

  function midstring(str, start, end) {
    let stra, s, e
    if (str == null) {
      return null
    }
    stra = String((str instanceof Array) ? str.join() : str)
    s = parseInt((start instanceof Array) ? start.join() : start)
    e = parseInt((end instanceof Array) ? end.join() : end)

    return stra.substr(s, e)
  }

  function rightstring(str, start) {
    let stra, s
    if (str == null) {
      return null
    }
    stra = String((str instanceof Array) ? str.join() : str)
    s = parseInt((start instanceof Array) ? start.join() : start)

    return stra.substring(stra.length - s)
  }

  function indexof(str, search, from) {
    let stra, s
    if (str == null) {
      return null
    }
    stra = (str instanceof Array) ? str.join() : str
    s = (search instanceof Array) ? search.join() : search
    if (from == undefined) {
      return stra.indexOf(s)
    }
    return stra.indexOf(s, from)

  }

  function lastindexof(str, search, from) {
    let stra, s
    if (str == null) {
      return null
    }
    stra = (str instanceof Array) ? str.join() : str
    s = (search instanceof Array) ? search.join() : search
    if (from == undefined) {
      return stra.lastIndexOf(s)
    }
    return stra.lastIndexOf(s, from)
  }

  function replace(str, start, end, rep) {
    let stra, s, e, r
    if (str == null) {
      return null
    }
    stra = (str instanceof Array) ? str.join() : str
    s = (start instanceof Array) ? start.join() : start
    e = (end instanceof Array) ? end.join() : end
    r = (rep instanceof Array) ? rep.join() : rep
    return stra.substr(0, s) + r + stra.substr(e)
  }

  function substitute(str, search, rep) {
    let stra, s, r, reg
    if (str == null) {
      return null
    }
    stra = (str instanceof Array) ? str.join() : str
    s = (search instanceof Array) ? search.join() : search
    r = (rep instanceof Array) ? rep.join() : rep
    reg = new RegExp(s, 'g')
    return stra.replace(reg, r)
  }

  function match(str, pattern) {
    let stra, p
    stra = (str instanceof Array) ? str.join() : str
    p = (pattern instanceof Array) ? pattern.join() : pattern
    return stra.match(new RegExp(p))
  }

  function test(str, pattern) {
    let stra, p
    if (str == null) {
      return null
    }
    stra = (str instanceof Array) ? str.join() : str
    p = (pattern instanceof Array) ? pattern.join() : pattern
    return (new RegExp(p)).test(stra)
  }

  function basename(path) {
    if (path == null) {
      return null
    }
    let str = (path instanceof Array) ? path.join() : String(path)
    if (str.substr(-1) == '/') {
      str = str.substr(0, str.length - 1)
    }
    return str.substr(str.lastIndexOf('/') - str.length + 1)
  }

  function extname(path) {
    if (path == null) {
      return null
    }
    const str = (path instanceof Array) ? path.join() : String(path)
    const dotPos = str.lastIndexOf('.')
    return (dotPos < 0) ? '' : str.substr(str.lastIndexOf('.') - str.length + 1)
  }

  function dirname(path) {
    if (path == null) {
      return null
    }
    const str = (path instanceof Array) ? path.join() : String(path)
    return str.substr(0, str.lastIndexOf('/'))
  }

  function startsWith(str, pin) {
    if (str === null || pin === null) {
      return null
    }
    const stra = (str instanceof Array) ? str.join() : String(str)
    const pina = (pin instanceof Array) ? pin.join() : String(pin)
    return stra.indexOf(pina) === 0
  }

  function endsWith(str, pin) {
    if (str === null || pin === null) {
      return null
    }
    const stra = (str instanceof Array) ? str.join() : String(str)
    const pina = (pin instanceof Array) ? pin.join() : String(pin)
    return (stra.indexOf(pina) + pina.length) === stra.length
  }

  Parser.timeOffset = (new Date()).getTimezoneOffset()

  function DateInt(str) {
    let theDate
    if (str === undefined) {
      theDate = Date.now()
    } else {
      theDate = Date.parse(str.replace(/-/g, '/'))
      theDate -= Parser.timeOffset * 60000
    }
    return parseInt(theDate / 86400000)
  }

  function SecondInt(str) {
    let theDate
    if (str === undefined) {
      theDate = Date.now()
    } else {
      theDate = Date.parse(str.replace(/-/g, '/'))
      //theDate -= Parser.timeOffset * 60000
    }
    return parseInt(theDate / 1000)
  }

  /* Internal use for date time functions */
  function dvalue(s) {
    if (parseInt(s).length == s.length) {
      return s
    } else {
      return DateInt(s)
    }
  }

  function dtvalue(s) {
    if (parseInt(s).length == s.length) {
      return s
    } else {
      return SecondInt(s)
    }
  }

  function calcDateComponent(d, a, index) {
    let dtComp = []
    dtComp.push(yeard(d))
    dtComp.push(monthd(d))
    dtComp.push(dayd(d))
    dtComp[index] += a
    return datecomponents(dtComp[0], dtComp[1], dtComp[2])
  }

  function calcDateTimeComponent(dt, a, index) {
    let dtComp = []
    dtComp.push(yeardt(dt))
    dtComp.push(monthdt(dt))
    dtComp.push(daydt(dt))
    dtComp.push(hourdt(dt))
    dtComp.push(minutedt(dt))
    dtComp.push(seconddt(dt))
    dtComp[index] += a
    return datetimecomponents(dtComp[0], dtComp[1], dtComp[2], dtComp[3], dtComp[4], dtComp[5])
  }

  /* - - - - - - - - - - - - - - - - - - - */

  function datecomponents(y, m, d) {
    let m0 = m - 1
    if (m0 < 0 || m0 > 11) {
      y += parseInt(m0 / 12)
      m = m0 % 12 + 1
    }
    //let str = parseInt(y) + '/' + ('0' + parseInt(m)).substr(-2, 2) + '/01'
    return parseInt(Date.UTC(y, m - 1, d, 0, 0, 0) / 86400000)
  }

  function datetimecomponents(y, m, d, h, i, s) {
    if (s < 0 || s > 59) {
      i += parseInt(s / 60)
      s = s % 60
    }
    if (i < 0 || i > 59) {
      h += parseInt(i / 60)
      i = i % 60
    }
    if (h < 0 || h > 23) {
      d += parseInt(h / 24)
      h = h % 24
    }
    let m0 = m - 1
    if (m0 < 0 || m0 > 11) {
      y += parseInt(m0 / 12)
      m = m0 % 12 + 1
    }
    //let str = parseInt(y) + '/' + ('0' + parseInt(m)).substr(-2, 2) + '/01 ' +
    //    ('0' + parseInt(h)).substr(-2, 2) + ':' + ('0' + parseInt(i)).substr(-2, 2) + ':' +
    //    ('0' + parseInt(s)).substr(-2, 2)
    return Date.UTC(y, m - 1, d, h, i, s) / 1000
  }

  let dateTimeFunction = false

  function yearAlt(d) {
    return this.dateTimeFunction ? yeardt(d) : yeard(d)
  }

  function monthAlt(d) {
    return this.dateTimeFunction ? monthdt(d) : monthd(d)
  }

  function dayAlt(d) {
    return this.dateTimeFunction ? daydt(d) : dayd(d)
  }

  function weekdayAlt(d) {
    return this.dateTimeFunction ? weekdaydt(d) : weekdayd(d)
  }

  function hourAlt(d) {
    return this.dateTimeFunction ? hourdt(d) : 0
  }

  function minuteAlt(d) {
    return this.dateTimeFunction ? minutedt(d) : 0
  }

  function secondAlt(d) {
    return this.dateTimeFunction ? seconddt(d) : 0
  }

  function yeard(d) {
    return new Date(dvalue(d) * 86400000).getFullYear()
  }

  function monthd(d) {
    return new Date(dvalue(d) * 86400000).getMonth() + 1
  }

  function dayd(d) {
    return new Date(dvalue(d) * 86400000).getDate()
  }

  function weekdayd(d) {
    return new Date(dvalue(d) * 86400000).getDay()
  }

  function yeardt(dt) {
    return new Date(dtvalue(dt) * 1000).getFullYear()
  }

  function monthdt(dt) {
    return new Date(dtvalue(dt) * 1000).getMonth() + 1
  }

  function daydt(dt) {
    return new Date(dtvalue(dt) * 1000).getDate()
  }

  function weekdaydt(dt) {
    return new Date(dtvalue(dt) * 1000).getDay()
  }

  function hourdt(dt) {
    return new Date(dtvalue(dt) * 1000).getHours()
  }

  function minutedt(dt) {
    return new Date(dtvalue(dt) * 1000).getMinutes()
  }

  function seconddt(dt) {
    return new Date(dtvalue(dt) * 1000).getSeconds()
  }

  function addyear(d, a) {
    return this.dateTimeFunction ? addyeardt(d, a) : addyeard(d, a)
  }

  function addmonth(d, a) {
    return this.dateTimeFunction ? addmonthdt(d, a) : addmonthd(d, a)
  }

  function addday(d, a) {
    return this.dateTimeFunction ? adddaydt(d, a) : adddayd(d, a)
  }

  function addhour(d, a) {
    return this.dateTimeFunction ? addhourdt(d, a) : NaN
  }

  function addminute(d, a) {
    return this.dateTimeFunction ? addminutedt(d, a) : NaN
  }

  function addsecond(d, a) {
    return this.dateTimeFunction ? addseconddt(d, a) : NaN
  }

  function addyeard(d, a) {
    return calcDateComponent(d, a, 0)
  }

  function addmonthd(d, a) {
    return calcDateComponent(d, a, 1)
  }

  function adddayd(d, a) {
    return calcDateComponent(d, a, 2)
  }

  function addyeardt(dt, a) {
    return calcDateTimeComponent(dt, a, 0)
  }

  function addmonthdt(dt, a) {
    return calcDateTimeComponent(dt, a, 1)
  }

  function adddaydt(dt, a) {
    return calcDateTimeComponent(dt, a, 2)
  }

  function addhourdt(dt, a) {
    return calcDateTimeComponent(dt, a, 3)
  }

  function addminutedt(dt, a) {
    return calcDateTimeComponent(dt, a, 4)
  }

  function addseconddt(dt, a) {
    return calcDateTimeComponent(dt, a, 5)
  }

  function endofmonth(d) {
    return this.dateTimeFunction ? endofmonthdt(d) : endofmonthd(d)
  }

  function endofmonthd(d) {
    return adddayd(addmonthd(startofmonthd(d), 1), -1)
  }

  function endofmonthdt(dt) {
    return addseconddt(addmonthdt(startofmonthdt(dt), 1), -1)
  }

  function startofmonth(d) {
    return this.dateTimeFunction ? startofmonthdt(d) : startofmonthd(d)
  }

  function startofmonthd(d) {
    let str = yeard(d) + '/' + ('0' + monthd(d)).substr(-2, 2) + '/01'
    return DateInt(str)
  }

  function startofmonthdt(dt) {
    let str = yeardt(dt) + '/' + ('0' + monthdt(dt)).substr(-2, 2) + '/01 00:00:00'
    return SecondInt(str)
  }

  function today() {
    return parseInt(Date.now() / 86400)
  }

  function nowFunction() {
    return parseInt(Date.now() / 1000)
  }

  function unformat(value) {
    let valueString, numberString, i, c
    valueString = String(value)
    numberString = ''
    for (i = 0; i < valueString.length; i++) {
      c = valueString.substr(i, 1)
      if (c >= '0' && c <= '9') {
        numberString += c
      } else if (c >= '０' && c <= '９') {
        numberString += String.fromCharCode('0'.charCodeAt(0) + c.charCodeAt(0) - '０'.charCodeAt(0))
      } else if (c == '.' || c == '-') {
        numberString += c
      }
    }
    return parseFloat(numberString)
  }

  function choiceFunc() {
    let index
    if (arguments[0] == null || arguments[0] == undefined) {
      return arguments[0]
    }
    index = parseInt(arguments[0])
    if (index < 0 || index >= (arguments.length - 1)) {
      return undefined
    }
    return arguments[index + 1]
  }

  function conditionFunc() {
    let index
    for (index = 0; index < arguments.length; index += 2) {
      if (arguments[index] == true && index + 1 < arguments.length) {
        return arguments[index + 1]
      }
    }
    return undefined
  }

  function accumulateFunc() {
    let index, c = ''
    for (index = 0; index < arguments.length; index += 2) {
      if (arguments[index] == true && index + 1 < arguments.length) {
        c = c + arguments[index + 1] + '\n'
      }
    }
    return c
  }

  function Parser() {
    this.success = false
    this.errormsg = ''
    this.expression = ''

    this.pos = 0

    this.tokennumber = 0
    this.tokenprio = 0
    this.tokenindex = 0
    this.tmpprio = 0

    Parser.functions = {
      'count': countElements,
      'random': random,
      'fac': fac,
      'min': Math.min,
      'max': Math.max,
      'pyt': pyt,
      'pow': Math.pow,
      'atan2': Math.atan2,
      'if': iff,
      'sum': sumfunc,
      'average': averagefunc,
      'list': listfunc,
      'format': numberformat,
      'currency': currencyformat,
      'substr': substr,
      'substring': substring,
      'indexof': indexof,
      'lastindexof': lastindexof,
      'replace': replace,
      'substitute': substitute,
      'match': match,
      'test': test,
      'sin': Math.sin,
      'cos': Math.cos,
      'tan': Math.tan,
      'asin': Math.asin,
      'acos': Math.acos,
      'atan': Math.atan,
      'sqrt': Math.sqrt,
      'log': Math.log,
      'abs': Math.abs,
      'ceil': Math.ceil,
      'floor': Math.floor,
      'round': roundfunc,
      'exp': Math.exp,
      'items': itematindex,
      'length': length,
      'datetime': SecondInt,
      'date': DateInt,
      'datecomponents': datecomponents,
      'datetimecomponents': datetimecomponents,
      'year': yearAlt,
      'month': monthAlt,
      'day': dayAlt,
      'weekday': weekdayAlt,
      'hour': hourAlt,
      'minute': minuteAlt,
      'second': secondAlt,
      'yeard': yeard,
      'monthd': monthd,
      'dayd': dayd,
      'weekdayd': weekdayd,
      'yeardt': yeardt,
      'monthdt': monthdt,
      'daydt': daydt,
      'weekdaydt': weekdaydt,
      'hourdt': hourdt,
      'minutedt': minutedt,
      'seconddt': seconddt,
      'addyear': addyear,
      'addmonth': addmonth,
      'addday': addday,
      'addhour': addhour,
      'addminute': addminute,
      'addsecond': addsecond,
      'addyeard': addyeard,
      'addmonthd': addmonthd,
      'adddayd': adddayd,
      'addyeardt': addyeardt,
      'addmonthdt': addmonthdt,
      'adddaydt': adddaydt,
      'addhourdt': addhourdt,
      'addminutedt': addminutedt,
      'addseconddt': addseconddt,
      'endofmonth': endofmonth,
      'startofmonth': startofmonth,
      'endofmonthd': endofmonthd,
      'startofmonthd': startofmonthd,
      'endofmonthdt': endofmonthdt,
      'startofmonthdt': startofmonthdt,
      'today': today,
      'now': nowFunction,
      'right': rightstring,
      'mid': midstring,
      'left': leftstring,
      'itemIndexOf': itemIndexOfFunc,
      'choice': choiceFunc,
      'condition': conditionFunc,
      'accumulate': accumulateFunc,
      'basename': basename,
      'extname': extname,
      'dirname': dirname,
      'startsWith': startsWith,
      'endsWith': endsWith
    }

    this.consts = {
      'E': Math.E,
      'PI': Math.PI,
      'true': true,
      'TRUE': true,
      'false': false,
      'FALSE': false
    }

    Parser.operators = {
      //    '-': [1, neg, 2], The minus operatior should be specially handled.
      '!': [1, logicalnot, 2],
      '+': [2, add, 4],
      '⊕': [2, addstring, 4],
      '-': [2, sub, 4],
      '*': [2, mul, 3],
      '/': [2, div, 3],
      '%': [2, mod, 3],
      '^': [2, Math.pow, 1],
      ',': [2, append, 15],
      '>': [2, greaterthan, 6],
      '<': [2, lessthan, 6],
      '>=': [2, greaterequal, 6],
      '<=': [2, lessequal, 6],
      '==': [2, equal, 7],
      '=': [2, equal, 7],
      '!=': [2, notequal, 7],
      '<>': [2, notequal, 7],
      '&&': [2, logicaland, 11],
      '||': [2, logicalor, 12],
      '∩': [2, charsetand, 3],
      '∪': [2, charsetor, 4],
      '⊁': [2, charsetnoother, 4],
      '⋀': [2, itemsetand, 3],
      '⋁': [2, itemsetor, 4],
      '⊬': [2, itemsetnoother, 4],
      '?': [2, iff, 13],
      ':': [4, iff, 13]
    }

    Parser.ops1 = {
      '-': neg//,   // The minus operatior should be specially handled.
    }
    Parser.ops2 = {}
    Parser.ops3 = {}
    Parser.ops3Trail = {}

    for (let op in Parser.operators) {
      if (Parser.operators.hasOwnProperty(op)) {
        switch (Parser.operators[op][0]) {
          case 1:
            Parser.ops1[op] = Parser.operators[op][1]
            break
          case 2:
            Parser.ops2[op] = Parser.operators[op][1]
            break
          case 3:
            Parser.ops3[op] = Parser.operators[op][1]
            break
          case 4:
            Parser.ops3Trail[op] = Parser.operators[op][1]
            break
        }
      }
    }

  }

  Parser.parse = function (expr) {
    return new Parser().parse(expr)
  }

  Parser.evaluate = function (expr, variables) {
    let result
    result = Parser.parse(expr).evaluate(variables)

    //console.log(expr, variables)
    //console.log('result=', result)

    return result
  }

  Parser.Expression = Expression

  let PRIMARY = 1 << 0
  let OPERATOR = 1 << 1
  let FUNCTION = 1 << 2
  let LPAREN = 1 << 3
  let RPAREN = 1 << 4
  let COMMA = 1 << 5
  let SIGN = 1 << 6
  let CALL = 1 << 7
  let NULLARY_CALL = 1 << 8

  Parser.prototype = {
    parse: function (expr) {
      this.errormsg = ''
      this.success = true
      let operstack = []
      let tokenstack = []
      this.tmpprio = 0
      let expected = (PRIMARY | LPAREN | FUNCTION | SIGN)
      let noperators = 0
      this.expression = expr
      this.pos = 0
      let funcstack = [], token

      while (this.pos < this.expression.length) {
        if (this.isOperator()) {
          if (this.isSign() && (expected & SIGN)) {
            if (this.isNegativeSign()) {
              this.tokenprio = 2
              this.tokenindex = '-'
              noperators++
              this.addfunc(tokenstack, operstack, TOP1)
            }
            expected = (PRIMARY | LPAREN | FUNCTION | SIGN)
          } else if (this.isComment()) {
            // do nothing
          } else {
            if ((expected & OPERATOR) === 0) {
              this.error_parsing(this.pos, 'unexpected operator')
            }
            if (this.tokenindex == '?') {
              this.tmpprio -= 40
              this.tokenindex = 'if'
              this.addfunc(tokenstack, operstack, TOP2)
              this.tmpprio += 40
              this.tokenindex = ','
              noperators += 3
              this.addfunc(tokenstack, operstack, TOP2)
            } else if (this.tokenindex == ':') {
              this.tokenindex = ','
              noperators += 2
              this.addfunc(tokenstack, operstack, TOP2)
            } else /* if (this.tokenindex != ',') */ {
              noperators += 2
              this.addfunc(tokenstack, operstack, TOP2)
            }
            expected = (PRIMARY | LPAREN | FUNCTION | SIGN)
          }
        } else if (this.isNumber()) {
          if ((expected & PRIMARY) === 0) {
            this.error_parsing(this.pos, 'unexpected number')
          }
          token = new Token(TNUMBER, 0, 0, this.tokennumber)
          tokenstack.push(token)

          expected = (OPERATOR | RPAREN | COMMA)
        } else if (this.isString()) {
          if ((expected & PRIMARY) === 0) {
            this.error_parsing(this.pos, 'unexpected string')
          }
          token = new Token(TNUMBER, 0, 0, this.tokennumber)
          tokenstack.push(token)

          expected = (OPERATOR | RPAREN | COMMA)
        } else if (this.isLeftParenth()) {
          if ((expected & LPAREN) === 0) {
            this.error_parsing(this.pos, 'unexpected \'(\"')
          }

          if (expected & CALL) {
            funcstack.push(true)
          } else {
            funcstack.push(false)
          }
          expected = (PRIMARY | LPAREN | FUNCTION | SIGN | NULLARY_CALL)
        } else if (this.isRightParenth()) {
          let isFunc = funcstack.pop()
          if (isFunc) {
            noperators += 2
            this.tokenprio = -2
            this.tokenindex = -1
            this.addfunc(tokenstack, operstack, TFUNCALL)
          }

          if (expected & NULLARY_CALL) {
            token = new Token(TNUMBER, 0, 0, [])
            tokenstack.push(token)
          } else if ((expected & RPAREN) === 0) {
            this.error_parsing(this.pos, 'unexpected \")\"')
          }

          expected = (OPERATOR | RPAREN | COMMA | LPAREN | CALL)
        } else if (this.isConst()) {
          if ((expected & PRIMARY) === 0) {
            this.error_parsing(this.pos, 'unexpected constant')
          }
          let consttoken = new Token(TNUMBER, 0, 0, this.tokennumber)
          tokenstack.push(consttoken)
          expected = (OPERATOR | RPAREN | COMMA)
        } else if (this.isVar()) {
          if ((expected & PRIMARY) === 0) {
            this.error_parsing(this.pos, 'unexpected variable')
          }
          let vartoken = new Token(TVAR, this.tokenindex, 0, 0)
          tokenstack.push(vartoken)
          expected = (OPERATOR | RPAREN | COMMA | LPAREN | CALL)
        } else if (this.isWhite()) {
          // do nothing
        } else {
          if (this.errormsg === '') {
            this.error_parsing(this.pos, 'unknown character')
          } else {
            this.error_parsing(this.pos, this.errormsg)
          }
        }
      }
      if (this.tmpprio < 0 || this.tmpprio >= 10) {
        this.error_parsing(this.pos, 'unmatched \"()\"')
      }
      while (operstack.length > 0) {
        let tmp = operstack.pop()
        tokenstack.push(tmp)
      }
//            if (noperators + 1 !== tokenstack.length) {
//                this.error_parsing(this.pos, 'parity')
//            }

      return new Expression(tokenstack)
    },

    evaluate: function (expr, variables) {
      let result
      this.parse(expr).evaluate(variables)
      return result
    },

    error_parsing: function (column, msg) {
      this.success = false
      this.errormsg = 'parse error [column ' + (column) + ']: ' + msg
      throw (new Error(this.errormsg))
    },

//\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\

    addfunc: function (tokenstack, operstack, type_) {
      let operator = new Token(type_, this.tokenindex, this.tokenprio + this.tmpprio, 0)
      while (operstack.length > 0) {
        if (operator.prio_ >= operstack[operstack.length - 1].prio_) {
          tokenstack.push(operstack.pop())
        } else {
          break
        }
      }
      operstack.push(operator)
    },

    isNumber: function () {
      let r = false
      let str = ''
      while (this.pos < this.expression.length) {
        let code = this.expression.charCodeAt(this.pos)
        if ((code >= 48 && code <= 57) || code === 46) {
          str += this.expression.charAt(this.pos)
          this.pos++
          this.tokennumber = parseFloat(str)
          r = true
        } else {
          break
        }
      }
      return r
    },

    // Ported from the yajjl JSON parser at http://code.google.com/p/yajjl/
    unescape: function (v, pos) {
      let buffer = []
      let escaping = false

      for (let i = 0; i < v.length; i++) {
        let c = v.charAt(i)

        if (escaping) {
          switch (c) {
            case '\'':
              buffer.push('\'')
              break
            case '\\':
              buffer.push('\\')
              break
            case '/':
              buffer.push('/')
              break
            case 'b':
              buffer.push('\b')
              break
            case 'f':
              buffer.push('\f')
              break
            case 'n':
              buffer.push('\n')
              break
            case 'r':
              buffer.push('\r')
              break
            case 't':
              buffer.push('\t')
              break
            case 'u':
              // interpret the following 4 characters as the hex of the unicode code point
              let codePoint = parseInt(v.substring(i + 1, i + 5), 16)
              buffer.push(String.fromCharCode(codePoint))
              i += 4
              break
            default:
              throw this.error_parsing(pos + i, 'Illegal escape sequence: \'\\' + c + '\'')
          }
          escaping = false
        } else {
          if (c == '\\') {
            escaping = true
          } else {
            buffer.push(c)
          }
        }
      }

      return buffer.join('')
    },

    isString: function () {
      let r = false
      let str = ''
      let startpos = this.pos
      if (this.pos < this.expression.length && this.expression.charAt(this.pos) == '\'') {
        this.pos++
        while (this.pos < this.expression.length) {
          let code = this.expression.charAt(this.pos)
          if (code != '\'' || str.slice(-1) == '\\') {
            str += this.expression.charAt(this.pos)
            this.pos++
          } else {
            this.pos++
            this.tokennumber = this.unescape(str, startpos)
            r = true
            break
          }
        }
      }
      return r
    },

    isConst: function () {
      let str, i
      for (i in this.consts) {
        if (this.consts.hasOwnProperty(i)) {
          let L = i.length
          str = this.expression.substr(this.pos, L)
          if (i === str) {
            this.tokennumber = this.consts[i]
            this.pos += L
            return true
          }
        }
      }
      return false
    },

    isOperator: function () {
      let code
      if (this.pos + 1 < this.expression.length) {
        code = this.expression.substr(this.pos, 2)
        if (Parser.operators[code]) {
          this.tokenprio = Parser.operators[code][2]
          this.tokenindex = code
          this.pos += 2
          return true
        }
      }
      code = this.expression.substr(this.pos, 1)
      if (Parser.operators[code]) {
        this.tokenprio = Parser.operators[code][2]
        this.tokenindex = code
        this.pos++
        return true
      }
      return false
    },

    isSign: function () {
      let code = this.expression.charCodeAt(this.pos - 1)
      if (code === 45 || code === 43) { // -
        return true
      }
      return false
    },

    isPositiveSign: function () {
      let code = this.expression.charCodeAt(this.pos - 1)
      if (code === 43) { // -
        return true
      }
      return false
    },

    isNegativeSign: function () {
      let code = this.expression.charCodeAt(this.pos - 1)
      if (code === 45) { // -
        return true
      }
      return false
    },

    isLeftParenth: function () {
      let code = this.expression.charCodeAt(this.pos)
      if (code === 40) { // (
        this.pos++
        this.tmpprio -= 20
        return true
      }
      return false
    },

    isRightParenth: function () {
      let code = this.expression.charCodeAt(this.pos)
      if (code === 41) { // )
        this.pos++
        this.tmpprio += 20
        return true
      }
      return false
    },

    isComma: function () {
      let code = this.expression.charCodeAt(this.pos)
      if (code === 44) { // ,
        this.pos++
        this.tokenprio = 15
        this.tokenindex = ','
        return true
      }
      return false
    },

    isWhite: function () {
      let code = this.expression.charCodeAt(this.pos)
      if (code === 32 || code === 9 || code === 10 || code === 13) {
        this.pos++
        return true
      }
      return false
    },

    isVar: function () {
      let str = ''
      for (let i = this.pos; i < this.expression.length; i++) {
        let c = this.expression.charAt(i)
        if (i === this.pos) {
          if (!c.match(Parser.regFirstVarChar)) {
            break
          }
        } else {
          if (!c.match(Parser.regRestVarChar)) {
            break
          }
        }
        str += c
      }
      if (str.length > 0) {
        this.tokenindex = str
        this.tokenprio = 0
        this.pos += str.length
        return true
      }
      return false
    },

    isComment: function () {
      let code = this.expression.charCodeAt(this.pos - 1)
      if (code === 47 && this.expression.charCodeAt(this.pos) === 42) {
        this.pos = this.expression.indexOf('*/', this.pos) + 2
        if (this.pos === 1) {
          this.pos = this.expression.length
        }
        return true
      }
      return false
    }
  }

  scope.Parser = Parser
  return Parser
})(typeof exports === 'undefined' ? {} : exports)

// @@IM@@IgnoringRestOfFile
module.exports = Parser
const IMLibFormat = require('../inter-mediator-formatter/index')
