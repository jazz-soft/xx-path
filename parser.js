function parse(s) {
  var tt = tokenize(s);
  var a = _Expr(tt, 0);
  if (tt[a[0]].t != 'end') unexpected(tt[a[0]]);
  return a[1];
}
function _req(f, tt, p) { return f(tt, p) || unexpected(tt[p]); }
function _Expr(tt, p) { // [6]
  var a = [], n = 0, x;
  x = _req(_ExprSingle, tt, p + n);
  n += x[0];
  a.push(x[1]);
  while (tt[p + n].t == ',') {
    n++;
    x = _req(_ExprSingle, tt, p + n);
    n += x[0];
    a.push(x[1]);
  }
  return [n, a];
}
function _ExprSingle(tt, p) { // [7]
  return _PathExpr(tt, p);
}
function _PathExpr(tt, p) { // [36]
  var a = [], n = 0, x;
  if (tt[p].t == '/') {
    a.push({ type: '/' });
    n++;
    x = _StepExpr(tt, p + n);
    if (!x) return [n, { type: 'PathExpr', a: a }];
  }
  else if (tt[p].t == '//') {
    a.push({ type: '//' });
    n++;
  }
  while (true) {
    x = _req(_StepExpr, tt, p + n);
    n += x[0];
    a.push(x[1]);
    x = tt[p + n];
    if (x.t == '/' || x.t == '//') {
      a.push({ type: x.t });
      n++;
    }
    else break;
  }
  return [n, { type: 'PathExpr', a: a }];
}
function _StepExpr(tt, p) { // [37]
  return _EQName(tt, p);
}
function _EQName(tt, p) { // [112]
  if (tt[p].t == 'pref' && tt[p + 1].t == 'name') {
    return [2, { type: 'EQName' }];
  }
  else if (tt[p].t == 'Q{}' && tt[p + 1].t == 'name') {
    return [2, { type: 'EQName' }];
  }
  else if (tt[p].t == 'name') {
    return [1, { type: 'EQName' }];
  }
}

function tokenize(s) {
  var tt = [];
  var p, c, x, k;
  for (p = 0; p < s.length; p++) {
    c = s[p];
    if (c == ' ' || c == '\t' || c == '\r' || c == '\n') continue;
    x = get_quoted(s, p) || get_number(s, p) || get_comment(s, p);
    if (x) {
      p += x.s.length;
      tt.push(x);
      continue;
    }
    else if (s[p] == '*' || s[p] == '@' || s[p] == '$' || isNameStart(charcode(s[p]))) {
      k = 0;
      if (s[p] == '$') {
        tt.push({ t: '$', p: p, s: '$' });
        p++;
        k = 1;
        c = '$';
      }
      else if (s[p] == '@') {
        tt.push({ t: 'axis', p: p, s: '@', v: 'attribute' });
        p++;
        k = 1;
      }
      while (k < 3) {
        if (k < 2) {
          x = get_quri(s, p);
          if (x) {
            tt.push(x);
            p += x.s.length;
            k = 2;
            continue;
          }
        }
        x = get_name(s, p);
        if (!x) err('Missing name', p);
        if (x.s == '*' && c == '$') unexpected(x);
        tt.push(x);
        p += x.s.length;
        if (k == 0 && s[p] == ':' && s[p + 1] == ':') {
          if (!axes[x.v]) err('Unknown axis', p - x.v.length);
          x.t = 'axis';
          x.s += '::';
          p += 2;
          k = 1;
          continue;
        }
        if (k < 2 && s[p] == ':') {
          x.t = x.t == '*' ? '*:' : 'pref';
          x.s += ':';
          p++;
          k = 2;
          continue;
        }
        break;
      }
      p--;
    }
    else {
      k = s.substring(p, p + 2);
      if (ops[k]) {
        tt.push({ t: k, p: p, s: k });
        p++;
      }
      else tt.push({ t: c, p: p, s: c });
    }
  }
  tt.push({ t: 'end', p: p });
  return tt;
}
function get_quoted(s, p) {
  const q = s[p];
  if (q != '"' && q != "'") return;
  var c, n, v = '';
  for (n = p + 1; n < s.length; n++) {
    c = s[n];
    if (c == q) {
      n++;
      if (s[n] != q) return { t: '""', p: p, s: s.substring(p, n), v: v };
    }
    v += c;
  }
  err('Unmatched quote', p);
}
function get_number(s, p) {
  var f = false;
  var n = p;
  if (s[n] == '.') { n++; f = true; }
  if (!isDigit(s[n])) return;
  while (isDigit(s[n])) n++;
  if (s[n] == '.' && !f) {
    n++;
    while (isDigit(s[n])) n++;
  }
  if (s[n] == 'e' || s[n] == 'E') {
    n++;
    if (s[n] == '+' || s[n] == '-') n++;
    if (!isDigit(s[n])) err('Syntax error', p);
    while (isDigit(s[n])) n++;
  }
  s = s.substring(p, n);
  return { t: 'num', p: p, s: s, v: parseFloat(s) };
}
function get_quri(s, p) {
  if (s[p] != 'Q' || s[p + 1] != '{') return;
  for (var n = p + 2; n < s.length; n++) if (s[n] == '}') return { t: 'Q{}', p: p, s: s.substring(p, n + 1), v: s.substring(p + 2, n).trim() };
  err('Unmatched brace', p + 1);
}
function get_comment(s, p) {
  if (s[p] != '(' || s[p + 1] != ':') return;
  var k = 1;
  for (var n = p + 2; n < s.length; n++) {
    if (s[n] == '(' && s[n + 1] == ':') { n++; k++; }
    else if (s[n] == ':' && s[n + 1] == ')') {
      n++; k--;
      if (!k) return { t: '(:', p: p, s: s.substring(p, n + 1) };
    }
  }
  err('Incomplete comment', p);
}
function get_name(s, p) {
  if (s[p] == '*') return { t: '*', p: p, s: '*' };
  if (!isNameStart(charcode(s[p]))) return;
  for (var n = p + 1; n < s.length; n++) if (!isNameChar(charcode(s[n]))) break;
  return { t: 'name', p: p, s: s.substring(p, n), v: s.substring(p, n) };
}
function charcode(c) { return c ? c.charCodeAt(0) : -1; }
function isLetter(c) { return c >= 65 && c <= 90 || c >= 97 && c <= 122 || c == 95; }
function isDigit(c) { return c >= '0' && c <= '9'; }
function isNameStart(c) { // https://www.w3.org/TR/REC-xml/#NT-Name
  return isLetter(c) || c >= 0xC0 && c <= 0xD6 || c >= 0xD8 && c <= 0xF6 || c >= 0xF8 && c <= 0x2FF || c >= 0x370 && c <= 0x37D ||
    c >= 0x37F && c <= 0x1FFF || c >= 0x200C && c <= 0x200D || c >= 0x2070 && c <= 0x218F || c >= 0x2C00 && c <= 0x2FEF ||
    c >= 0x3001 && c <= 0xD7FF || c >= 0xF900 && c <= 0xFDCF || c >= 0xFDF0 && c <= 0xFFFD || c >= 0x10000 && c <= 0xEFFFF;
}
function isNameChar(c) { // https://www.w3.org/TR/REC-xml/#NT-Name
  return isNameStart(c) || c == 45 || c == 46 || c >= 48 && c <= 57 || c == 0xb7 || c >= 0x300 && c <= 0x36F || c >= 0x203F && c <= 0x2040;
}
function unexpected(t) { err(t.t == 'end' ? 'Unexpected end of input' : 'Unexpected token: ' + t.s, t.p); }
function err(msg, p) { throw new Error(msg + ' at position ' + p); }
const ops = {};
for (var k of ['//', '..', '||', '<<', '>>', '<=', '>=', '!=']) ops[k] = true;
const axes = {
  'child': {},
  'descendant': {},
  'attribute': {},
  'self': {},
  'descendant-or-self': {},
  'following-sibling': {},
  'following': {},
  'namespace': {},
  'parent': {},
  'ancestor': { rev: true },
  'preceding-sibling': { rev: true },
  'preceding': { rev: true },
  'ancestor-or-self': { rev: true }
};

module.exports = {
  parse: parse,
  tokenize: tokenize
};